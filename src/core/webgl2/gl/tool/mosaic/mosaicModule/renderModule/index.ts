import blurHorizontalFrag from "../blurHorizontal.frag?raw";
import blurVerticalFrag from "../blurVertical.frag?raw";
import renderFrag from "../render.frag?raw";
import type { MosaicRect } from "../rect";
import type { MosaicMode } from "..";

type MosaicEffectMode = Exclude<MosaicMode, "restore">;

export interface CreateMosaicRenderOptions {
  imageTexture: WebGLTexture;
  maskTexture: WebGLTexture;
  resultTexture: WebGLTexture;
  width: number;
  height: number;
}

const TEXTURE_UNIT = {
  BLUR: 11,
  IMAGE: 13,
  MASK: 14,
};

const FULL_QUAD_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;

void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export function createMosaicRender(
  gl: WebGL2RenderingContext,
  options: CreateMosaicRenderOptions,
) {
  return new MosaicRender(gl, options);
}

class MosaicRender {
  private width: number;
  private height: number;
  private strength = 0.5;
  private mode: MosaicEffectMode = "pixel";
  private blurTexture: WebGLTexture;
  private blurFBO: WebGLFramebuffer;
  private resultFBO: WebGLFramebuffer;
  private renderProgram: WebGLProgram;
  private blurHorizontalProgram: WebGLProgram;
  private blurVerticalProgram: WebGLProgram;
  private quadBuffer: WebGLBuffer;
  private renderVAO: WebGLVertexArrayObject;
  private blurHorizontalVAO: WebGLVertexArrayObject;
  private blurVerticalVAO: WebGLVertexArrayObject;
  private uRenderResolution: WebGLUniformLocation;
  private uRenderRadius: WebGLUniformLocation;
  private uBlurHorizontalResolution: WebGLUniformLocation;
  private uBlurHorizontalRadius: WebGLUniformLocation;
  private uBlurVerticalResolution: WebGLUniformLocation;
  private uBlurVerticalRadius: WebGLUniformLocation;

  constructor(
    private gl: WebGL2RenderingContext,
    private options: CreateMosaicRenderOptions,
  ) {
    this.width = options.width;
    this.height = options.height;
    this.checkExtensions();
    this.createTextures();
    this.createPrograms();
    this.setTextureSize(options.width, options.height);
  }

  setStrength(strength: number) {
    this.strength = Math.max(0, Math.min(1, strength));
  }

  setMode(mode: MosaicEffectMode) {
    this.mode = mode;
  }

  getStrength() {
    return this.strength;
  }

  getMode() {
    return this.mode;
  }

  render(rect: MosaicRect | null): MosaicRect | null {
    if (!rect || rect.width === 0 || rect.height === 0) {
      return null;
    }

    if (this.mode === "blur") {
      this.renderGaussian(rect);
      return rect;
    }

    const gl = this.gl;
    gl.useProgram(this.renderProgram);
    gl.bindVertexArray(this.renderVAO);
    gl.uniform2f(this.uRenderResolution, this.width, this.height);
    gl.uniform1f(this.uRenderRadius, this.getEffectRadius());

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.IMAGE);
    gl.bindTexture(gl.TEXTURE_2D, this.options.imageTexture);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.MASK);
    gl.bindTexture(gl.TEXTURE_2D, this.options.maskTexture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultFBO);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(rect.x, rect.y, rect.width, rect.height);
    gl.viewport(0, 0, this.width, this.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.SCISSOR_TEST);
    return rect;
  }

  destroy() {
    const gl = this.gl;

    gl.deleteTexture(this.blurTexture);
    gl.deleteFramebuffer(this.blurFBO);
    gl.deleteFramebuffer(this.resultFBO);
    gl.deleteProgram(this.renderProgram);
    gl.deleteProgram(this.blurHorizontalProgram);
    gl.deleteProgram(this.blurVerticalProgram);
    gl.deleteBuffer(this.quadBuffer);
    gl.deleteVertexArray(this.renderVAO);
    gl.deleteVertexArray(this.blurHorizontalVAO);
    gl.deleteVertexArray(this.blurVerticalVAO);
  }

  private setTextureSize(width: number, height: number) {
    const gl = this.gl;

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.BLUR);
    gl.bindTexture(gl.TEXTURE_2D, this.blurTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.blurTexture,
      0,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.options.resultTexture,
      0,
    );

    gl.useProgram(this.renderProgram);
    gl.uniform2f(this.uRenderResolution, width, height);
    gl.useProgram(this.blurHorizontalProgram);
    gl.uniform2f(this.uBlurHorizontalResolution, width, height);
    gl.useProgram(this.blurVerticalProgram);
    gl.uniform2f(this.uBlurVerticalResolution, width, height);
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

    this.blurTexture = createColorTexture(gl);
    this.blurFBO = gl.createFramebuffer()!;
    this.resultFBO = gl.createFramebuffer()!;
  }

  private createPrograms() {
    const gl = this.gl;
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, FULL_QUAD_VERTEX_SHADER);
    this.quadBuffer = createFullQuadBuffer(gl);

    this.renderProgram = createProgram(
      gl,
      vertexShader,
      createShader(gl, gl.FRAGMENT_SHADER, renderFrag),
    );
    this.blurHorizontalProgram = createProgram(
      gl,
      vertexShader,
      createShader(gl, gl.FRAGMENT_SHADER, blurHorizontalFrag),
    );
    this.blurVerticalProgram = createProgram(
      gl,
      vertexShader,
      createShader(gl, gl.FRAGMENT_SHADER, blurVerticalFrag),
    );

    this.renderVAO = createFullQuadVAO(gl, this.quadBuffer, this.renderProgram);
    this.blurHorizontalVAO = createFullQuadVAO(
      gl,
      this.quadBuffer,
      this.blurHorizontalProgram,
    );
    this.blurVerticalVAO = createFullQuadVAO(
      gl,
      this.quadBuffer,
      this.blurVerticalProgram,
    );

    this.setupRenderProgram();
    this.setupBlurPrograms();
  }

  private setupRenderProgram() {
    const gl = this.gl;

    gl.useProgram(this.renderProgram);
    gl.uniform1i(
      gl.getUniformLocation(this.renderProgram, "u_source"),
      TEXTURE_UNIT.IMAGE,
    );
    gl.uniform1i(
      gl.getUniformLocation(this.renderProgram, "u_mask"),
      TEXTURE_UNIT.MASK,
    );

    this.uRenderResolution = gl.getUniformLocation(
      this.renderProgram,
      "u_resolution",
    )!;
    this.uRenderRadius = gl.getUniformLocation(this.renderProgram, "u_radius")!;
  }

  private setupBlurPrograms() {
    const gl = this.gl;

    gl.useProgram(this.blurHorizontalProgram);
    gl.uniform1i(
      gl.getUniformLocation(this.blurHorizontalProgram, "u_source"),
      TEXTURE_UNIT.IMAGE,
    );
    this.uBlurHorizontalResolution = gl.getUniformLocation(
      this.blurHorizontalProgram,
      "u_resolution",
    )!;
    this.uBlurHorizontalRadius = gl.getUniformLocation(
      this.blurHorizontalProgram,
      "u_blurRadius",
    )!;

    gl.useProgram(this.blurVerticalProgram);
    gl.uniform1i(
      gl.getUniformLocation(this.blurVerticalProgram, "u_source"),
      TEXTURE_UNIT.IMAGE,
    );
    gl.uniform1i(
      gl.getUniformLocation(this.blurVerticalProgram, "u_blur"),
      TEXTURE_UNIT.BLUR,
    );
    gl.uniform1i(
      gl.getUniformLocation(this.blurVerticalProgram, "u_mask"),
      TEXTURE_UNIT.MASK,
    );
    this.uBlurVerticalResolution = gl.getUniformLocation(
      this.blurVerticalProgram,
      "u_resolution",
    )!;
    this.uBlurVerticalRadius = gl.getUniformLocation(
      this.blurVerticalProgram,
      "u_blurRadius",
    )!;
  }

  private renderGaussian(rect: MosaicRect) {
    const gl = this.gl;
    const effectRadius = this.getEffectRadius();
    const blurRect = expandRect(rect, effectRadius, this.width, this.height);

    gl.useProgram(this.blurHorizontalProgram);
    gl.bindVertexArray(this.blurHorizontalVAO);
    gl.uniform2f(this.uBlurHorizontalResolution, this.width, this.height);
    gl.uniform1i(this.uBlurHorizontalRadius, effectRadius);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.IMAGE);
    gl.bindTexture(gl.TEXTURE_2D, this.options.imageTexture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBO);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(blurRect.x, blurRect.y, blurRect.width, blurRect.height);
    gl.viewport(0, 0, this.width, this.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.useProgram(this.blurVerticalProgram);
    gl.bindVertexArray(this.blurVerticalVAO);
    gl.uniform2f(this.uBlurVerticalResolution, this.width, this.height);
    gl.uniform1i(this.uBlurVerticalRadius, effectRadius);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.IMAGE);
    gl.bindTexture(gl.TEXTURE_2D, this.options.imageTexture);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.BLUR);
    gl.bindTexture(gl.TEXTURE_2D, this.blurTexture);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.MASK);
    gl.bindTexture(gl.TEXTURE_2D, this.options.maskTexture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultFBO);
    gl.scissor(rect.x, rect.y, rect.width, rect.height);
    gl.viewport(0, 0, this.width, this.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.SCISSOR_TEST);
  }

  private getEffectRadius() {
    const basis = Math.max(this.width, this.height);
    return Math.max(1, Math.round(basis * 0.05 * this.strength));
  }
}

function createColorTexture(gl: WebGL2RenderingContext) {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
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

function expandRect(
  rect: MosaicRect,
  amount: number,
  width: number,
  height: number,
): MosaicRect {
  const x = Math.max(0, rect.x - amount);
  const y = Math.max(0, rect.y - amount);
  const right = Math.min(width, rect.x + rect.width + amount);
  const bottom = Math.min(height, rect.y + rect.height + amount);

  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}
