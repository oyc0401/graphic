import { PathRenderer } from "./PathRenderer";
import { Pointer } from "@/core/types";
import { DirtyRectRecorder, Rect } from "@/core/utils/rect";
import { paintOptions } from "../../../texture";
import { calculateTangents, hermite } from "@/core/utils/spline";
import { TEXTURE_UNIT } from "../../../texture";

export class SplinePathRenderer extends PathRenderer {
  private tempCanvas: OffscreenCanvas | HTMLCanvasElement;
  private tempCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  private alphaCPU: Uint8Array;
  private strokeDirtyRecorder: DirtyRectRecorder;

  constructor(gl: WebGL2RenderingContext, pathTex: WebGLTexture) {
    super(gl, pathTex);
  }

  resetWorkSpace(w: number, h: number) {
    this.clearAlpha(w, h);
    this.ensureTempCanvasSize(w, h);
  }

  start(pointer: Pointer) {
    super.start(pointer);
    this.strokeDirtyRecorder = DirtyRectRecorder.clampedRect(
      0,
      0,
      paintOptions.width,
      paintOptions.height,
    );
    this.strokeDirtyRecorder.updatePointer(pointer, paintOptions.radius);
  }

  stroke(pointer: Pointer): Rect | null {
    super.stroke(pointer);

    const rect = this.drawSplineToTemp(this.points, "incremental");
    if (!rect) return null;

    this.mergeAlphaFromTempAndUpload(rect);

    return rect;
  }

  end(): Rect | null {
    const rect = this.drawSplineToTemp(this.points, "final");
    if (!rect) return null;

    this.mergeAlphaFromTempAndUpload(rect);

    super.end();
    return rect;
  }

  getStrokeDirtyRect() {
    const strokeRect = this.strokeDirtyRecorder.generateRect();
    return strokeRect;
  }

  private drawSplineToTemp(
    points: Pointer[],
    mode: "incremental" | "final",
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

    const img = tempCtx.getImageData(startX, startY, width, height).data;

    const out = new Uint8Array(width * height);
    const W = paintOptions.width;

    let k = 0;
    for (let y = startY; y <= endY; y++) {
      let rowBase = y * W;
      for (let x = startX; x <= endX; x++) {
        const idxImg = ((y - startY) * width + (x - startX)) * 4;
        const aByte = img[idxImg + 3];
        const baked = Math.min(255, Math.round(aByte * paintOptions.alpha));
        const cpuIdx = rowBase + x;
        const merged = baked > alphaCPU[cpuIdx] ? baked : alphaCPU[cpuIdx];
        alphaCPU[cpuIdx] = merged;
        out[k++] = merged;
      }
    }

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
      out,
    );
  }

  private ensureTempCanvasSize(w: number, h: number) {
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

  private clearAlpha(w: number, h: number) {
    super.clearPathTex(w, h);

    this.alphaCPU = new Uint8Array(w * h);
  }
}
