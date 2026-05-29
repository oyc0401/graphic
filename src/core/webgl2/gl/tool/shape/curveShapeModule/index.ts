import applyFrag from "./apply.frag?raw";

export type CurveShapeColor = [number, number, number, number];

export interface CurveShapePoint {
  x: number;
  y: number;
}

export interface CurveShapeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CreateCurveShapeOptions {
  shapeTexture: WebGLTexture;
  imageTexture: WebGLTexture;
  resultTexture: WebGLTexture;
  width: number;
  height: number;
}

type CachedShapeTexture = WebGLTexture & { shapeKey?: string };

interface NormalizedCurve {
  textureWidth: number;
  textureHeight: number;
  targetRect: CurveShapeRect;
  visibleRect: CurveShapeRect;
  curve: ResolvedCurvePoints;
}

interface ResolvedCurvePoints {
  p1: CurveShapePoint;
  p2: CurveShapePoint;
  c1: CurveShapePoint;
  c2: CurveShapePoint;
}

const TEXTURE_UNIT = {
  IMAGE: 0,
  SHAPE: 1,
};

const CURVE_SEGMENTS = 100;

const FULL_QUAD_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;

void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export function createCurveShape(gl: WebGL2RenderingContext, options: CreateCurveShapeOptions) {
  return new CurveShape(gl, options);
}

class CurveShape {
  private readonly shapeFramebuffer: WebGLFramebuffer;
  private readonly resultFramebuffer: WebGLFramebuffer;
  private readonly applyProgram: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private tempCanvas!: OffscreenCanvas | HTMLCanvasElement;
  private tempCtx!: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  private color: CurveShapeColor = [0, 0, 0, 1];
  private strokeWidth = 1;

  constructor(
    private gl: WebGL2RenderingContext,
    private options: CreateCurveShapeOptions,
  ) {
    this.initializeShapeTexture();
    this.shapeFramebuffer = this.createFramebuffer(options.shapeTexture);
    this.resultFramebuffer = this.createFramebuffer(options.resultTexture);
    this.applyProgram = createProgram(
      gl,
      createShader(gl, gl.VERTEX_SHADER, FULL_QUAD_VERTEX_SHADER),
      createShader(gl, gl.FRAGMENT_SHADER, applyFrag),
    );
    this.vao = this.createFullQuadVAO();
    this.ensureTempCanvasSize(options.width, options.height);
    this.bindApplyUniforms();
  }

  setColor(color: CurveShapeColor) {
    this.color = [...color];
  }

  setWidth(width: number) {
    this.strokeWidth = Math.max(1, width);
  }

  create(
    p1: CurveShapePoint,
    p2: CurveShapePoint,
    c1: CurveShapePoint | null,
    c2: CurveShapePoint | null,
  ): CurveShapeRect {
    const curve = resolveCurvePoints(p1, p2, c1, c2);
    const normalized = normalizeCurve(
      curve.p1,
      curve.p2,
      curve.c1,
      curve.c2,
      this.strokeWidth,
      this.options.width,
      this.options.height,
    );
    const key = this.createCurveKey(normalized);
    if (getShapeKey(this.options.shapeTexture) !== key) {
      this.clearShapeTexture();
      this.drawCurveToShapeTexture(curve, normalized);
      setShapeKey(this.options.shapeTexture, key);
    }
    return normalized.targetRect;
  }

  apply(rect: CurveShapeRect): CurveShapeRect {
    const targetRect = normalizeTargetRect(rect);
    const visibleRect = intersectRect(
      targetRect.x,
      targetRect.y,
      targetRect.x + targetRect.width,
      targetRect.y + targetRect.height,
      this.options.width,
      this.options.height,
    );
    const gl = this.gl;
    gl.useProgram(this.applyProgram);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.IMAGE);
    gl.bindTexture(gl.TEXTURE_2D, this.options.imageTexture);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SHAPE);
    gl.bindTexture(gl.TEXTURE_2D, this.options.shapeTexture);
    gl.uniform4f(
      gl.getUniformLocation(this.applyProgram, "u_targetRect"),
      targetRect.x,
      targetRect.y,
      targetRect.width,
      targetRect.height,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultFramebuffer);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(visibleRect.x, visibleRect.y, Math.max(0, visibleRect.width), Math.max(0, visibleRect.height));
    gl.viewport(0, 0, this.options.width, this.options.height);
    if (visibleRect.width > 0 && visibleRect.height > 0) {
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.disable(gl.SCISSOR_TEST);

    this.clearShapeTexture();
    return visibleRect;
  }

  destroy() {
    const gl = this.gl;
    gl.deleteFramebuffer(this.shapeFramebuffer);
    gl.deleteFramebuffer(this.resultFramebuffer);
    gl.deleteProgram(this.applyProgram);
    gl.deleteVertexArray(this.vao);
  }

  private bindApplyUniforms() {
    const gl = this.gl;
    gl.useProgram(this.applyProgram);
    gl.uniform1i(gl.getUniformLocation(this.applyProgram, "u_image"), TEXTURE_UNIT.IMAGE);
    gl.uniform1i(gl.getUniformLocation(this.applyProgram, "u_shape"), TEXTURE_UNIT.SHAPE);
    gl.uniform2f(gl.getUniformLocation(this.applyProgram, "u_resolution"), this.options.width, this.options.height);
  }

  private drawCurveToShapeTexture(curve: ResolvedCurvePoints, normalized: NormalizedCurve) {
    const dirtyRect = normalized.targetRect;
    this.ensureTempCanvasSize(dirtyRect.width, dirtyRect.height);
    this.tempCtx.clearRect(0, 0, dirtyRect.width, dirtyRect.height);
    this.tempCtx.strokeStyle = "black";
    this.tempCtx.lineWidth = this.strokeWidth;
    this.tempCtx.lineCap = "round";
    this.tempCtx.lineJoin = "round";
    this.tempCtx.beginPath();
    this.tempCtx.moveTo(normalized.curve.p1.x, normalized.curve.p1.y);

    for (let i = 1; i <= CURVE_SEGMENTS; i += 1) {
      const point = cubicBezier(i / CURVE_SEGMENTS, normalized.curve);
      this.tempCtx.lineTo(point.x, point.y);
    }

    this.tempCtx.stroke();
    this.uploadShapeTexture(dirtyRect.width, dirtyRect.height);
  }

  private uploadShapeTexture(width: number, height: number) {
    const img = this.tempCtx.getImageData(0, 0, width, height).data;
    const pixels = new Uint8Array(width * height * 4);

    for (let i = 0; i < width * height; i += 1) {
      const alpha = (img[i * 4 + 3] / 255) * this.color[3];
      pixels[i * 4] = Math.round(this.color[0] * alpha * 255);
      pixels[i * 4 + 1] = Math.round(this.color[1] * alpha * 255);
      pixels[i * 4 + 2] = Math.round(this.color[2] * alpha * 255);
      pixels[i * 4 + 3] = Math.round(alpha * 255);
    }

    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SHAPE);
    gl.bindTexture(gl.TEXTURE_2D, this.options.shapeTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  }

  private initializeShapeTexture() {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SHAPE);
    gl.bindTexture(gl.TEXTURE_2D, this.options.shapeTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      this.options.width,
      this.options.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  private clearShapeTexture() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shapeFramebuffer);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    setShapeKey(this.options.shapeTexture, "");
  }

  private createCurveKey(curve: NormalizedCurve) {
    return [
      "curve",
      curve.textureWidth,
      curve.textureHeight,
      curve.curve.p1.x,
      curve.curve.p1.y,
      curve.curve.p2.x,
      curve.curve.p2.y,
      curve.curve.c1.x,
      curve.curve.c1.y,
      curve.curve.c2.x,
      curve.curve.c2.y,
      this.strokeWidth,
      this.color[0],
      this.color[1],
      this.color[2],
      this.color[3],
    ].join(":");
  }

  private ensureTempCanvasSize(width: number, height: number) {
    if (this.tempCanvas && this.tempCanvas.width >= width && this.tempCanvas.height >= height) {
      return;
    }

    if (typeof OffscreenCanvas !== "undefined") {
      this.tempCanvas = new OffscreenCanvas(width, height);
      this.tempCtx = this.tempCanvas.getContext("2d")!;
    } else {
      this.tempCanvas = document.createElement("canvas");
      this.tempCanvas.width = width;
      this.tempCanvas.height = height;
      this.tempCtx = this.tempCanvas.getContext("2d")!;
    }
    this.tempCtx.imageSmoothingEnabled = false;
  }

  private createFramebuffer(texture: WebGLTexture) {
    const framebuffer = this.gl.createFramebuffer();
    if (!framebuffer) {
      throw new Error("Failed to create curve shape framebuffer.");
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, texture, 0);
    if (this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) !== this.gl.FRAMEBUFFER_COMPLETE) {
      throw new Error("Curve shape framebuffer is incomplete.");
    }
    return framebuffer;
  }

  private createFullQuadVAO() {
    const buffer = this.gl.createBuffer();
    const vao = this.gl.createVertexArray();
    if (!buffer || !vao) {
      throw new Error("Failed to create curve shape full quad.");
    }

    this.gl.bindVertexArray(vao);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      this.gl.STATIC_DRAW,
    );

    const position = this.gl.getAttribLocation(this.applyProgram, "a_position");
    this.gl.enableVertexAttribArray(position);
    this.gl.vertexAttribPointer(position, 2, this.gl.FLOAT, false, 0, 0);
    return vao;
  }
}

function getShapeKey(texture: WebGLTexture) {
  return (texture as CachedShapeTexture).shapeKey ?? "";
}

function setShapeKey(texture: WebGLTexture, key: string) {
  (texture as CachedShapeTexture).shapeKey = key;
}

function resolveCurvePoints(
  p1: CurveShapePoint,
  p2: CurveShapePoint,
  c1: CurveShapePoint | null,
  c2: CurveShapePoint | null,
) {
  if (!c1 && c2) {
    throw new Error("Curve shape c2 requires c1.");
  }

  if (!c1) {
    return {
      p1,
      p2,
      c1: p1,
      c2: p2,
    };
  }

  if (!c2) {
    return {
      p1,
      p2,
      c1,
      c2: c1,
    };
  }

  return {
    p1,
    p2,
    c1,
    c2,
  };
}

function normalizeCurve(
  p1: CurveShapePoint,
  p2: CurveShapePoint,
  c1: CurveShapePoint,
  c2: CurveShapePoint,
  strokeWidth: number,
  width: number,
  height: number,
): NormalizedCurve {
  const inset = Math.trunc(Math.max(1, strokeWidth) * 1.1);
  const left = Math.min(p1.x, p2.x, c1.x, c2.x);
  const top = Math.min(p1.y, p2.y, c1.y, c2.y);
  const right = Math.max(p1.x, p2.x, c1.x, c2.x);
  const bottom = Math.max(p1.y, p2.y, c1.y, c2.y);

  const dirtyLeft = Math.floor(left - inset);
  const dirtyTop = Math.floor(top - inset);
  const dirtyRight = Math.ceil(right + inset);
  const dirtyBottom = Math.ceil(bottom + inset);
  const textureWidth = dirtyRight - dirtyLeft;
  const textureHeight = dirtyBottom - dirtyTop;
  if (textureWidth <= 0 || textureHeight <= 0) {
    throw new Error("Curve shape rect is empty.");
  }

  const visibleRect = intersectRect(dirtyLeft, dirtyTop, dirtyRight, dirtyBottom, width, height);
  return {
    textureWidth,
    textureHeight,
    targetRect: {
      x: dirtyLeft,
      y: dirtyTop,
      width: textureWidth,
      height: textureHeight,
    },
    visibleRect,
    curve: {
      p1: { x: p1.x - dirtyLeft, y: p1.y - dirtyTop },
      p2: { x: p2.x - dirtyLeft, y: p2.y - dirtyTop },
      c1: { x: c1.x - dirtyLeft, y: c1.y - dirtyTop },
      c2: { x: c2.x - dirtyLeft, y: c2.y - dirtyTop },
    },
  };
}

function intersectRect(
  left: number,
  top: number,
  right: number,
  bottom: number,
  width: number,
  height: number,
): CurveShapeRect {
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

function normalizeTargetRect(rect: CurveShapeRect): CurveShapeRect {
  const left = Math.floor(rect.x);
  const top = Math.floor(rect.y);
  const right = Math.ceil(rect.x + rect.width);
  const bottom = Math.ceil(rect.y + rect.height);
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function cubicBezier(t: number, curve: ResolvedCurvePoints): CurveShapePoint {
  const inv = 1 - t;
  return {
    x:
      inv * inv * inv * curve.p1.x +
      3 * inv * inv * t * curve.c1.x +
      3 * inv * t * t * curve.c2.x +
      t * t * t * curve.p2.x,
    y:
      inv * inv * inv * curve.p1.y +
      3 * inv * inv * t * curve.c1.y +
      3 * inv * t * t * curve.c2.y +
      t * t * t * curve.p2.y,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create curve shape shader.");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "Curve shape shader compile failed.");
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) {
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create curve shape program.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "Curve shape program link failed.");
  }
  return program;
}
