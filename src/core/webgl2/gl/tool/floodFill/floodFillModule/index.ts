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

  fill(point: FloodFillPoint): FloodFillRect | null {
    const seedPoint = pointRect(point, this.width, this.height);
    if (seedPoint.width === 0 || seedPoint.height === 0) return null;
    if (this.alpha === 0) return null;

    const pixels = this.readResult();
    const seedRaw = this.readPixel(pixels, seedPoint.x, seedPoint.y);
    const seedStraight = toStraightPixel(seedRaw);
    const seedLab = rgbToOklab(seedStraight);
    const fillColor = this.getFillColor();
    const visited = new Uint8Array(this.width * this.height);
    const queued = new Uint8Array(this.width * this.height);
    const queue: FloodFillPoint[] = [];

    this.dirtyRect = null;
    this.enqueue(queue, queued, seedPoint.x, seedPoint.y);

    while (queue.length > 0) {
      const current = queue.pop()!;
      if (!this.canFill(pixels, visited, current.x, current.y, seedRaw, seedStraight, seedLab)) {
        continue;
      }

      let left = current.x;
      while (left - 1 >= 0 && this.canFill(pixels, visited, left - 1, current.y, seedRaw, seedStraight, seedLab)) {
        left--;
      }

      let right = current.x;
      while (
        right + 1 < this.width &&
        this.canFill(pixels, visited, right + 1, current.y, seedRaw, seedStraight, seedLab)
      ) {
        right++;
      }

      for (let x = left; x <= right; x++) {
        const changed = this.writePixel(pixels, visited, x, current.y, fillColor);
        if (changed) {
          this.dirtyRect = unionRect(this.dirtyRect, pointRect({ x, y: current.y }, this.width, this.height));
        }

        this.enqueueIfFillable(queue, queued, pixels, visited, x, current.y - 1, seedRaw, seedStraight, seedLab);
        this.enqueueIfFillable(queue, queued, pixels, visited, x, current.y + 1, seedRaw, seedStraight, seedLab);
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

  private readPixel(pixels: Uint8Array, x: number, y: number) {
    const index = this.pixelIndex(x, y);
    return {
      r: pixels[index],
      g: pixels[index + 1],
      b: pixels[index + 2],
      a: pixels[index + 3],
    };
  }

  private writePixel(pixels: Uint8Array, visited: Uint8Array, x: number, y: number, fillColor: FloodFillColorByte) {
    const visitIndex = y * this.width + x;
    const index = this.pixelIndex(x, y);
    visited[visitIndex] = 1;

    const inverseAlpha = 1 - this.alpha;
    const r = Math.round(fillColor.r * this.alpha + pixels[index] * inverseAlpha);
    const g = Math.round(fillColor.g * this.alpha + pixels[index + 1] * inverseAlpha);
    const b = Math.round(fillColor.b * this.alpha + pixels[index + 2] * inverseAlpha);
    const a = Math.round((this.alpha + (pixels[index + 3] / 255) * inverseAlpha) * 255);

    if (pixels[index] === r && pixels[index + 1] === g && pixels[index + 2] === b && pixels[index + 3] === a) {
      return false;
    }

    pixels[index] = r;
    pixels[index + 1] = g;
    pixels[index + 2] = b;
    pixels[index + 3] = a;
    return true;
  }

  private canFill(
    pixels: Uint8Array,
    visited: Uint8Array,
    x: number,
    y: number,
    seedRaw: FloodFillRawPixel,
    seedStraight: FloodFillStraightPixel,
    seedLab: FloodFillLab,
  ) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;

    const visitIndex = y * this.width + x;
    if (visited[visitIndex]) return false;

    const pixel = this.readPixel(pixels, x, y);
    return this.isSimilar(pixel, seedRaw, seedStraight, seedLab);
  }

  private enqueueIfFillable(
    queue: FloodFillPoint[],
    queued: Uint8Array,
    pixels: Uint8Array,
    visited: Uint8Array,
    x: number,
    y: number,
    seedRaw: FloodFillRawPixel,
    seedStraight: FloodFillStraightPixel,
    seedLab: FloodFillLab,
  ) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;

    const queueIndex = y * this.width + x;
    if (queued[queueIndex]) return;
    if (!this.canFill(pixels, visited, x, y, seedRaw, seedStraight, seedLab)) {
      return;
    }

    this.enqueue(queue, queued, x, y);
  }

  private enqueue(queue: FloodFillPoint[], queued: Uint8Array, x: number, y: number) {
    const queueIndex = y * this.width + x;
    queued[queueIndex] = 1;
    queue.push({ x, y });
  }

  private isSimilar(
    pixel: FloodFillRawPixel,
    seedRaw: FloodFillRawPixel,
    seedStraight: FloodFillStraightPixel,
    seedLab: FloodFillLab,
  ) {
    if (this.tolerance === 0) {
      return pixel.r === seedRaw.r && pixel.g === seedRaw.g && pixel.b === seedRaw.b && pixel.a === seedRaw.a;
    }

    const straightPixel = toStraightPixel(pixel);
    const pixelLab = rgbToOklab(straightPixel);
    const dl = pixelLab.l - seedLab.l;
    const da = pixelLab.a - seedLab.a;
    const db = pixelLab.b - seedLab.b;
    return (
      dl * dl + da * da + db * db <= this.toleranceSq && Math.abs(straightPixel.a - seedStraight.a) <= this.tolerance
    );
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
    const yOffset = this.height - rect.y - rect.height;

    for (let row = 0; row < rect.height; row++) {
      const sourceStart = ((yOffset + row) * this.width + rect.x) * 4;
      const targetStart = row * rect.width * 4;
      rectPixels.set(pixels.subarray(sourceStart, sourceStart + rect.width * 4), targetStart);
    }

    return rectPixels;
  }

  private writeRect(rect: FloodFillRect, pixels: Uint8Array) {
    const gl = this.gl;
    const yOffset = this.height - rect.y - rect.height;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.options.resultTexture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, rect.x, yOffset, rect.width, rect.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  }

  private pixelIndex(x: number, y: number) {
    const row = this.height - y - 1;
    return (row * this.width + x) * 4;
  }
}

interface FloodFillRawPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface FloodFillStraightPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface FloodFillColorByte {
  r: number;
  g: number;
  b: number;
}

interface FloodFillLab {
  l: number;
  a: number;
  b: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toStraightPixel(pixel: FloodFillRawPixel): FloodFillStraightPixel {
  if (pixel.a === 0) {
    return {
      r: 0,
      g: 0,
      b: 0,
      a: 0,
    };
  }

  const factor = 255 / pixel.a;
  return {
    r: clamp(pixel.r * factor, 0, 255),
    g: clamp(pixel.g * factor, 0, 255),
    b: clamp(pixel.b * factor, 0, 255),
    a: pixel.a / 255,
  };
}

function rgbToOklab(pixel: FloodFillStraightPixel): FloodFillLab {
  const r = srgbToLinear(pixel.r / 255);
  const g = srgbToLinear(pixel.g / 255);
  const b = srgbToLinear(pixel.b / 255);

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
