import { pointRect, unionRect } from "./rect";
import type { FloodFillPoint, FloodFillRect } from "./rect";

export type { FloodFillPoint, FloodFillRect } from "./rect";

export type FloodFillColor = [number, number, number];

export interface CreateFloodFillOptions {
  imageTexture: WebGLTexture;
  resultTexture: WebGLTexture;
  width: number;
  height: number;
}

export function createFloodFill(gl: WebGL2RenderingContext, options: CreateFloodFillOptions) {
  return new FloodFill(gl, options);
}

class FloodFill {
  private width: number;
  private height: number;
  private tolerance = 0;
  private toleranceSq = 0;
  private alpha = 1;
  private replace = false;
  private color: FloodFillColor = [1, 0, 0];
  private dirtyRect: FloodFillRect | null = null;

  private resultFBO: WebGLFramebuffer;

  constructor(
    private gl: WebGL2RenderingContext,
    private options: CreateFloodFillOptions,
  ) {
    this.width = options.width;
    this.height = options.height;
    this.createFramebuffers();
    this.setTextureSize(options.width, options.height);
  }

  setTolerance(tolerance: number) {
    this.tolerance = Math.max(0, Math.min(1, tolerance));
    this.toleranceSq = this.tolerance * this.tolerance;
  }

  setAlpha(alpha: number) {
    this.alpha = Math.max(0, Math.min(1, alpha));
  }

  setColor(color: FloodFillColor) {
    this.color = color;
  }

  setReplace(replace: boolean) {
    this.replace = replace;
  }

  fill(point: FloodFillPoint): FloodFillRect | null {
    const seedPoint = pointRect(point, this.width, this.height);
    if (seedPoint.width === 0 || seedPoint.height === 0) return null;
    // replace 모드의 alpha 0은 "투명으로 교체"(영역 지우기)라 유효한 동작이다.
    if (this.alpha === 0 && !this.replace) return null;

    const pixels = this.readResult();
    const seedIndex = this.pixelIndex(seedPoint.x, seedPoint.y);
    const seed = this.readSeed(pixels, seedIndex);
    const fillColor = this.getFillColor();
    const visited = new Uint8Array(this.width * this.height);
    const queued = new Uint8Array(this.width * this.height);
    const queue: FloodFillPoint[] = [];

    this.dirtyRect = null;
    this.enqueue(queue, queued, seedPoint.x, seedPoint.y);

    while (queue.length > 0) {
      const current = queue.pop()!;
      if (!this.canFill(pixels, visited, current.x, current.y, seed)) {
        continue;
      }

      let left = current.x;
      while (left - 1 >= 0 && this.canFill(pixels, visited, left - 1, current.y, seed)) {
        left--;
      }

      let right = current.x;
      while (right + 1 < this.width && this.canFill(pixels, visited, right + 1, current.y, seed)) {
        right++;
      }

      for (let x = left; x <= right; x++) {
        const changed = this.writePixel(pixels, visited, x, current.y, fillColor);
        if (changed) {
          this.dirtyRect = unionRect(this.dirtyRect, pointRect({ x, y: current.y }, this.width, this.height));
        }

        this.enqueueIfFillable(queue, queued, pixels, visited, x, current.y - 1, seed);
        this.enqueueIfFillable(queue, queued, pixels, visited, x, current.y + 1, seed);
      }
    }
    const rect = this.dirtyRect;
    if (!rect || rect.width === 0 || rect.height === 0) {
      this.dirtyRect = null;
      return null;
    }

    const after = this.copyRect(pixels, rect);
    this.writeRect(rect, after);
    this.dirtyRect = null;
    return rect;
  }

  destroy() {
    const gl = this.gl;

    gl.deleteFramebuffer(this.resultFBO);
  }

  private createFramebuffers() {
    const gl = this.gl;

    this.resultFBO = gl.createFramebuffer()!;
  }

  private setTextureSize(width: number, height: number) {
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.options.resultTexture, 0);

    this.width = width;
    this.height = height;
  }

  private readResult() {
    const gl = this.gl;
    const previousReadFramebuffer = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
    const pixels = new Uint8Array(this.width * this.height * 4);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.resultFBO);
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previousReadFramebuffer);
    return pixels;
  }

  private readSeed(pixels: Uint8Array, index: number): FloodFillSeed {
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const a = pixels[index + 3];
    const straight = toStraightComponents(r, g, b, a);
    const lab = rgbToOklabComponents(straight.r, straight.g, straight.b);
    return {
      rawR: r,
      rawG: g,
      rawB: b,
      rawA: a,
      straightA: straight.a,
      labL: lab.l,
      labA: lab.a,
      labB: lab.b,
    };
  }

  private writePixel(pixels: Uint8Array, visited: Uint8Array, x: number, y: number, fillColor: FloodFillColorByte) {
    const visitIndex = y * this.width + x;
    const index = this.pixelIndex(x, y);
    visited[visitIndex] = 1;

    let r: number, g: number, b: number, a: number;
    if (this.replace) {
      // 색 교체 모드: 기존 픽셀과 합성하지 않고 (color, alpha)를 premultiplied로 그대로 기록한다.
      r = Math.round(fillColor.r * this.alpha);
      g = Math.round(fillColor.g * this.alpha);
      b = Math.round(fillColor.b * this.alpha);
      a = Math.round(this.alpha * 255);
    } else {
      const inverseAlpha = 1 - this.alpha;
      r = Math.round(fillColor.r * this.alpha + pixels[index] * inverseAlpha);
      g = Math.round(fillColor.g * this.alpha + pixels[index + 1] * inverseAlpha);
      b = Math.round(fillColor.b * this.alpha + pixels[index + 2] * inverseAlpha);
      a = Math.round((this.alpha + (pixels[index + 3] / 255) * inverseAlpha) * 255);
    }

    if (pixels[index] === r && pixels[index + 1] === g && pixels[index + 2] === b && pixels[index + 3] === a) {
      return false;
    }

    pixels[index] = r;
    pixels[index + 1] = g;
    pixels[index + 2] = b;
    pixels[index + 3] = a;
    return true;
  }

  private canFill(pixels: Uint8Array, visited: Uint8Array, x: number, y: number, seed: FloodFillSeed) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;

    const visitIndex = y * this.width + x;
    if (visited[visitIndex]) return false;

    return this.isSimilarAtIndex(pixels, this.pixelIndex(x, y), seed);
  }

  private enqueueIfFillable(
    queue: FloodFillPoint[],
    queued: Uint8Array,
    pixels: Uint8Array,
    visited: Uint8Array,
    x: number,
    y: number,
    seed: FloodFillSeed,
  ) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;

    const queueIndex = y * this.width + x;
    if (queued[queueIndex]) return;
    if (!this.canFill(pixels, visited, x, y, seed)) {
      return;
    }

    this.enqueue(queue, queued, x, y);
  }

  private enqueue(queue: FloodFillPoint[], queued: Uint8Array, x: number, y: number) {
    const queueIndex = y * this.width + x;
    queued[queueIndex] = 1;
    queue.push({ x, y });
  }

  private isSimilarAtIndex(pixels: Uint8Array, index: number, seed: FloodFillSeed) {
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const a = pixels[index + 3];

    if (this.tolerance === 0) {
      return r === seed.rawR && g === seed.rawG && b === seed.rawB && a === seed.rawA;
    }

    const straight = toStraightComponents(r, g, b, a);
    const lab = rgbToOklabComponents(straight.r, straight.g, straight.b);
    const dl = lab.l - seed.labL;
    const da = lab.a - seed.labA;
    const db = lab.b - seed.labB;
    return dl * dl + da * da + db * db <= this.toleranceSq && Math.abs(straight.a - seed.straightA) <= this.tolerance;
  }

  private measureRgbaDistanceFill(pixels: Uint8Array, seedPoint: FloodFillRect, seed: FloodFillSeed) {
    const visited = new Uint8Array(this.width * this.height);
    const queued = new Uint8Array(this.width * this.height);
    const queue: FloodFillPoint[] = [];

    this.enqueue(queue, queued, seedPoint.x, seedPoint.y);

    const start = performance.now();
    while (queue.length > 0) {
      const current = queue.pop()!;
      if (!this.canFillRgbaDistance(pixels, visited, current.x, current.y, seed)) {
        continue;
      }

      let left = current.x;
      while (left - 1 >= 0 && this.canFillRgbaDistance(pixels, visited, left - 1, current.y, seed)) {
        left--;
      }

      let right = current.x;
      while (right + 1 < this.width && this.canFillRgbaDistance(pixels, visited, right + 1, current.y, seed)) {
        right++;
      }

      for (let x = left; x <= right; x++) {
        visited[current.y * this.width + x] = 1;
        this.enqueueRgbaIfFillable(queue, queued, pixels, visited, x, current.y - 1, seed);
        this.enqueueRgbaIfFillable(queue, queued, pixels, visited, x, current.y + 1, seed);
      }
    }

    return performance.now() - start;
  }

  private canFillRgbaDistance(pixels: Uint8Array, visited: Uint8Array, x: number, y: number, seed: FloodFillSeed) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;

    const visitIndex = y * this.width + x;
    if (visited[visitIndex]) return false;

    return this.isSimilarRgbaDistanceAtIndex(pixels, this.pixelIndex(x, y), seed);
  }

  private enqueueRgbaIfFillable(
    queue: FloodFillPoint[],
    queued: Uint8Array,
    pixels: Uint8Array,
    visited: Uint8Array,
    x: number,
    y: number,
    seed: FloodFillSeed,
  ) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;

    const queueIndex = y * this.width + x;
    if (queued[queueIndex]) return;
    if (!this.canFillRgbaDistance(pixels, visited, x, y, seed)) return;

    this.enqueue(queue, queued, x, y);
  }

  private isSimilarRgbaDistanceAtIndex(pixels: Uint8Array, index: number, seed: FloodFillSeed) {
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const a = pixels[index + 3];

    if (this.tolerance === 0) {
      return r === seed.rawR && g === seed.rawG && b === seed.rawB && a === seed.rawA;
    }

    const dr = (r - seed.rawR) / 255;
    const dg = (g - seed.rawG) / 255;
    const db = (b - seed.rawB) / 255;
    const da = (a - seed.rawA) / 255;
    return dr * dr + dg * dg + db * db + da * da <= this.toleranceSq;
  }

  private getFillColor(): FloodFillColorByte {
    return {
      r: Math.round(clamp(this.color[0], 0, 1) * 255),
      g: Math.round(clamp(this.color[1], 0, 1) * 255),
      b: Math.round(clamp(this.color[2], 0, 1) * 255),
    };
  }

  private copyRect(pixels: Uint8Array, rect: FloodFillRect) {
    const rectPixels = new Uint8Array(rect.width * rect.height * 4);

    for (let row = 0; row < rect.height; row++) {
      const sourceStart = ((rect.y + row) * this.width + rect.x) * 4;
      const targetStart = row * rect.width * 4;
      rectPixels.set(pixels.subarray(sourceStart, sourceStart + rect.width * 4), targetStart);
    }

    return rectPixels;
  }

  private writeRect(rect: FloodFillRect, pixels: Uint8Array) {
    const gl = this.gl;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.options.resultTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, rect.x, rect.y, rect.width, rect.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  }

  private pixelIndex(x: number, y: number) {
    return (y * this.width + x) * 4;
  }
}

interface FloodFillColorByte {
  r: number;
  g: number;
  b: number;
}

interface FloodFillSeed {
  rawR: number;
  rawG: number;
  rawB: number;
  rawA: number;
  straightA: number;
  labL: number;
  labA: number;
  labB: number;
}

interface FloodFillLab {
  l: number;
  a: number;
  b: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toStraightComponents(r: number, g: number, b: number, a: number) {
  if (a === 0) {
    return {
      r: 0,
      g: 0,
      b: 0,
      a: 0,
    };
  }

  const factor = 255 / a;
  return {
    r: clamp(r * factor, 0, 255),
    g: clamp(g * factor, 0, 255),
    b: clamp(b * factor, 0, 255),
    a: a / 255,
  };
}

function rgbToOklabComponents(red: number, green: number, blue: number): FloodFillLab {
  const r = srgbToLinear(red / 255);
  const g = srgbToLinear(green / 255);
  const b = srgbToLinear(blue / 255);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function srgbToLinear(value: number) {
  if (value <= 0.04045) {
    return value / 12.92;
  }

  return ((value + 0.055) / 1.055) ** 2.4;
}
