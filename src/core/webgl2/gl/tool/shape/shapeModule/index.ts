import applyFrag from "./apply.frag?raw";
import ellipseFrag from "./ellipse.frag?raw";
import rectangleFrag from "./rectangle.frag?raw";

export type ShapeColor = [number, number, number, number];

export interface ShapeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CreateShapeOptions {
  shapeTexture: WebGLTexture;
  imageTexture: WebGLTexture;
  resultTexture: WebGLTexture;
  width: number;
  height: number;
}

type ShapeKind = "rectangle" | "ellipse";

interface ShapeProgram {
  kind: ShapeKind;
  program: WebGLProgram;
}

const TEXTURE_UNIT = {
  IMAGE: 0,
  SHAPE: 1,
} as const;

const QUAD_VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 a_position;
out vec2 v_texCoord;

void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export function createShape(
  gl: WebGL2RenderingContext,
  options: CreateShapeOptions,
) {
  return new Shape(gl, options);
}

class Shape {
  private readonly shapeFramebuffer: WebGLFramebuffer;
  private readonly resultFramebuffer: WebGLFramebuffer;
  private readonly rectangleProgram: ShapeProgram;
  private readonly ellipseProgram: ShapeProgram;
  private readonly applyProgram: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;

  private color: ShapeColor = [0, 0, 0, 1];
  private strokeWidth = 1;
  private renderedShape: { key: string; width: number; height: number } | null =
    null;

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly options: CreateShapeOptions,
  ) {
    this.initializeShapeTexture();
    this.shapeFramebuffer = createFramebuffer(gl, options.shapeTexture);
    this.resultFramebuffer = createFramebuffer(gl, options.resultTexture);
    this.rectangleProgram = {
      kind: "rectangle",
      program: createProgram(gl, QUAD_VERTEX_SHADER, rectangleFrag),
    };
    this.ellipseProgram = {
      kind: "ellipse",
      program: createProgram(gl, QUAD_VERTEX_SHADER, ellipseFrag),
    };
    this.applyProgram = createProgram(gl, QUAD_VERTEX_SHADER, applyFrag);
    this.vao = createQuadVAO(gl);
    this.bindApplyUniforms();
  }

  setColor(color: ShapeColor) {
    this.color = [...color];
    if (this.renderedShape) this.renderedShape.key = "";
  }

  setWidth(width: number) {
    this.strokeWidth = Math.max(1, width);
    if (this.renderedShape) this.renderedShape.key = "";
  }

  createRectangle(rect: ShapeRect): ShapeRect | null {
    return this.createShape(this.rectangleProgram, rect);
  }

  createEllipse(rect: ShapeRect): ShapeRect | null {
    return this.createShape(this.ellipseProgram, rect);
  }

  apply(rect: ShapeRect): ShapeRect | null {
    const targetRect = normalizeTargetRect(
      rect,
      this.options.width,
      this.options.height,
    );
    if (!targetRect) return null;

    const gl = this.gl;
    gl.useProgram(this.applyProgram);
    gl.bindVertexArray(this.vao);
    bindTexture(gl, TEXTURE_UNIT.IMAGE, this.options.imageTexture);
    bindTexture(gl, TEXTURE_UNIT.SHAPE, this.options.shapeTexture);
    gl.uniform4f(
      gl.getUniformLocation(this.applyProgram, "u_targetRect"),
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultFramebuffer);
    drawFullQuad(gl, this.options.width, this.options.height, targetRect);

    this.clearShapeTexture();
    return targetRect;
  }

  destroy() {
    const gl = this.gl;
    gl.deleteFramebuffer(this.shapeFramebuffer);
    gl.deleteFramebuffer(this.resultFramebuffer);
    gl.deleteProgram(this.rectangleProgram.program);
    gl.deleteProgram(this.ellipseProgram.program);
    gl.deleteProgram(this.applyProgram);
    gl.deleteVertexArray(this.vao);
  }

  private createShape(
    shapeProgram: ShapeProgram,
    rect: ShapeRect,
  ): ShapeRect | null {
    const targetRect = normalizeTargetRect(
      rect,
      this.options.width,
      this.options.height,
    );
    if (!targetRect) return null;

    const shapeWidth = Math.max(1, Math.ceil(rect.width));
    const shapeHeight = Math.max(1, Math.ceil(rect.height));
    const key = this.createShapeKey(shapeProgram.kind, shapeWidth, shapeHeight);
    if (this.renderedShape?.key === key) return targetRect;

    this.clearShapeTexture();
    this.drawShapeTexture(shapeProgram.program, shapeWidth, shapeHeight);
    this.renderedShape = { key, width: shapeWidth, height: shapeHeight };
    return targetRect;
  }

  private drawShapeTexture(
    program: WebGLProgram,
    width: number,
    height: number,
  ) {
    const gl = this.gl;
    gl.useProgram(program);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(gl.getUniformLocation(program, "u_resolution"), width, height);
    gl.uniform4f(
      gl.getUniformLocation(program, "u_color"),
      this.color[0],
      this.color[1],
      this.color[2],
      this.color[3],
    );
    gl.uniform1f(
      gl.getUniformLocation(program, "u_strokeWidth"),
      this.strokeWidth,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shapeFramebuffer);
    drawFullQuad(gl, width, height, { x: 0, y: 0, width, height });
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
    bindTexture(gl, TEXTURE_UNIT.SHAPE, this.options.shapeTexture);
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
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  private clearShapeTexture() {
    if (!this.renderedShape) return;

    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shapeFramebuffer);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, 0, this.renderedShape.width, this.renderedShape.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);
    this.renderedShape = null;
  }

  private createShapeKey(kind: ShapeKind, width: number, height: number) {
    return [
      kind,
      width,
      height,
      this.strokeWidth,
      this.color[0],
      this.color[1],
      this.color[2],
      this.color[3],
    ].join(":");
  }
}

function normalizeTargetRect(
  rect: ShapeRect,
  canvasWidth: number,
  canvasHeight: number,
): ShapeRect | null {
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  if (width <= 0 || height <= 0) return null;

  const x = Math.floor(rect.x);
  const y = Math.floor(rect.y);
  const right = Math.min(canvasWidth, x + width);
  const bottom = Math.min(canvasHeight, y + height);
  const clampedX = Math.max(0, x);
  const clampedY = Math.max(0, y);
  const clampedWidth = Math.max(0, right - clampedX);
  const clampedHeight = Math.max(0, bottom - clampedY);

  if (clampedWidth === 0 || clampedHeight === 0) return null;
  return {
    x: clampedX,
    y: clampedY,
    width: clampedWidth,
    height: clampedHeight,
  };
}

function bindTexture(
  gl: WebGL2RenderingContext,
  textureUnit: number,
  texture: WebGLTexture,
) {
  gl.activeTexture(gl.TEXTURE0 + textureUnit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
}

function drawFullQuad(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  scissor: ShapeRect,
) {
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(scissor.x, scissor.y, scissor.width, scissor.height);
  gl.viewport(0, 0, width, height);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.disable(gl.SCISSOR_TEST);
}

function createFramebuffer(
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
) {
  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) {
    throw new Error("Failed to create shape framebuffer.");
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error("Shape framebuffer is incomplete.");
  }
  return framebuffer;
}

function createQuadVAO(gl: WebGL2RenderingContext) {
  const buffer = gl.createBuffer();
  const vao = gl.createVertexArray();
  if (!buffer || !vao) {
    throw new Error("Failed to create shape quad.");
  }

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return vao;
}

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create shape shader.");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(
      gl.getShaderInfoLog(shader) ?? "Shape shader compile failed.",
    );
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create shape program.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(
      gl.getProgramInfoLog(program) ?? "Shape program link failed.",
    );
  }
  return program;
}
