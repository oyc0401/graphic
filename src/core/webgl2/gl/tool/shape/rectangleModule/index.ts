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

type CachedShapeTexture = WebGLTexture & { shapeKey?: string };

interface NormalizedRect {
  textureWidth: number;
  textureHeight: number;
  targetRect: RectangleRect;
  visibleRect: RectangleRect;
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

export function createRectangle(gl: WebGL2RenderingContext, options: CreateRectangleOptions) {
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
  private replace = false;

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
  }

  setWidth(width: number) {
    this.strokeWidth = Math.max(1, width);
  }

  setReplace(replace: boolean) {
    this.replace = replace;
  }

  create(rect: RectangleRect): RectangleRect {
    const normalized = normalizeRect(rect, this.options.width, this.options.height);
    const key = this.createRectKey(normalized.textureWidth, normalized.textureHeight);

    if (getShapeKey(this.options.shapeTexture) !== key) {
      this.clearShapeTexture();
      this.drawRectangle(normalized.textureWidth, normalized.textureHeight);
      setShapeKey(this.options.shapeTexture, key);
    }
    return normalized.targetRect;
  }

  apply(rect: RectangleRect): RectangleRect {
    const normalized = normalizeRect(rect, this.options.width, this.options.height);
    const targetRect = normalized.targetRect;
    const visibleRect = normalized.visibleRect;

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
    gl.uniform1f(gl.getUniformLocation(this.applyProgram, "u_alpha"), this.color[3]);
    gl.uniform1i(gl.getUniformLocation(this.applyProgram, "u_replace"), this.replace ? 1 : 0);

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
    gl.deleteProgram(this.rectangleProgram);
    gl.deleteProgram(this.applyProgram);
    gl.deleteVertexArray(this.vao);
  }

  private drawRectangle(width: number, height: number) {
    const gl = this.gl;
    gl.useProgram(this.rectangleProgram);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(gl.getUniformLocation(this.rectangleProgram, "u_resolution"), width, height);
    gl.uniform4f(
      gl.getUniformLocation(this.rectangleProgram, "u_color"),
      this.color[0],
      this.color[1],
      this.color[2],
      this.color[3],
    );
    gl.uniform1f(gl.getUniformLocation(this.rectangleProgram, "u_strokeWidth"), this.strokeWidth);

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
    gl.uniform1i(gl.getUniformLocation(this.applyProgram, "u_image"), TEXTURE_UNIT.IMAGE);
    gl.uniform1i(gl.getUniformLocation(this.applyProgram, "u_shape"), TEXTURE_UNIT.SHAPE);
    gl.uniform2f(gl.getUniformLocation(this.applyProgram, "u_resolution"), this.options.width, this.options.height);
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

  private createRectKey(width: number, height: number) {
    return [
      "rectangle",
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
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, texture, 0);
    if (this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) !== this.gl.FRAMEBUFFER_COMPLETE) {
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

function getShapeKey(texture: WebGLTexture) {
  return (texture as CachedShapeTexture).shapeKey ?? "";
}

function setShapeKey(texture: WebGLTexture, key: string) {
  (texture as CachedShapeTexture).shapeKey = key;
}

function normalizeRect(rect: RectangleRect, canvasWidth: number, canvasHeight: number): NormalizedRect {
  const left = Math.floor(rect.x);
  const top = Math.floor(rect.y);
  const right = Math.ceil(rect.x + rect.width);
  const bottom = Math.ceil(rect.y + rect.height);
  const textureWidth = Math.max(0, right - left);
  const textureHeight = Math.max(0, bottom - top);

  const visibleRect = intersectRect(left, top, right, bottom, canvasWidth, canvasHeight);
  return {
    textureWidth,
    textureHeight,
    targetRect: {
      x: left,
      y: top,
      width: textureWidth,
      height: textureHeight,
    },
    visibleRect,
  };
}

function intersectRect(
  left: number,
  top: number,
  right: number,
  bottom: number,
  width: number,
  height: number,
): RectangleRect {
  const x = Math.max(0, left);
  const y = Math.max(0, top);
  const ex = Math.min(width, right);
  const ey = Math.min(height, bottom);
  return {
    x,
    y,
    width: Math.max(0, ex - x),
    height: Math.max(0, ey - y),
  };
}

function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create rectangle shader.");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "Rectangle shader compile failed.");
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader) {
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create rectangle program.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "Rectangle program link failed.");
  }
  return program;
}
