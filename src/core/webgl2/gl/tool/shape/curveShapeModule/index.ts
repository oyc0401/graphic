import curveFrag from "./curve.frag?raw";

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

export interface CurveShapeStyle {
  color: CurveShapeColor;
  strokeWidth: number;
}

export interface CreateCurveShapeOptions {
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

export function createCurveShape(
  gl: WebGL2RenderingContext,
  options: CreateCurveShapeOptions,
) {
  return new CurveShape(gl, options);
}

class CurveShape {
  private readonly resultFramebuffer: WebGLFramebuffer;
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;

  constructor(
    private gl: WebGL2RenderingContext,
    private options: CreateCurveShapeOptions,
  ) {
    this.resultFramebuffer = this.createFramebuffer(options.resultTexture);
    this.program = createProgram(
      gl,
      createShader(gl, gl.VERTEX_SHADER, FULL_QUAD_VERTEX_SHADER),
      createShader(gl, gl.FRAGMENT_SHADER, curveFrag),
    );
    this.vao = this.createFullQuadVAO();
    this.bindStaticUniforms();
  }

  createCurve(
    p1: CurveShapePoint,
    p2: CurveShapePoint,
    c1: CurveShapePoint,
    c2: CurveShapePoint,
    style: CurveShapeStyle,
  ): CurveShapeRect | null {
    const dirtyRect = curveDirtyRect(
      p1,
      p2,
      c1,
      c2,
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
    gl.uniform2f(gl.getUniformLocation(this.program, "u_p1"), p1.x, p1.y);
    gl.uniform2f(gl.getUniformLocation(this.program, "u_p2"), p2.x, p2.y);
    gl.uniform2f(gl.getUniformLocation(this.program, "u_c1"), c1.x, c1.y);
    gl.uniform2f(gl.getUniformLocation(this.program, "u_c2"), c2.x, c2.y);
    gl.uniform1f(
      gl.getUniformLocation(this.program, "u_strokeWidth"),
      Math.max(1, style.strokeWidth),
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultFramebuffer);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(dirtyRect.x, dirtyRect.y, dirtyRect.width, dirtyRect.height);
    gl.viewport(0, 0, this.options.width, this.options.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.SCISSOR_TEST);

    return dirtyRect;
  }

  destroy() {
    const gl = this.gl;
    gl.deleteFramebuffer(this.resultFramebuffer);
    gl.deleteProgram(this.program);
    gl.deleteVertexArray(this.vao);
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
      throw new Error("Failed to create curve shape framebuffer.");
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

    const position = this.gl.getAttribLocation(this.program, "a_position");
    this.gl.enableVertexAttribArray(position);
    this.gl.vertexAttribPointer(position, 2, this.gl.FLOAT, false, 0, 0);
    return vao;
  }
}

function curveDirtyRect(
  p1: CurveShapePoint,
  p2: CurveShapePoint,
  c1: CurveShapePoint,
  c2: CurveShapePoint,
  strokeWidth: number,
  width: number,
  height: number,
): CurveShapeRect {
  const inset = Math.max(0, Math.ceil(strokeWidth / 2));
  let left = p1.x;
  let top = p1.y;
  let right = p1.x;
  let bottom = p1.y;

  for (let i = 1; i <= 64; i++) {
    const point = cubicBezier(i / 64, p1, p2, c1, c2);
    left = Math.min(left, point.x);
    top = Math.min(top, point.y);
    right = Math.max(right, point.x);
    bottom = Math.max(bottom, point.y);
  }

  return clampRect(
    Math.floor(left - inset),
    Math.floor(top - inset),
    Math.ceil(right + inset),
    Math.ceil(bottom + inset),
    width,
    height,
  );
}

function cubicBezier(
  t: number,
  p1: CurveShapePoint,
  p2: CurveShapePoint,
  c1: CurveShapePoint,
  c2: CurveShapePoint,
): CurveShapePoint {
  const inv = 1 - t;
  return {
    x:
      inv * inv * inv * p1.x +
      3 * inv * inv * t * c1.x +
      3 * inv * t * t * c2.x +
      t * t * t * p2.x,
    y:
      inv * inv * inv * p1.y +
      3 * inv * inv * t * c1.y +
      3 * inv * t * t * c2.y +
      t * t * t * p2.y,
  };
}

function clampRect(
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
    throw new Error("Failed to create curve shape shader.");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(
      gl.getShaderInfoLog(shader) ?? "Curve shape shader compile failed.",
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
    throw new Error("Failed to create curve shape program.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(
      gl.getProgramInfoLog(program) ?? "Curve shape program link failed.",
    );
  }
  return program;
}
