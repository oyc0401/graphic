import applyFrag from "./apply.frag?raw";
import rectangleFrag from "./rectangle.frag?raw";

export type RectangleColor = [number, number, number, number];

export interface RectangleRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CreateRectangleOptions {
  shapeTexture: WebGLTexture;
  imageTexture: WebGLTexture;
  resultTexture: WebGLTexture;
  width: number;
  height: number;
}

interface NormalizedRect {
  textureWidth: number;
  textureHeight: number;
  targetRect: RectangleRect;
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

export function createRectangle(
  gl: WebGL2RenderingContext,
  options: CreateRectangleOptions,
) {
  return new Rectangle(gl, options);
}

class Rectangle {
  private readonly shapeFramebuffer: WebGLFramebuffer;
  private readonly resultFramebuffer: WebGLFramebuffer;
  private readonly rectangleProgram: WebGLProgram;
  private readonly applyProgram: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private color: RectangleColor = [0, 0, 0, 1];
  private strokeWidth = 1;
  private renderedRect: { key: string; width: number; height: number } | null =
    null;

  constructor(
    private gl: WebGL2RenderingContext,
    private options: CreateRectangleOptions,
  ) {
    this.initializeShapeTexture();
    this.shapeFramebuffer = this.createFramebuffer(options.shapeTexture);
    this.resultFramebuffer = this.createFramebuffer(options.resultTexture);
    this.rectangleProgram = createProgram(
      gl,
      createShader(gl, gl.VERTEX_SHADER, FULL_QUAD_VERTEX_SHADER),
      createShader(gl, gl.FRAGMENT_SHADER, rectangleFrag),
    );
    this.applyProgram = createProgram(
      gl,
      createShader(gl, gl.VERTEX_SHADER, FULL_QUAD_VERTEX_SHADER),
      createShader(gl, gl.FRAGMENT_SHADER, applyFrag),
    );
    this.vao = this.createFullQuadVAO();
    this.bindApplyUniforms();
  }

  setColor(color: RectangleColor) {
    this.color = [...color];
    if (this.renderedRect) this.renderedRect.key = "";
  }

  setWidth(width: number) {
    this.strokeWidth = Math.max(1, width);
    if (this.renderedRect) this.renderedRect.key = "";
  }

  create(rect: RectangleRect): RectangleRect | null {
    const normalized = normalizeRect(
      rect,
      this.options.width,
      this.options.height,
    );
    if (!normalized) return null;

    const key = this.createRectKey(
      normalized.textureWidth,
      normalized.textureHeight,
    );
    if (this.renderedRect?.key !== key) {
      this.clearShapeTexture();
      this.drawRectangle(normalized.textureWidth, normalized.textureHeight);
      this.renderedRect = {
        key,
        width: normalized.textureWidth,
        height: normalized.textureHeight,
      };
    }
    return normalized.targetRect;
  }

  apply(rect: RectangleRect): RectangleRect | null {
    const normalized = normalizeRect(
      rect,
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
    gl.deleteProgram(this.rectangleProgram);
    gl.deleteProgram(this.applyProgram);
    gl.deleteVertexArray(this.vao);
  }

  private drawRectangle(width: number, height: number) {
    const gl = this.gl;
    gl.useProgram(this.rectangleProgram);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(
      gl.getUniformLocation(this.rectangleProgram, "u_resolution"),
      width,
      height,
    );
    gl.uniform4f(
      gl.getUniformLocation(this.rectangleProgram, "u_color"),
      this.color[0],
      this.color[1],
      this.color[2],
      this.color[3],
    );
    gl.uniform1f(
      gl.getUniformLocation(this.rectangleProgram, "u_strokeWidth"),
      this.strokeWidth,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shapeFramebuffer);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, 0, width, height);
    gl.viewport(0, 0, width, height);
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
    if (!this.renderedRect) return;

    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shapeFramebuffer);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, 0, this.renderedRect.width, this.renderedRect.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);
    this.renderedRect = null;
  }

  private createRectKey(width: number, height: number) {
    return [
      width,
      height,
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
      throw new Error("Failed to create rectangle framebuffer.");
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
      throw new Error("Rectangle framebuffer is incomplete.");
    }
    return framebuffer;
  }

  private createFullQuadVAO() {
    const buffer = this.gl.createBuffer();
    const vao = this.gl.createVertexArray();
    if (!buffer || !vao) {
      throw new Error("Failed to create rectangle full quad.");
    }

    this.gl.bindVertexArray(vao);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      this.gl.STATIC_DRAW,
    );

    this.bindPositionAttribute(this.rectangleProgram);
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

function normalizeRect(
  rect: RectangleRect,
  canvasWidth: number,
  canvasHeight: number,
): NormalizedRect | null {
  const left = Math.floor(rect.x);
  const top = Math.floor(rect.y);
  const right = Math.ceil(rect.x + rect.width);
  const bottom = Math.ceil(rect.y + rect.height);
  const textureWidth = right - left;
  const textureHeight = bottom - top;
  if (textureWidth <= 0 || textureHeight <= 0) return null;

  const clampedX = Math.max(0, left);
  const clampedY = Math.max(0, top);
  const clampedRight = Math.min(canvasWidth, right);
  const clampedBottom = Math.min(canvasHeight, bottom);
  const clampedWidth = Math.max(0, clampedRight - clampedX);
  const clampedHeight = Math.max(0, clampedBottom - clampedY);

  if (clampedWidth === 0 || clampedHeight === 0) return null;
  return {
    textureWidth,
    textureHeight,
    targetRect: {
      x: clampedX,
      y: clampedY,
      width: clampedWidth,
      height: clampedHeight,
    },
  };
}

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create rectangle shader.");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(
      gl.getShaderInfoLog(shader) ?? "Rectangle shader compile failed.",
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
    throw new Error("Failed to create rectangle program.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(
      gl.getProgramInfoLog(program) ?? "Rectangle program link failed.",
    );
  }
  return program;
}
