import { createShader, createProgram, getGlHelper } from "../utils/glHelper";
import { getRenderingManager } from "../render";
import {
  TEXTURE_UNIT,
  getSourceTextureManager,
  paintOptions,
} from "../texture";
import { getLayerManager } from "../layer";
import { getBufferManager, getFullQuadShader } from "../vertexShader";
import { getManager } from "../../../utils/cachedManager";
import { getHistoryManager, HistoryObject } from "../history/history";
import { DirtyRectRecorder, Rect } from "@/core/utils/rect";
import { Pointer } from "@/core/types";
import { calculateTangents, hermite } from "@/core/utils/spline";

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

  let splineAlphaBackend = new SplineAlphaBackend(gl, pathTex);

  let brushManager = {
    enter() {},
    start(pointer: Pointer) {
      splineAlphaBackend.resetWorkSpace(
        paintOptions.width,
        paintOptions.height
      );
      scissorRect = null;

      splineAlphaBackend.start(pointer);

      // CPU/GPU 알파 초기화(새 스트로크 시작 시)
    },
    stroke(start: Pointer, end: Pointer) {
      // 스플라인 포인트 누적: 기존 API 유지(매 프레임 end만 추가)
      let rect = splineAlphaBackend.stroke(start, end);
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
      let rect = splineAlphaBackend.end();
      if (rect) {
        scissorRect = rect; // brush/eraser 렌더 영역으로 사용
        this.brush();
      }

      scissorRect = null;

      // 기존 end 함수들
      const strokeRect = splineAlphaBackend.getStrokeDirtyRect();
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
      splineAlphaBackend.cancel();
      splineAlphaBackend.resetWorkSpace(
        paintOptions.width,
        paintOptions.height
      );
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
      splineAlphaBackend.resetWorkSpace(width, height);
    },
  };

  brushManager.setSize();

  return brushManager;
}

// pathTex만을 원하는대로 만들어드립니다!!
class SplineAlphaBackend {
  gl: WebGL2RenderingContext;
  pathTex;
  points: Pointer[];

  tempCanvas: OffscreenCanvas | HTMLCanvasElement;
  tempCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  alphaCPU: Uint8Array; // PATHMAP(R8)에 대응하는 0~255 알파 버퍼
  strokeDirtyRecorder: DirtyRectRecorder;

  constructor(gl, pathTex) {
    this.gl = gl;
    this.pathTex = pathTex;
  }

  resetWorkSpace(w: number, h: number) {
    this.clearAlpha(w, h);
    this.ensureTempCanvasSize(w, h);
  }

  start(pointer) {
    this.points = [];
    this.points.push(pointer);
    this.strokeDirtyRecorder = DirtyRectRecorder.clampedRect(
      0,
      0,
      paintOptions.width,
      paintOptions.height
    );
    this.strokeDirtyRecorder.updatePointer(pointer, paintOptions.radius);
  }

  stroke(start, end): Rect | null {
    this.points.push(end);

    // 스플라인을 tempCanvas에 그림 → 더티 사각형 산출
    const rect = this.drawSplineToTemp(this.points, "incremental");
    if (!rect) return null;

    // tempCanvas 알파 → CPU alphaCPU에 max 병합 → PATHMAP에 서브업로드
    this.mergeAlphaFromTempAndUpload(rect);

    return rect;
  }

  end(): Rect | null {
    const rect = this.drawSplineToTemp(this.points, "final");
    if (!rect) return null;

    // tempCanvas 알파 → CPU alphaCPU에 max 병합 → PATHMAP에 서브업로드
    this.mergeAlphaFromTempAndUpload(rect);

    this.points = [];

    return rect;
  }

  cancel() {
    this.points = [];
  }

  getStrokeDirtyRect() {
    const strokeRect = this.strokeDirtyRecorder.generateRect();
    return strokeRect;
  }

  private drawSplineToTemp(
    points: Pointer[],
    mode: "incremental" | "final"
  ): Rect | null {
    let tempCtx = this.tempCtx;

    const w = paintOptions.width,
      h = paintOptions.height;
    tempCtx.clearRect(0, 0, w, h);

    const sliced = points.slice(-4);
    const tangents = calculateTangents(sliced);

    tempCtx.strokeStyle = "black";
    const diameter = paintOptions.radius * 2;
    tempCtx.lineWidth = diameter;
    tempCtx.lineCap = "round";
    tempCtx.lineJoin = "round";
    tempCtx.beginPath();

    let dirty = DirtyRectRecorder.clampedRect(0, 0, w, h);

    if (sliced.length == 0) {
      throw Error("points가 비었는데, 호출됌!!");
    }
    if (sliced.length === 1) {
      const p = sliced[0];
      this.strokeDirtyRecorder.updatePointer(p, paintOptions.radius);
      dirty.updatePointer(p, diameter / 2);
      tempCtx.moveTo(p.x, p.y);
      tempCtx.lineTo(p.x, p.y);
      tempCtx.stroke();
      return dirty.generateRect();
    }

    for (let i = 0; i < sliced.length - 1; i++) {
      const p0 = sliced[i],
        p1 = sliced[i + 1];
      const v0 = tangents[i],
        v1 = tangents[i + 1];

      const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const steps = Math.max(1, (dist | 0) >> 1);
      const step = 1.0 / steps;

      const shouldDraw =
        mode === "incremental"
          ? i === sliced.length - 3
          : i === sliced.length - 2;

      if (shouldDraw) {
        let first = true;

        for (let t = 0; t <= 1.0001; t += step) {
          const p = hermite(t, p0, p1, v0, v1);
          this.strokeDirtyRecorder.updatePointer(p, paintOptions.radius);
          dirty.updatePointer(p, diameter / 2);
          if (first) {
            tempCtx.moveTo(p.x, p.y);
            first = false;
          }
          tempCtx.lineTo(p.x, p.y);
        }
      }
    }

    tempCtx.stroke();

    // 이 경우는, 포인트가 아직 두개인데, 그리는 중일 때..!!
    if (!dirty.hasBeenDirty()) {
      return null;
    }
    return dirty.generateRect();
  }

  private mergeAlphaFromTempAndUpload(rect: Rect) {
    let alphaCPU = this.alphaCPU;
    let gl = this.gl;
    let pathTex = this.pathTex;

    let tempCtx = this.tempCtx;

    if (rect.isEmpty()) return;
    const { startX, startY, endX, endY, width, height } = rect.toData();

    // tempCtx → ImageData(알파 채널만 사용)
    const img = tempCtx.getImageData(startX, startY, width, height).data;

    // CPU 누적(max) & 업로드 버퍼 구성 (paintOptions.alpha를 PATHMAP에 bake)
    const out = new Uint8Array(width * height);
    const W = paintOptions.width;

    let k = 0;
    for (let y = startY; y <= endY; y++) {
      let rowBase = y * W;
      for (let x = startX; x <= endX; x++) {
        const idxImg = ((y - startY) * width + (x - startX)) * 4;
        const aByte = img[idxImg + 3]; // 0..255
        const baked = Math.min(255, Math.round(aByte * paintOptions.alpha));
        const cpuIdx = rowBase + x;
        const merged = baked > alphaCPU[cpuIdx] ? baked : alphaCPU[cpuIdx];
        alphaCPU[cpuIdx] = merged;
        out[k++] = merged;
      }
    }

    // GPU PATHMAP에 서브업로드
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.PATHMAP);
    gl.bindTexture(gl.TEXTURE_2D, pathTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      startX,
      startY,
      width,
      height,
      gl.RED,
      gl.UNSIGNED_BYTE,
      out
    );
  }

  private ensureTempCanvasSize(w: number, h: number) {
    // OffscreenCanvas 우선, 없으면 숨김 canvas
    if (typeof OffscreenCanvas !== "undefined") {
      if (!(this.tempCanvas instanceof OffscreenCanvas)) {
        this.tempCanvas = new OffscreenCanvas(w, h);
      }
      this.tempCanvas.width = w;
      this.tempCanvas.height = h;
      this.tempCtx = (this.tempCanvas as OffscreenCanvas).getContext("2d")!;
    } else {
      if (!this.tempCanvas) this.tempCanvas = document.createElement("canvas");
      this.tempCanvas.width = w;
      (this.tempCanvas as HTMLCanvasElement).height = h;
      this.tempCtx = (this.tempCanvas as HTMLCanvasElement).getContext("2d")!;
    }
    this.tempCtx.imageSmoothingEnabled = false;
  }

  private clearAlpha(w, h) {
    let gl = this.gl;
    let pathTex = this.pathTex;

    this.alphaCPU = new Uint8Array(w * h); // 0으로 초기화

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.PATHMAP);
    gl.bindTexture(gl.TEXTURE_2D, pathTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      w,
      h,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      null
    );
  }
}
