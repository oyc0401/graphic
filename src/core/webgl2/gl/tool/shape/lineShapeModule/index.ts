import applyFrag from "./apply.frag?raw";
import lineFrag from "./line.frag?raw";

export type LineShapeColor = [number, number, number, number];

export interface LineShapePoint {
  x: number;
  y: number;
}

export interface LineShapeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CreateLineShapeOptions {
  shapeTexture: WebGLTexture;
  imageTexture: WebGLTexture;
  resultTexture: WebGLTexture;
  width: number;
  height: number;
}

interface NormalizedLine {
  textureWidth: number;
  textureHeight: number;
  targetRect: LineShapeRect;
  p1: LineShapePoint;
  p2: LineShapePoint;
}

const TEXTURE_UNIT = {
  IMAGE: 0,
  SHAPE: 1,
};

const FULL_QUAD_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;

void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export function createLineShape(
  gl: WebGL2RenderingContext,
  options: CreateLineShapeOptions,
) {
  return new LineShape(gl, options);
}

class LineShape {
  private readonly shapeFramebuffer: WebGLFramebuffer;
  private readonly resultFramebuffer: WebGLFramebuffer;
  private readonly lineProgram: WebGLProgram;
  private readonly applyProgram: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private color: LineShapeColor = [0, 0, 0, 1];
  private strokeWidth = 1;
  private renderedLine: { key: string; width: number; height: number } | null =
    null;

  constructor(
    private gl: WebGL2RenderingContext,
    private options: CreateLineShapeOptions,
  ) {
    this.initializeShapeTexture();
    this.shapeFramebuffer = this.createFramebuffer(options.shapeTexture);
    this.resultFramebuffer = this.createFramebuffer(options.resultTexture);
    this.lineProgram = createProgram(
      gl,
      createShader(gl, gl.VERTEX_SHADER, FULL_QUAD_VERTEX_SHADER),
      createShader(gl, gl.FRAGMENT_SHADER, lineFrag),
    );
    this.applyProgram = createProgram(
      gl,
      createShader(gl, gl.VERTEX_SHADER, FULL_QUAD_VERTEX_SHADER),
      createShader(gl, gl.FRAGMENT_SHADER, applyFrag),
    );
    this.vao = this.createFullQuadVAO();
    this.bindApplyUniforms();
  }

  setColor(color: LineShapeColor) {
    this.color = [...color];
    if (this.renderedLine) this.renderedLine.key = "";
  }

  setWidth(width: number) {
    this.strokeWidth = Math.max(1, width);
    if (this.renderedLine) this.renderedLine.key = "";
  }

  create(p1: LineShapePoint, p2: LineShapePoint): LineShapeRect | null {
    const normalized = normalizeLine(
      p1,
      p2,
      this.strokeWidth,
      this.options.width,
      this.options.height,
    );
    if (!normalized) return null;

    const key = this.createLineKey(normalized);
    if (this.renderedLine?.key !== key) {
      this.clearShapeTexture();
      this.drawLine(normalized);
      this.renderedLine = {
        key,
        width: normalized.textureWidth,
        height: normalized.textureHeight,
      };
    }
    return normalized.targetRect;
  }

  apply(p1: LineShapePoint, p2: LineShapePoint): LineShapeRect | null {
    const normalized = normalizeLine(
      p1,
      p2,
      this.strokeWidth,
      this.options.width,
      this.options.height,
    );
    if (!normalized) return null;

    const gl = this.gl;
    gl.useProgram(this.applyProgram);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.IMAGE);
    gl.bindTexture(gl.TEXTURE_2D, this.options.imageTexture);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SHAPE);
    gl.bindTexture(gl.TEXTURE_2D, this.options.shapeTexture);
    gl.uniform4f(
      gl.getUniformLocation(this.applyProgram, "u_targetRect"),
      normalized.targetRect.x,
      normalized.targetRect.y,
      normalized.targetRect.width,
      normalized.targetRect.height,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultFramebuffer);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(
      normalized.targetRect.x,
      normalized.targetRect.y,
      normalized.targetRect.width,
      normalized.targetRect.height,
    );
    gl.viewport(0, 0, this.options.width, this.options.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.SCISSOR_TEST);

    this.clearShapeTexture();
    return normalized.targetRect;
  }

  destroy() {
    const gl = this.gl;
    gl.deleteFramebuffer(this.shapeFramebuffer);
    gl.deleteFramebuffer(this.resultFramebuffer);
    gl.deleteProgram(this.lineProgram);
    gl.deleteProgram(this.applyProgram);
    gl.deleteVertexArray(this.vao);
  }

  private drawLine(line: NormalizedLine) {
    const gl = this.gl;
    gl.useProgram(this.lineProgram);
    gl.bindVertexArray(this.vao);
    gl.uniform4f(
      gl.getUniformLocation(this.lineProgram, "u_color"),
      this.color[0],
      this.color[1],
      this.color[2],
      this.color[3],
    );
    gl.uniform1f(
      gl.getUniformLocation(this.lineProgram, "u_strokeWidth"),
      this.strokeWidth,
    );
    gl.uniform2f(
      gl.getUniformLocation(this.lineProgram, "u_resolution"),
      line.textureWidth,
      line.textureHeight,
    );
    gl.uniform2f(
      gl.getUniformLocation(this.lineProgram, "u_p1"),
      line.p1.x,
      line.p1.y,
    );
    gl.uniform2f(
      gl.getUniformLocation(this.lineProgram, "u_p2"),
      line.p2.x,
      line.p2.y,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shapeFramebuffer);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, 0, line.textureWidth, line.textureHeight);
    gl.viewport(0, 0, line.textureWidth, line.textureHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.SCISSOR_TEST);
  }

  private bindApplyUniforms() {
    const gl = this.gl;
    gl.useProgram(this.applyProgram);
    gl.uniform1i(
      gl.getUniformLocation(this.applyProgram, "u_image"),
      TEXTURE_UNIT.IMAGE,
    );
    gl.uniform1i(
      gl.getUniformLocation(this.applyProgram, "u_shape"),
      TEXTURE_UNIT.SHAPE,
    );
    gl.uniform2f(
      gl.getUniformLocation(this.applyProgram, "u_resolution"),
      this.options.width,
      this.options.height,
    );
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
    if (!this.renderedLine) return;

    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shapeFramebuffer);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, 0, this.renderedLine.width, this.renderedLine.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);
    this.renderedLine = null;
  }

  private createLineKey(line: NormalizedLine) {
    return [
      line.textureWidth,
      line.textureHeight,
      line.p1.x,
      line.p1.y,
      line.p2.x,
      line.p2.y,
      this.strokeWidth,
      this.color[0],
      this.color[1],
      this.color[2],
      this.color[3],
    ].join(":");
  }

  private createFramebuffer(texture: WebGLTexture) {
    const framebuffer = this.gl.createFramebuffer();
    if (!framebuffer) {
      throw new Error("Failed to create line shape framebuffer.");
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      texture,
      0,
    );
    if (
      this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) !==
      this.gl.FRAMEBUFFER_COMPLETE
    ) {
      throw new Error("Line shape framebuffer is incomplete.");
    }
    return framebuffer;
  }

  private createFullQuadVAO() {
    const buffer = this.gl.createBuffer();
    const vao = this.gl.createVertexArray();
    if (!buffer || !vao) {
      throw new Error("Failed to create line shape full quad.");
    }

    this.gl.bindVertexArray(vao);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      this.gl.STATIC_DRAW,
    );

    this.bindPositionAttribute(this.lineProgram);
    this.bindPositionAttribute(this.applyProgram);
    return vao;
  }

  private bindPositionAttribute(program: WebGLProgram) {
    const position = this.gl.getAttribLocation(program, "a_position");
    if (position < 0) return;

    this.gl.enableVertexAttribArray(position);
    this.gl.vertexAttribPointer(position, 2, this.gl.FLOAT, false, 0, 0);
  }
}

function normalizeLine(
  p1: LineShapePoint,
  p2: LineShapePoint,
  strokeWidth: number,
  width: number,
  height: number,
): NormalizedLine | null {
  const inset = Math.max(0, Math.ceil(strokeWidth / 2));
  const left = Math.floor(Math.min(p1.x, p2.x) - inset);
  const top = Math.floor(Math.min(p1.y, p2.y) - inset);
  const right = Math.ceil(Math.max(p1.x, p2.x) + inset);
  const bottom = Math.ceil(Math.max(p1.y, p2.y) + inset);
  const textureWidth = right - left;
  const textureHeight = bottom - top;
  if (textureWidth <= 0 || textureHeight <= 0) return null;

  const x = clamp(left, 0, width);
  const y = clamp(top, 0, height);
  const ex = clamp(right, 0, width);
  const ey = clamp(bottom, 0, height);
  const clampedWidth = Math.max(0, ex - x);
  const clampedHeight = Math.max(0, ey - y);

  if (clampedWidth === 0 || clampedHeight === 0) return null;
  return {
    textureWidth,
    textureHeight,
    targetRect: {
      x,
      y,
      width: clampedWidth,
      height: clampedHeight,
    },
    p1: { x: p1.x - left, y: p1.y - top },
    p2: { x: p2.x - left, y: p2.y - top },
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create line shape shader.");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(
      gl.getShaderInfoLog(shader) ?? "Line shape shader compile failed.",
    );
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
) {
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create line shape program.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(
      gl.getProgramInfoLog(program) ?? "Line shape program link failed.",
    );
  }
  return program;
}
