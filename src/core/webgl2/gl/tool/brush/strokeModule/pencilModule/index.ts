const ALPHA_MAP_TEXTURE_UNIT = 3;

export interface PencilPoint {
  x: number;
  y: number;
}

export interface PencilRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CreatePencilOptions {
  alphaMapTexture: WebGLTexture;
  width: number;
  height: number;
}

interface MaskPoint {
  x: number;
  y: number;
}

export function createPencil(
  gl: WebGL2RenderingContext,
  options: CreatePencilOptions,
) {
  return new Pencil(gl, options);
}

export function bresenhamLine(
  start: PencilPoint,
  end: PencilPoint,
): PencilPoint[] {
  const points: PencilPoint[] = [];
  let x0 = Math.round(start.x);
  let y0 = Math.round(start.y);
  const x1 = Math.round(end.x);
  const y1 = Math.round(end.y);
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let error = dx - dy;

  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;

    const error2 = error * 2;
    if (error2 > -dy) {
      error -= dy;
      x0 += sx;
    }
    if (error2 < dx) {
      error += dx;
      y0 += sy;
    }
  }

  return points;
}

export function createPencilMask(diameter: number): MaskPoint[] {
  const size = Math.max(1, Math.round(diameter));
  const center = (size - 1) / 2;
  const radius = Math.max(Math.SQRT1_2, size / 2 - 0.4);
  const radiusSq = radius * radius;
  const offset = Math.floor(size / 2);
  const points: MaskPoint[] = [];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - center;
      const dy = y - center;
      if (dx * dx + dy * dy <= radiusSq) {
        points.push({ x: x - offset, y: y - offset });
      }
    }
  }

  return points;
}

class Pencil {
  private readonly width: number;
  private readonly height: number;
  private alpha = 1;
  private diameter = 1;
  private mask = createPencilMask(1);
  private lastPoint: PencilPoint | null = null;
  private strokeRect: PencilRect | null = null;

  constructor(
    private gl: WebGL2RenderingContext,
    private options: CreatePencilOptions,
  ) {
    this.width = options.width;
    this.height = options.height;
    this.ensureAlphaMapTextureSize();
  }

  setAlpha(alpha: number) {
    this.alpha = Math.max(0, Math.min(1, alpha));
  }

  setDiameter(diameter: number) {
    this.diameter = Math.max(1, Math.round(diameter));
    this.mask = createPencilMask(this.diameter);
  }

  start(point: PencilPoint): PencilRect | null {
    this.lastPoint = toPixelPoint(point);
    this.strokeRect = null;
    return this.stamp(this.lastPoint);
  }

  move(point: PencilPoint): PencilRect | null {
    const end = toPixelPoint(point);
    if (!this.lastPoint) {
      this.start(end);
      return this.strokeRect;
    }

    const points = bresenhamLine(this.lastPoint, end);
    let dirtyRect: PencilRect | null = null;
    for (const linePoint of points) {
      dirtyRect = unionNullableRect(dirtyRect, this.stamp(linePoint));
    }

    this.lastPoint = end;
    return dirtyRect;
  }

  end(): PencilRect | null {
    const rect = this.strokeRect;
    this.lastPoint = null;
    this.strokeRect = null;
    return rect;
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

  private stamp(point: PencilPoint): PencilRect | null {
    const alphaByte = Math.round(this.alpha * 255);
    const changedPixels: PencilPoint[] = [];
    let dirtyRect: PencilRect | null = null;

    for (const maskPoint of this.mask) {
      const x = point.x + maskPoint.x;
      const y = point.y + maskPoint.y;
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) continue;

      changedPixels.push({ x, y });
      const pixelRect = {
        x,
        y,
        width: 1,
        height: 1,
      };
      dirtyRect = unionRect(dirtyRect, pixelRect);
      this.strokeRect = unionRect(this.strokeRect, pixelRect);
    }

    if (changedPixels.length === 0) return null;
    this.uploadChangedPixels(changedPixels, alphaByte);
    return dirtyRect;
  }

  private uploadChangedPixels(pixels: PencilPoint[], alphaByte: number) {
    this.gl.activeTexture(this.gl.TEXTURE0 + ALPHA_MAP_TEXTURE_UNIT);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.options.alphaMapTexture);
    this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);

    for (const pixel of pixels) {
      this.gl.texSubImage2D(
        this.gl.TEXTURE_2D,
        0,
        pixel.x,
        pixel.y,
        1,
        1,
        this.gl.RED,
        this.gl.UNSIGNED_BYTE,
        new Uint8Array([alphaByte]),
      );
    }
  }
}

function toPixelPoint(point: PencilPoint): PencilPoint {
  return {
    x: Math.round(point.x),
    y: Math.round(point.y),
  };
}

function unionRect(a: PencilRect | null, b: PencilRect): PencilRect {
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

function unionNullableRect(
  a: PencilRect | null,
  b: PencilRect | null,
): PencilRect | null {
  if (!b) return a;
  return unionRect(a, b);
}
