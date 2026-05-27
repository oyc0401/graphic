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
  imageTexture: WebGLTexture;
  resultTexture: WebGLTexture;
  width: number;
  height: number;
}

const TEXTURE_UNIT = {
  SOURCE: 0,
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
  private readonly resultFramebuffer: WebGLFramebuffer;
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private color: LineShapeColor = [0, 0, 0, 1];
  private strokeWidth = 1;

  constructor(
    private gl: WebGL2RenderingContext,
    private options: CreateLineShapeOptions,
  ) {
    this.resultFramebuffer = this.createFramebuffer(options.resultTexture);
    this.program = createProgram(
      gl,
      createShader(gl, gl.VERTEX_SHADER, FULL_QUAD_VERTEX_SHADER),
      createShader(gl, gl.FRAGMENT_SHADER, lineFrag),
    );
    this.vao = this.createFullQuadVAO();
    this.bindStaticUniforms();
  }

  setColor(color: LineShapeColor) {
    this.color = [...color];
  }

  setWidth(width: number) {
    this.strokeWidth = Math.max(1, width);
  }

  createLine(p1: LineShapePoint, p2: LineShapePoint): LineShapeRect | null {
    const dirtyRect = lineDirtyRect(
      p1,
      p2,
      this.strokeWidth,
      this.options.width,
      this.options.height,
    );
    return this.draw(p1, p2, dirtyRect);
  }

  destroy() {
    const gl = this.gl;
    gl.deleteFramebuffer(this.resultFramebuffer);
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
  }

  private draw(
    p1: LineShapePoint,
    p2: LineShapePoint,
    dirtyRect: LineShapeRect,
  ): LineShapeRect | null {
    if (dirtyRect.width === 0 || dirtyRect.height === 0) return null;

    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE);
    gl.bindTexture(gl.TEXTURE_2D, this.options.imageTexture);
    gl.uniform4f(
      gl.getUniformLocation(this.program, "u_color"),
      this.color[0],
      this.color[1],
      this.color[2],
      this.color[3],
    );
    gl.uniform2f(gl.getUniformLocation(this.program, "u_p1"), p1.x, p1.y);
    gl.uniform2f(gl.getUniformLocation(this.program, "u_p2"), p2.x, p2.y);
    gl.uniform1f(
      gl.getUniformLocation(this.program, "u_strokeWidth"),
      this.strokeWidth,
    );

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

    const position = this.gl.getAttribLocation(this.program, "a_position");
    this.gl.enableVertexAttribArray(position);
    this.gl.vertexAttribPointer(position, 2, this.gl.FLOAT, false, 0, 0);
    return vao;
  }
}

function lineDirtyRect(
  p1: LineShapePoint,
  p2: LineShapePoint,
  strokeWidth: number,
  width: number,
  height: number,
): LineShapeRect {
  const inset = Math.max(0, Math.ceil(strokeWidth / 2));
  return clampRect(
    Math.floor(Math.min(p1.x, p2.x) - inset),
    Math.floor(Math.min(p1.y, p2.y) - inset),
    Math.ceil(Math.max(p1.x, p2.x) + inset),
    Math.ceil(Math.max(p1.y, p2.y) + inset),
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
): LineShapeRect {
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
