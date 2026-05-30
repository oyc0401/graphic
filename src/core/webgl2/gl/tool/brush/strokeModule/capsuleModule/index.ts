import strokeShaderSource from "./strokeShader.frag?raw";

const ALPHA_MAP_TEXTURE_UNIT = 3;

export interface CapsulePoint {
  x: number;
  y: number;
}

export interface CapsuleRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CreateCapsuleOptions {
  alphaMapTexture: WebGLTexture;
  width: number;
  height: number;
}

const FULL_QUAD_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;

void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export function createCapsule(
  gl: WebGL2RenderingContext,
  options: CreateCapsuleOptions,
) {
  return new Dist(gl, options);
}

class Capsule {
  private readonly width: number;
  private readonly height: number;
  private readonly tempAlphaMapTexture: WebGLTexture;
  private readonly tempFramebuffer: WebGLFramebuffer;
  private readonly alphaMapFramebuffer: WebGLFramebuffer;
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private alpha = 1;
  private diameter = 1;
  private lastPoint: CapsulePoint | null = null;
  private strokeRect: CapsuleRect | null = null;

  constructor(
    private gl: WebGL2RenderingContext,
    private options: CreateCapsuleOptions,
  ) {
    this.width = options.width;
    this.height = options.height;
    this.program = createProgram(
      gl,
      createShader(gl, gl.VERTEX_SHADER, FULL_QUAD_VERTEX_SHADER),
      createShader(gl, gl.FRAGMENT_SHADER, strokeShaderSource),
    );
    this.vao = this.createFullQuadVAO();
    this.tempAlphaMapTexture = this.createAlphaMapTexture();
    this.tempFramebuffer = this.createFramebuffer(this.tempAlphaMapTexture);
    this.ensureAlphaMapTextureSize(options.alphaMapTexture);
    this.alphaMapFramebuffer = this.createFramebuffer(options.alphaMapTexture);

    this.gl.useProgram(this.program);
    this.gl.uniform1i(
      this.gl.getUniformLocation(this.program, "u_pathMap"),
      ALPHA_MAP_TEXTURE_UNIT,
    );
    this.gl.uniform2f(
      this.gl.getUniformLocation(this.program, "u_resolution"),
      this.width,
      this.height,
    );
  }

  setAlpha(alpha: number) {
    this.alpha = Math.max(0, Math.min(1, alpha));
  }

  setDiameter(diameter: number) {
    this.diameter = Math.max(1, diameter);
  }

  start(point: CapsulePoint): CapsuleRect | null {
    this.lastPoint = point;
    this.strokeRect = null;
    return this.drawLine(point, point);
  }

  move(point: CapsulePoint): CapsuleRect | null {
    if (!this.lastPoint) {
      return this.start(point);
    }

    const rect = this.drawLine(this.lastPoint, point);
    this.lastPoint = point;
    return rect;
  }

  end(): CapsuleRect | null {
    const rect = this.strokeRect;
    this.lastPoint = null;
    this.strokeRect = null;
    return rect;
  }

  private drawLine(start: CapsulePoint, end: CapsulePoint): CapsuleRect | null {
    const rect = strokeRect(
      start,
      end,
      this.diameter / 2,
      this.width,
      this.height,
    );
    if (rect.width === 0 || rect.height === 0) return null;

    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0 + ALPHA_MAP_TEXTURE_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, this.options.alphaMapTexture);
    gl.uniform1f(
      gl.getUniformLocation(this.program, "u_radius"),
      this.diameter / 2,
    );
    gl.uniform1f(gl.getUniformLocation(this.program, "u_alpha"), this.alpha);
    gl.uniform2f(gl.getUniformLocation(this.program, "u_start"), start.x, start.y);
    gl.uniform2f(gl.getUniformLocation(this.program, "u_end"), end.x, end.y);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.tempFramebuffer);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(rect.x, rect.y, rect.width, rect.height);
    gl.viewport(0, 0, this.width, this.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.SCISSOR_TEST);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.tempFramebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.alphaMapFramebuffer);
    gl.blitFramebuffer(
      rect.x,
      rect.y,
      rect.x + rect.width,
      rect.y + rect.height,
      rect.x,
      rect.y,
      rect.x + rect.width,
      rect.y + rect.height,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );

    this.strokeRect = unionRect(this.strokeRect, rect);
    return rect;
  }

  private createFullQuadVAO() {
    const buffer = this.gl.createBuffer();
    const vao = this.gl.createVertexArray();
    if (!buffer || !vao) {
      throw new Error("Failed to create dist full quad.");
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

  private createAlphaMapTexture() {
    const texture = this.gl.createTexture();
    if (!texture) {
      throw new Error("Failed to create dist alpha map texture.");
    }

    this.ensureAlphaMapTextureSize(texture);
    return texture;
  }

  private ensureAlphaMapTextureSize(texture: WebGLTexture) {
    this.gl.activeTexture(this.gl.TEXTURE0 + ALPHA_MAP_TEXTURE_UNIT);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
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

  private createFramebuffer(texture: WebGLTexture) {
    const framebuffer = this.gl.createFramebuffer();
    if (!framebuffer) {
      throw new Error("Failed to create dist framebuffer.");
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
      throw new Error("Dist framebuffer is incomplete.");
    }
    return framebuffer;
  }
}

function strokeRect(
  start: CapsulePoint,
  end: CapsulePoint,
  radius: number,
  width: number,
  height: number,
): CapsuleRect {
  return clampRect(
    Math.floor(Math.min(start.x, end.x) - radius - 1),
    Math.floor(Math.min(start.y, end.y) - radius - 1),
    Math.ceil(Math.max(start.x, end.x) + radius + 1),
    Math.ceil(Math.max(start.y, end.y) + radius + 1),
    width,
    height,
  );
}

function unionRect(a: CapsuleRect | null, b: CapsuleRect): CapsuleRect {
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

function clampRect(
  left: number,
  top: number,
  right: number,
  bottom: number,
  width: number,
  height: number,
): CapsuleRect {
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
    throw new Error("Failed to create dist shader.");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "Dist shader compile failed.");
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
    throw new Error("Failed to create dist program.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "Dist program link failed.");
  }
  return program;
}
