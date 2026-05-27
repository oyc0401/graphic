import shapeFrag from "./shape.frag?raw";

export type ShapeColor = [number, number, number, number];

export interface ShapeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ShapeStyle {
  color: ShapeColor;
  strokeWidth: number;
}

export interface CreateShapeOptions {
  imageTexture: WebGLTexture;
  resultTexture: WebGLTexture;
  width: number;
  height: number;
}

const TEXTURE_UNIT = {
  SOURCE: 0,
};

const SHAPE_TYPE = {
  RECTANGLE: 0,
  ELLIPSE: 1,
} as const;

const FULL_QUAD_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
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
  private readonly resultFramebuffer: WebGLFramebuffer;
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;

  constructor(
    private gl: WebGL2RenderingContext,
    private options: CreateShapeOptions,
  ) {
    this.resultFramebuffer = this.createFramebuffer(options.resultTexture);
    this.program = createProgram(
      gl,
      createShader(gl, gl.VERTEX_SHADER, FULL_QUAD_VERTEX_SHADER),
      createShader(gl, gl.FRAGMENT_SHADER, shapeFrag),
    );
    this.vao = this.createFullQuadVAO();
    this.bindStaticUniforms();
  }

  createRectangle(rect: ShapeRect, style: ShapeStyle): ShapeRect | null {
    return this.draw(SHAPE_TYPE.RECTANGLE, rect, style);
  }

  createEllipse(rect: ShapeRect, style: ShapeStyle): ShapeRect | null {
    return this.draw(SHAPE_TYPE.ELLIPSE, rect, style);
  }

  destroy() {
    const gl = this.gl;
    gl.deleteFramebuffer(this.resultFramebuffer);
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
  }

  private draw(
    shapeType: number,
    rect: ShapeRect,
    style: ShapeStyle,
  ): ShapeRect | null {
    const dirtyRect = shapeDirtyRect(
      rect,
      style.strokeWidth,
      this.options.width,
      this.options.height,
    );
    if (dirtyRect.width === 0 || dirtyRect.height === 0) return null;

    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE);
    gl.bindTexture(gl.TEXTURE_2D, this.options.imageTexture);
    gl.uniform4f(
      gl.getUniformLocation(this.program, "u_color"),
      style.color[0],
      style.color[1],
      style.color[2],
      style.color[3],
    );
    gl.uniform4f(
      gl.getUniformLocation(this.program, "u_shapeRect"),
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    );
    gl.uniform1f(
      gl.getUniformLocation(this.program, "u_strokeWidth"),
      Math.max(1, style.strokeWidth),
    );
    gl.uniform1i(gl.getUniformLocation(this.program, "u_shapeType"), shapeType);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultFramebuffer);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(dirtyRect.x, dirtyRect.y, dirtyRect.width, dirtyRect.height);
    gl.viewport(0, 0, this.options.width, this.options.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.SCISSOR_TEST);

    return dirtyRect;
  }

  private bindStaticUniforms() {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniform1i(
      gl.getUniformLocation(this.program, "u_source"),
      TEXTURE_UNIT.SOURCE,
    );
    gl.uniform2f(
      gl.getUniformLocation(this.program, "u_resolution"),
      this.options.width,
      this.options.height,
    );
  }

  private createFramebuffer(texture: WebGLTexture) {
    const framebuffer = this.gl.createFramebuffer();
    if (!framebuffer) {
      throw new Error("Failed to create shape framebuffer.");
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
      throw new Error("Shape framebuffer is incomplete.");
    }
    return framebuffer;
  }

  private createFullQuadVAO() {
    const buffer = this.gl.createBuffer();
    const vao = this.gl.createVertexArray();
    if (!buffer || !vao) {
      throw new Error("Failed to create shape full quad.");
    }

    this.gl.bindVertexArray(vao);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      this.gl.STATIC_DRAW,
    );

    const position = this.gl.getAttribLocation(this.program, "a_position");
    this.gl.enableVertexAttribArray(position);
    this.gl.vertexAttribPointer(position, 2, this.gl.FLOAT, false, 0, 0);
    return vao;
  }
}

function shapeDirtyRect(
  rect: ShapeRect,
  strokeWidth: number,
  width: number,
  height: number,
): ShapeRect {
  const inset = Math.max(0, Math.ceil(strokeWidth / 2));
  return clampRect(
    Math.floor(rect.x - inset),
    Math.floor(rect.y - inset),
    Math.ceil(rect.x + rect.width + inset),
    Math.ceil(rect.y + rect.height + inset),
    width,
    height,
  );
}

function clampRect(
  left: number,
  top: number,
  right: number,
  bottom: number,
  width: number,
  height: number,
): ShapeRect {
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
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
) {
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create shape program.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(
      gl.getProgramInfoLog(program) ?? "Shape program link failed.",
    );
  }
  return program;
}
