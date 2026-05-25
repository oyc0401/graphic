import { calculateTangents, hermite } from "@/core/utils/spline";

const ALPHA_MAP_TEXTURE_UNIT = 3;

export interface SplinePoint {
  x: number;
  y: number;
}

export interface SplineRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CreateSplineOptions {
  alphaMapTexture: WebGLTexture;
  width: number;
  height: number;
}

export function createSpline(
  gl: WebGL2RenderingContext,
  options: CreateSplineOptions,
) {
  return new Spline(gl, options);
}

class Spline {
  private readonly width: number;
  private readonly height: number;
  private readonly alphaCPU: Uint8Array;
  private tempCanvas: OffscreenCanvas | HTMLCanvasElement;
  private tempCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  private points: SplinePoint[] = [];
  private strokeRect: SplineRect | null = null;
  private alpha = 1;
  private diameter = 1;

  constructor(
    private gl: WebGL2RenderingContext,
    private options: CreateSplineOptions,
  ) {
    this.width = options.width;
    this.height = options.height;
    this.alphaCPU = new Uint8Array(this.width * this.height);
    this.ensureAlphaMapTextureSize();
    this.ensureTempCanvasSize(this.width, this.height);
  }

  setAlpha(alpha: number) {
    this.alpha = Math.max(0, Math.min(1, alpha));
  }

  setDiameter(diameter: number) {
    this.diameter = Math.max(1, diameter);
  }

  start(point: SplinePoint): SplineRect | null {
    this.points = [point];
    this.strokeRect = null;
    this.alphaCPU.fill(0);
    const rect = this.drawSplineToTemp(this.points, "final");
    if (!rect) return null;

    this.mergeAlphaFromTempAndUpload(rect);
    this.strokeRect = unionRect(this.strokeRect, rect);
    return rect;
  }

  move(point: SplinePoint): SplineRect | null {
    if (this.points.length === 0) {
      return this.start(point);
    }

    this.points.push(point);
    const rect = this.drawSplineToTemp(this.points, "incremental");
    if (!rect) return null;

    this.mergeAlphaFromTempAndUpload(rect);
    this.strokeRect = unionRect(this.strokeRect, rect);
    return rect;
  }

  end(): SplineRect | null {
    if (this.points.length === 0) {
      return null;
    }

    const rect = this.drawSplineToTemp(this.points, "final");
    if (rect) {
      this.mergeAlphaFromTempAndUpload(rect);
      this.strokeRect = unionRect(this.strokeRect, rect);
    }

    const strokeRect = this.strokeRect;
    this.points = [];
    this.strokeRect = null;
    return strokeRect;
  }

  private ensureAlphaMapTextureSize() {
    this.gl.activeTexture(this.gl.TEXTURE0 + ALPHA_MAP_TEXTURE_UNIT);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.options.alphaMapTexture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.R8,
      this.width,
      this.height,
      0,
      this.gl.RED,
      this.gl.UNSIGNED_BYTE,
      null,
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.CLAMP_TO_EDGE,
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.CLAMP_TO_EDGE,
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.NEAREST,
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.NEAREST,
    );
  }

  private drawSplineToTemp(
    points: SplinePoint[],
    mode: "incremental" | "final",
  ): SplineRect | null {
    this.tempCtx.clearRect(0, 0, this.width, this.height);

    const sliced = points.slice(-4);
    const tangents = calculateTangents(sliced);
    const radius = this.diameter / 2;
    let dirtyRect: SplineRect | null = null;

    this.tempCtx.strokeStyle = "black";
    this.tempCtx.lineWidth = this.diameter;
    this.tempCtx.lineCap = "round";
    this.tempCtx.lineJoin = "round";
    this.tempCtx.beginPath();

    if (sliced.length === 0) {
      return null;
    }

    if (sliced.length === 1) {
      const p = sliced[0];
      dirtyRect = pointRect(p, radius, this.width, this.height);
      this.tempCtx.moveTo(p.x, p.y);
      this.tempCtx.lineTo(p.x, p.y);
      this.tempCtx.stroke();
      return dirtyRect;
    }

    for (let i = 0; i < sliced.length - 1; i += 1) {
      const p0 = sliced[i];
      const p1 = sliced[i + 1];
      const v0 = tangents[i];
      const v1 = tangents[i + 1];

      const shouldDraw =
        mode === "incremental"
          ? i === sliced.length - 3
          : i === sliced.length - 2;

      if (!shouldDraw) continue;

      const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const steps = Math.max(1, (dist | 0) >> 1);
      const step = 1.0 / steps;
      let first = true;

      for (let t = 0; t <= 1.0001; t += step) {
        const p = hermite(t, p0, p1, v0, v1);
        dirtyRect = unionRect(
          dirtyRect,
          pointRect(p, radius, this.width, this.height),
        );
        if (first) {
          this.tempCtx.moveTo(p.x, p.y);
          first = false;
        }
        this.tempCtx.lineTo(p.x, p.y);
      }
    }

    if (!dirtyRect) return null;

    this.tempCtx.stroke();
    return dirtyRect;
  }

  private mergeAlphaFromTempAndUpload(rect: SplineRect) {
    if (rect.width === 0 || rect.height === 0) return;

    const img = this.tempCtx.getImageData(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    ).data;
    const out = new Uint8Array(rect.width * rect.height);
    let outIndex = 0;

    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      const rowBase = y * this.width;
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        const imgIndex = ((y - rect.y) * rect.width + (x - rect.x)) * 4;
        const baked = Math.min(255, Math.round(img[imgIndex + 3] * this.alpha));
        const cpuIndex = rowBase + x;
        const merged = baked > this.alphaCPU[cpuIndex] ? baked : this.alphaCPU[cpuIndex];
        this.alphaCPU[cpuIndex] = merged;
        out[outIndex] = merged;
        outIndex += 1;
      }
    }

    this.gl.activeTexture(this.gl.TEXTURE0 + ALPHA_MAP_TEXTURE_UNIT);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.options.alphaMapTexture);
    this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);
    this.gl.texSubImage2D(
      this.gl.TEXTURE_2D,
      0,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      this.gl.RED,
      this.gl.UNSIGNED_BYTE,
      out,
    );
  }

  private ensureTempCanvasSize(w: number, h: number) {
    if (typeof OffscreenCanvas !== "undefined") {
      this.tempCanvas = new OffscreenCanvas(w, h);
      this.tempCtx = this.tempCanvas.getContext("2d")!;
    } else {
      this.tempCanvas = document.createElement("canvas");
      this.tempCanvas.width = w;
      this.tempCanvas.height = h;
      this.tempCtx = this.tempCanvas.getContext("2d")!;
    }
    this.tempCtx.imageSmoothingEnabled = false;
  }
}

function pointRect(
  point: SplinePoint,
  radius: number,
  width: number,
  height: number,
): SplineRect {
  return clampRect(
    Math.floor(point.x - radius),
    Math.floor(point.y - radius),
    Math.ceil(point.x + radius + 1),
    Math.ceil(point.y + radius + 1),
    width,
    height,
  );
}

function unionRect(a: SplineRect | null, b: SplineRect): SplineRect {
  if (!a) return b;

  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function clampRect(
  left: number,
  top: number,
  right: number,
  bottom: number,
  width: number,
  height: number,
): SplineRect {
  const x = clamp(left, 0, width);
  const y = clamp(top, 0, height);
  const ex = clamp(right, 0, width);
  const ey = clamp(bottom, 0, height);
  return {
    x,
    y,
    width: Math.max(0, ex - x),
    height: Math.max(0, ey - y),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
