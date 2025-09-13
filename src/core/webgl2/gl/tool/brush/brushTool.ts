import { createShader, createProgram, getGlHelper } from "../../utils/glHelper";
import { getRenderingManager } from "../../render";
import {
  TEXTURE_UNIT,
  getSourceTextureManager,
  paintOptions,
} from "../../texture";
import { getLayerManager } from "../../layer";
import { getBufferManager, getFullQuadShader } from "../../vertexShader";
import { getManager } from "../../../../utils/cachedManager";
import { getHistoryManager, HistoryObject } from "../../history/history";
import { Rect } from "@/core/utils/rect";
import { Pointer } from "@/core/types";
import { SplinePathRenderer } from "./pathRenderer/SplinePathRenderer";
import { PathRenderer } from "./pathRenderer/PathRenderer";
import { ShaderPathRenderer } from "./pathRenderer/ShaderPathRenderer";

export function getBrushManager(canvas, gl) {
  const manager = getManager(gl, "brushManager", () =>
    makeBrushManager(canvas, gl)
  );
  return manager;
}

function makeBrushManager(canvas, gl: WebGL2RenderingContext) {
  // (기존 확장 확인 등은 동일)
  const sourceTextureManager = getSourceTextureManager(canvas, gl);
  const fullQuadVertexShader = getFullQuadShader(gl);
  const bufferManager = getBufferManager(canvas, gl);

  let scissorRect: Rect | null = null;

  // ====== PATHMAP 텍스처 생성 (R8) ======
  let pathTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.PATHMAP);
  gl.bindTexture(gl.TEXTURE_2D, pathTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); // 서브업로드 정렬 이슈 방지

  // ====== 기존 brush/eraser 셰이더는 그대로 둠 ======
  const brushShaderSource = `#version 300 es
    precision mediump float;
    uniform sampler2D u_pathMap;
    uniform sampler2D u_source;
    uniform vec2 u_resolution;
    uniform vec3 u_color;
    in vec2 v_texCoord;
    out vec4 outColor;
    void main(){
      float value = texture(u_pathMap, v_texCoord).r;
      vec4 brushColor = vec4(u_color, value);
      vec4 imageColor = texture(u_source, v_texCoord);
      vec3 premultBrush = brushColor.rgb * brushColor.a;
      vec3 premultImage = imageColor.rgb;
      vec3 blendedRGB = premultImage * (1.0 - brushColor.a) + premultBrush;
      float blendedAlpha = imageColor.a + brushColor.a * (1.0 - imageColor.a);
      outColor = vec4(blendedRGB, blendedAlpha);
    }`;
  const brushProgram = createProgram(
    gl,
    fullQuadVertexShader,
    createShader(gl, gl.FRAGMENT_SHADER, brushShaderSource)
  );
  gl.useProgram(brushProgram);
  gl.uniform1i(
    gl.getUniformLocation(brushProgram, "u_pathMap"),
    TEXTURE_UNIT.PATHMAP
  );
  gl.uniform1i(
    gl.getUniformLocation(brushProgram, "u_source"),
    TEXTURE_UNIT.SOURCE
  );
  bufferManager.createFullQuadVAO(brushProgram);

  const eraserShaderSource = `#version 300 es
    precision mediump float;
    uniform sampler2D u_pathMap;
    uniform sampler2D u_source;
    uniform vec2 u_resolution;
    in vec2 v_texCoord;
    out vec4 outColor;
    void main(){
      float value = texture(u_pathMap, v_texCoord).r;
      vec4 imageColor = texture(u_source, v_texCoord);
      float factor = 1.0 - value;
      outColor = vec4(imageColor.rgb * factor, imageColor.a * factor);
    }`;
  const eraserProgram = createProgram(
    gl,
    fullQuadVertexShader,
    createShader(gl, gl.FRAGMENT_SHADER, eraserShaderSource)
  );
  gl.useProgram(eraserProgram);
  gl.uniform1i(
    gl.getUniformLocation(eraserProgram, "u_pathMap"),
    TEXTURE_UNIT.PATHMAP
  );
  gl.uniform1i(
    gl.getUniformLocation(eraserProgram, "u_source"),
    TEXTURE_UNIT.SOURCE
  );
  bufferManager.createFullQuadVAO(eraserProgram);

  const layerManager = getLayerManager(canvas, gl);
  const renderingManager = getRenderingManager(canvas, gl);

  let splinePathRenderer = new SplinePathRenderer(gl, pathTex);
  let shaerPathRenderer = new ShaderPathRenderer(gl, pathTex);

  let pathRenderer: PathRenderer = splinePathRenderer;

  const FALLBACK_SIZE = 1024;
  let brushManager = {
    enter() {},
    start(pointer: Pointer) {
      if (paintOptions.radius < FALLBACK_SIZE) {
        pathRenderer = splinePathRenderer;
      } else {
        pathRenderer = shaerPathRenderer;
      }

      pathRenderer.resetWorkSpace(paintOptions.width, paintOptions.height);
      scissorRect = null;

      pathRenderer.start(pointer);

      // CPU/GPU 알파 초기화(새 스트로크 시작 시)
    },
    stroke(start: Pointer, end: Pointer) {
      // 스플라인 포인트 누적: 기존 API 유지(매 프레임 end만 추가)
      let rect = pathRenderer.stroke(end);
      if (rect) {
        scissorRect = rect; // brush/eraser 렌더 영역으로 사용
      }
    },
    brush() {
      if (!scissorRect) return;

      gl.useProgram(brushProgram);
      gl.uniform3fv(
        gl.getUniformLocation(brushProgram, "u_color"),
        paintOptions.color
      );

      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(
        scissorRect.x,
        scissorRect.y,
        scissorRect.width,
        scissorRect.height
      );

      // 출력: 현재 레이어 FBO
      gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.layerFBO);
      gl.viewport(0, 0, paintOptions.width, paintOptions.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disable(gl.SCISSOR_TEST);

      renderingManager.render(scissorRect); // 더티 영역만 리프레시
    },
    eraser() {
      if (!scissorRect) return;
      gl.useProgram(eraserProgram);

      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(
        scissorRect.x,
        scissorRect.y,
        scissorRect.width,
        scissorRect.height
      );

      gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.layerFBO);
      gl.viewport(0, 0, paintOptions.width, paintOptions.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disable(gl.SCISSOR_TEST);

      renderingManager.render(scissorRect);
    },
    end() {
      // end할때 스플라인 마지막 곡선 그리기
      let rect = pathRenderer.end();
      if (rect) {
        scissorRect = rect; // brush/eraser 렌더 영역으로 사용
        this.brush();
      }

      scissorRect = null;

      // 기존 end 함수들
      const strokeRect = pathRenderer.getStrokeDirtyRect();
      const { before, after } = sourceTextureManager.upload(
        strokeRect.x,
        strokeRect.y,
        strokeRect.width,
        strokeRect.height
      );

      const newHistory = new HistoryObject(gl, {
        undo: async () => {
          await before.apply();
          await renderingManager.render();
          return { tool: "brush" };
        },
        redo: async () => {
          await after.apply();
          await renderingManager.render();
          return { tool: "brush" };
        },
      });

      const historyManager = getHistoryManager(canvas, gl);
      historyManager.addUndo(newHistory);
    },
    cancel() {
      sourceTextureManager.restore();
      pathRenderer.cancel();
      pathRenderer.resetWorkSpace(paintOptions.width, paintOptions.height);
      scissorRect = null;
      renderingManager.render();
    },
    exit() {},
    setSize() {
      const width = paintOptions.width;
      const height = paintOptions.height;

      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);

      // 캔버스/버퍼 준비
      pathRenderer.resetWorkSpace(width, height);
    },
  };

  brushManager.setSize();

  return brushManager;
}
