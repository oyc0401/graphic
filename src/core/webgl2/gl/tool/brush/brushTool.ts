import { createShader, createProgram, getGlHelper } from "../../utils/glHelper";
import { getRenderingManager } from "../../render/render";
import {
  TEXTURE_UNIT,
  getSourceTextureManager,
  paintOptions,
} from "../../texture";
import { getLayerManager } from "../../layer";
import { getVertexManager } from "../../vertexShader";
import { getManager } from "../../../../utils/cachedManager";
import { getHistoryManager, HistoryObject } from "../../../../history/history";
import { Rect } from "@/core/utils/rect";
import { Pointer } from "@/core/types";
import { SplinePathRenderer } from "./pathRenderer/SplinePathRenderer";
import { PathRenderer } from "./pathRenderer/PathRenderer";
import { ShaderPathRenderer } from "./pathRenderer/ShaderPathRenderer";

import brushFrag from "./brush.frag?raw";
import eraserFrag from "./eraser.frag?raw";

import * as twgl from "twgl.js";
export function getBrushManager(canvas, gl) {
  const manager = getManager(gl, "brushManager", () =>
    makeBrushManager(canvas, gl),
  );
  return manager;
}

function makeBrushManager(canvas, gl: WebGL2RenderingContext) {
  // (기존 확장 확인 등은 동일)
  const sourceTextureManager = getSourceTextureManager(canvas, gl);
  const vertexManager = getVertexManager(gl);

  let scissorRect: Rect | null = null;
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); // 서브업로드 정렬 이슈 방지

  // ====== PATHMAP 텍스처 생성 (R8) ======
  let pathTex = twgl.createTexture(gl, {
    wrap: gl.CLAMP_TO_EDGE,
    minMag: gl.LINEAR,
    auto: false,
  });
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.PATHMAP);
  gl.bindTexture(gl.TEXTURE_2D, pathTex);

  const brushProgramInfo = twgl.createProgramInfo(gl, [
    vertexManager.vsSource,
    brushFrag,
  ]);
  twgl.setBuffersAndAttributes(
    gl,
    brushProgramInfo,
    vertexManager.quadBufferInfo,
  );

  gl.useProgram(brushProgramInfo.program);
  gl.uniform1i(
    gl.getUniformLocation(brushProgramInfo.program, "u_pathMap"),
    TEXTURE_UNIT.PATHMAP,
  );
  gl.uniform1i(
    gl.getUniformLocation(brushProgramInfo.program, "u_source"),
    TEXTURE_UNIT.SOURCE,
  );

  const eraserProgramInfo = twgl.createProgramInfo(gl, [
    vertexManager.vsSource,
    eraserFrag,
  ]);
  twgl.setBuffersAndAttributes(
    gl,
    eraserProgramInfo,
    vertexManager.quadBufferInfo,
  );

  gl.useProgram(eraserProgramInfo.program);
  gl.uniform1i(
    gl.getUniformLocation(eraserProgramInfo.program, "u_pathMap"),
    TEXTURE_UNIT.PATHMAP,
  );
  gl.uniform1i(
    gl.getUniformLocation(eraserProgramInfo.program, "u_source"),
    TEXTURE_UNIT.SOURCE,
  );

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

      gl.useProgram(brushProgramInfo.program);
      twgl.setUniforms(brushProgramInfo, {
        u_color: paintOptions.color,
      });

      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(
        scissorRect.x,
        scissorRect.y,
        scissorRect.width,
        scissorRect.height,
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
      gl.useProgram(eraserProgramInfo.program);

      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(
        scissorRect.x,
        scissorRect.y,
        scissorRect.width,
        scissorRect.height,
      );

      gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.layerFBO);
      gl.viewport(0, 0, paintOptions.width, paintOptions.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disable(gl.SCISSOR_TEST);

      renderingManager.render(scissorRect);
    },
    end(toolId) {
      // end할때 스플라인 마지막 곡선 그리기
      let rect = pathRenderer.end();
      if (rect) {
        scissorRect = rect; // brush/eraser 렌더 영역으로 사용
        if (toolId == "brush") {
          this.brush();
        } else if (toolId == "eraser") {
          this.eraser();
        }
      }

      scissorRect = null;

      // 기존 end 함수들
      const strokeRect = pathRenderer.getStrokeDirtyRect();
      if (strokeRect.isEmpty()) {
        return;
      }
      const { before, after } = sourceTextureManager.upload(
        strokeRect.x,
        strokeRect.y,
        strokeRect.width,
        strokeRect.height,
      );

      // 바이트 크기 계산 (RGBA 4바이트, undo용과 redo용 두 개)
      const byteSize = strokeRect.width * strokeRect.height * 4 * 2;

      const newHistory = new HistoryObject({
        undo: async () => {
          await before.apply();
          await renderingManager.render();
          return { toolState: { tool: "brush" } };
        },
        redo: async () => {
          await after.apply();
          await renderingManager.render();
          return { toolState: { tool: "brush" } };
        },
        byteSize,
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
