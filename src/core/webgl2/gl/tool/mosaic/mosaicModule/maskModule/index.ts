import maskFrag from "./mask.frag?raw";
import restoreMaskFrag from "./restoreMask.frag?raw";

export interface MosaicPoint {
  x: number;
  y: number;
}

export interface MosaicRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function strokeRect(
  start: MosaicPoint,
  end: MosaicPoint,
  radius: number,
  width: number,
  height: number,
): MosaicRect {
  const left = Math.floor(Math.min(start.x, end.x) - radius);
  const top = Math.floor(Math.min(start.y, end.y) - radius);
  const right = Math.ceil(Math.max(start.x, end.x) + radius);
  const bottom = Math.ceil(Math.max(start.y, end.y) + radius);
  return clampRect(left, top, right, bottom, width, height);
}

function unionRect(a: MosaicRect | null, b: MosaicRect): MosaicRect {
  if (!a) return b;

  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);

  return { x: left, y: top, width: right - left, height: bottom - top };
}

function clampRect(
  left: number,
  top: number,
  right: number,
  bottom: number,
  width: number,
  height: number,
): MosaicRect {
  const x = clamp(left, 0, width);
  const y = clamp(top, 0, height);
  const ex = clamp(right, 0, width);
  const ey = clamp(bottom, 0, height);
  return { x, y, width: Math.max(0, ex - x), height: Math.max(0, ey - y) };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export interface CreateMosaicMaskOptions {
  sourceMaskTexture: WebGLTexture;
  maskTexture: WebGLTexture;
  width: number;
  height: number;
}

const TEXTURE_UNIT = {
  TEMP: 12,
  MASK: 14,
};

const FULL_QUAD_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;

void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export function createMosaicMask(
  gl: WebGL2RenderingContext,
  options: CreateMosaicMaskOptions,
) {
  return new MosaicMask(gl, options);
}

class MosaicMask {
  private width: number;
  private height: number;
  private radius = 10;
  private lastPoint: MosaicPoint | null = null;
  private strokeRect: MosaicRect | null = null;

  private tempMaskTexture: WebGLTexture;
  private sourceMaskFBO: WebGLFramebuffer;
  private maskFBO: WebGLFramebuffer;
  private tempMaskFBO: WebGLFramebuffer;

  private maskProgram: WebGLProgram;
  private restoreMaskProgram: WebGLProgram;
  private quadBuffer: WebGLBuffer;
  private maskVAO: WebGLVertexArrayObject;
  private restoreMaskVAO: WebGLVertexArrayObject;

  private uMaskResolution: WebGLUniformLocation;
  private uMaskStart: WebGLUniformLocation;
  private uMaskEnd: WebGLUniformLocation;
  private uMaskRadius: WebGLUniformLocation;

  private uRestoreMaskResolution: WebGLUniformLocation;
  private uRestoreMaskStart: WebGLUniformLocation;
  private uRestoreMaskEnd: WebGLUniformLocation;
  private uRestoreMaskRadius: WebGLUniformLocation;

  constructor(
    private gl: WebGL2RenderingContext,
    private options: CreateMosaicMaskOptions,
  ) {
    this.width = options.width;
    this.height = options.height;
    this.checkExtensions();
    this.createTextures();
    this.createPrograms();
    this.setTextureSize(options.width, options.height);
  }

  setRadius(radius: number) {
    this.radius = Math.max(0, radius);
  }

  start(point: MosaicPoint): MosaicRect | null {
    this.lastPoint = point;
    const rect = this.paint(point, point);
    this.strokeRect = unionRect(this.strokeRect, rect);
    return rect;
  }

  move(point: MosaicPoint): MosaicRect | null {
    if (!this.lastPoint) {
      return this.start(point);
    }

    const rect = this.paint(this.lastPoint, point);
    this.lastPoint = point;
    this.strokeRect = unionRect(this.strokeRect, rect);
    return rect;
  }

  restoreStart(point: MosaicPoint): MosaicRect | null {
    this.lastPoint = point;
    const rect = this.restore(point, point);
    this.strokeRect = unionRect(this.strokeRect, rect);
    return rect;
  }

  restoreMove(point: MosaicPoint): MosaicRect | null {
    if (!this.lastPoint) {
      return this.restoreStart(point);
    }

    const rect = this.restore(this.lastPoint, point);
    this.lastPoint = point;
    this.strokeRect = unionRect(this.strokeRect, rect);
    return rect;
  }

  end(): MosaicRect | null {
    const rect = this.strokeRect;
    this.strokeRect = null;
    this.lastPoint = null;
    return rect;
  }

  destroy() {
    const gl = this.gl;

    gl.deleteTexture(this.tempMaskTexture);
    gl.deleteFramebuffer(this.sourceMaskFBO);
    gl.deleteFramebuffer(this.maskFBO);
    gl.deleteFramebuffer(this.tempMaskFBO);
    gl.deleteProgram(this.maskProgram);
    gl.deleteProgram(this.restoreMaskProgram);
    gl.deleteBuffer(this.quadBuffer);
    gl.deleteVertexArray(this.maskVAO);
    gl.deleteVertexArray(this.restoreMaskVAO);
  }

  private setTextureSize(width: number, height: number) {
    const gl = this.gl;

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.MASK);
    gl.bindTexture(gl.TEXTURE_2D, this.options.maskTexture);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, this.tempMaskTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R32F,
      width,
      height,
      0,
      gl.RED,
      gl.FLOAT,
      null,
    );

    gl.useProgram(this.maskProgram);
    gl.uniform2f(this.uMaskResolution, width, height);
    gl.useProgram(this.restoreMaskProgram);
    gl.uniform2f(this.uRestoreMaskResolution, width, height);

    this.copyMaskRect(
      { x: 0, y: 0, width, height },
      this.sourceMaskFBO,
      this.maskFBO,
    );
    this.copyMaskRect(
      { x: 0, y: 0, width, height },
      this.sourceMaskFBO,
      this.tempMaskFBO,
    );
  }

  private checkExtensions() {
    const gl = this.gl;

    if (!gl.getExtension("EXT_color_buffer_float")) {
      throw new Error("EXT_color_buffer_float is required for mosaic.");
    }

    if (
      !gl.getExtension("OES_texture_float_linear") &&
      !gl.getExtension("EXT_texture_filter_float")
    ) {
      throw new Error("Float texture linear filtering is required for mosaic.");
    }
  }

  private createTextures() {
    const gl = this.gl;

    this.tempMaskTexture = createFloatTexture(gl);
    this.sourceMaskFBO = createFramebuffer(gl, this.options.sourceMaskTexture);
    this.maskFBO = createFramebuffer(gl, this.options.maskTexture);
    this.tempMaskFBO = createFramebuffer(gl, this.tempMaskTexture);
  }

  private createPrograms() {
    const gl = this.gl;
    const vertexShader = createShader(
      gl,
      gl.VERTEX_SHADER,
      FULL_QUAD_VERTEX_SHADER,
    );
    this.quadBuffer = createFullQuadBuffer(gl);

    this.maskProgram = createProgram(
      gl,
      vertexShader,
      createShader(gl, gl.FRAGMENT_SHADER, maskFrag),
    );
    this.restoreMaskProgram = createProgram(
      gl,
      vertexShader,
      createShader(gl, gl.FRAGMENT_SHADER, restoreMaskFrag),
    );

    this.maskVAO = createFullQuadVAO(gl, this.quadBuffer, this.maskProgram);
    this.restoreMaskVAO = createFullQuadVAO(
      gl,
      this.quadBuffer,
      this.restoreMaskProgram,
    );

    this.setupMaskProgram();
    this.setupRestoreMaskProgram();
  }

  private setupMaskProgram() {
    const gl = this.gl;

    gl.useProgram(this.maskProgram);
    gl.uniform1i(
      gl.getUniformLocation(this.maskProgram, "u_mask"),
      TEXTURE_UNIT.MASK,
    );

    this.uMaskResolution = gl.getUniformLocation(
      this.maskProgram,
      "u_resolution",
    )!;
    this.uMaskStart = gl.getUniformLocation(this.maskProgram, "u_start")!;
    this.uMaskEnd = gl.getUniformLocation(this.maskProgram, "u_end")!;
    this.uMaskRadius = gl.getUniformLocation(this.maskProgram, "u_radius")!;
  }

  private setupRestoreMaskProgram() {
    const gl = this.gl;

    gl.useProgram(this.restoreMaskProgram);
    gl.uniform1i(
      gl.getUniformLocation(this.restoreMaskProgram, "u_mask"),
      TEXTURE_UNIT.MASK,
    );

    this.uRestoreMaskResolution = gl.getUniformLocation(
      this.restoreMaskProgram,
      "u_resolution",
    )!;
    this.uRestoreMaskStart = gl.getUniformLocation(
      this.restoreMaskProgram,
      "u_start",
    )!;
    this.uRestoreMaskEnd = gl.getUniformLocation(
      this.restoreMaskProgram,
      "u_end",
    )!;
    this.uRestoreMaskRadius = gl.getUniformLocation(
      this.restoreMaskProgram,
      "u_radius",
    )!;
  }

  private paint(start: MosaicPoint, end: MosaicPoint): MosaicRect {
    const rect = strokeRect(start, end, this.radius, this.width, this.height);
    const gl = this.gl;

    gl.useProgram(this.maskProgram);
    gl.bindVertexArray(this.maskVAO);
    gl.uniform2f(this.uMaskStart, start.x, start.y);
    gl.uniform2f(this.uMaskEnd, end.x, end.y);
    gl.uniform1f(this.uMaskRadius, this.radius);

    this.drawMaskPass(rect);
    return rect;
  }

  private restore(start: MosaicPoint, end: MosaicPoint): MosaicRect {
    const rect = strokeRect(start, end, this.radius, this.width, this.height);
    const gl = this.gl;

    gl.useProgram(this.restoreMaskProgram);
    gl.bindVertexArray(this.restoreMaskVAO);
    gl.uniform2f(this.uRestoreMaskStart, start.x, start.y);
    gl.uniform2f(this.uRestoreMaskEnd, end.x, end.y);
    gl.uniform1f(this.uRestoreMaskRadius, this.radius);

    this.drawMaskPass(rect);
    return rect;
  }

  private drawMaskPass(rect: MosaicRect) {
    const gl = this.gl;

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.MASK);
    gl.bindTexture(gl.TEXTURE_2D, this.options.maskTexture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.tempMaskFBO);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(rect.x, rect.y, rect.width, rect.height);
    gl.viewport(0, 0, this.width, this.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    this.copyMaskRect(rect, this.tempMaskFBO, this.maskFBO);
    gl.disable(gl.SCISSOR_TEST);
  }

  private copyMaskRect(
    rect: MosaicRect | null,
    readFramebuffer: WebGLFramebuffer,
    drawFramebuffer: WebGLFramebuffer,
  ) {
    if (!rect || rect.width === 0 || rect.height === 0) return;

    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readFramebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, drawFramebuffer);
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
  }
}

function createFloatTexture(gl: WebGL2RenderingContext) {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}

function createFramebuffer(gl: WebGL2RenderingContext, texture: WebGLTexture) {
  const framebuffer = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );
  return framebuffer;
}

function createShader(
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string,
) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message ?? "Shader compile failed.");
  }

  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
) {
  const program = gl.createProgram()!;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(message ?? "Program link failed.");
  }

  return program;
}

function createFullQuadBuffer(gl: WebGL2RenderingContext) {
  const quadBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  return quadBuffer;
}

function createFullQuadVAO(
  gl: WebGL2RenderingContext,
  quadBuffer: WebGLBuffer,
  program: WebGLProgram,
) {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);

  const posLoc = gl.getAttribLocation(program, "a_position");
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  return vao;
}
