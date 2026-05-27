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

export interface CreateCurveShapeOptions {
  imageTexture: WebGLTexture;
  resultTexture: WebGLTexture;
  width: number;
  height: number;
}

interface ResolvedCurvePoints {
  p1: CurveShapePoint;
  p2: CurveShapePoint;
  c1: CurveShapePoint;
  c2: CurveShapePoint;
}

const TEXTURE_UNIT = {
  SOURCE: 0,
  ALPHA_MAP: 1,
};

const CURVE_SEGMENTS = 100;

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
  private readonly alphaMapTexture: WebGLTexture;
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private tempCanvas!: OffscreenCanvas | HTMLCanvasElement;
  private tempCtx!: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  private color: CurveShapeColor = [0, 0, 0, 1];
  private strokeWidth = 1;

  constructor(
    private gl: WebGL2RenderingContext,
    private options: CreateCurveShapeOptions,
  ) {
    this.resultFramebuffer = this.createFramebuffer(options.resultTexture);
    this.alphaMapTexture = this.createAlphaMapTexture();
    this.program = createProgram(
      gl,
      createShader(gl, gl.VERTEX_SHADER, FULL_QUAD_VERTEX_SHADER),
      createShader(gl, gl.FRAGMENT_SHADER, curveFrag),
    );
    this.vao = this.createFullQuadVAO();
    this.ensureTempCanvasSize(options.width, options.height);
    this.bindStaticUniforms();
  }

  setColor(color: CurveShapeColor) {
    this.color = [...color];
  }

  setWidth(width: number) {
    this.strokeWidth = Math.max(1, width);
  }

  createCurve(
    p1: CurveShapePoint,
    p2: CurveShapePoint,
    c1: CurveShapePoint | null,
    c2: CurveShapePoint | null,
  ): CurveShapeRect | null {
    const curve = resolveCurvePoints(p1, p2, c1, c2);
    const dirtyRect = curveDirtyRect(
      curve.p1,
      curve.p2,
      curve.c1,
      curve.c2,
      this.strokeWidth,
      this.options.width,
      this.options.height,
    );
    if (dirtyRect.width === 0 || dirtyRect.height === 0) return null;
    this.drawCurveToAlphaMap(curve, dirtyRect);

    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE);
    gl.bindTexture(gl.TEXTURE_2D, this.options.imageTexture);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.ALPHA_MAP);
    gl.bindTexture(gl.TEXTURE_2D, this.alphaMapTexture);
    gl.uniform4f(
      gl.getUniformLocation(this.program, "u_color"),
      this.color[0],
      this.color[1],
      this.color[2],
      this.color[3],
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
    gl.deleteTexture(this.alphaMapTexture);
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
    gl.uniform1i(
      gl.getUniformLocation(this.program, "u_alphaMap"),
      TEXTURE_UNIT.ALPHA_MAP,
    );
    gl.uniform2f(
      gl.getUniformLocation(this.program, "u_resolution"),
      this.options.width,
      this.options.height,
    );
  }

  private drawCurveToAlphaMap(
    curve: ResolvedCurvePoints,
    dirtyRect: CurveShapeRect,
  ) {
    this.tempCtx.clearRect(
      dirtyRect.x,
      dirtyRect.y,
      dirtyRect.width,
      dirtyRect.height,
    );
    this.tempCtx.strokeStyle = "black";
    this.tempCtx.lineWidth = this.strokeWidth;
    this.tempCtx.lineCap = "round";
    this.tempCtx.lineJoin = "round";
    this.tempCtx.beginPath();
    this.tempCtx.moveTo(curve.p1.x, curve.p1.y);

    for (let i = 1; i <= CURVE_SEGMENTS; i += 1) {
      const point = cubicBezier(i / CURVE_SEGMENTS, curve);
      this.tempCtx.lineTo(point.x, point.y);
    }

    this.tempCtx.stroke();
    this.uploadAlphaMap(dirtyRect);
  }

  private uploadAlphaMap(rect: CurveShapeRect) {
    const img = this.tempCtx.getImageData(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    ).data;
    const alpha = new Uint8Array(rect.width * rect.height);

    for (let i = 0; i < alpha.length; i += 1) {
      alpha[i] = img[i * 4 + 3];
    }

    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.ALPHA_MAP);
    gl.bindTexture(gl.TEXTURE_2D, this.alphaMapTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      gl.RED,
      gl.UNSIGNED_BYTE,
      alpha,
    );
  }

  private createAlphaMapTexture() {
    const texture = this.gl.createTexture();
    if (!texture) {
      throw new Error("Failed to create curve shape alpha map texture.");
    }

    this.gl.activeTexture(this.gl.TEXTURE0 + TEXTURE_UNIT.ALPHA_MAP);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.R8,
      this.options.width,
      this.options.height,
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
    return texture;
  }

  private ensureTempCanvasSize(width: number, height: number) {
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

function curveDirtyRect(
  p1: CurveShapePoint,
  p2: CurveShapePoint,
  c1: CurveShapePoint,
  c2: CurveShapePoint,
  strokeWidth: number,
  width: number,
  height: number,
): CurveShapeRect {
  const inset = Math.trunc(Math.max(1, strokeWidth) * 1.1);
  const left = Math.min(p1.x, p2.x, c1.x, c2.x);
  const top = Math.min(p1.y, p2.y, c1.y, c2.y);
  const right = Math.max(p1.x, p2.x, c1.x, c2.x);
  const bottom = Math.max(p1.y, p2.y, c1.y, c2.y);

  return clampRect(
    Math.floor(left - inset),
    Math.floor(top - inset),
    Math.ceil(right + inset),
    Math.ceil(bottom + inset),
    width,
    height,
  );
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
