import blurHorizontalFrag from "./blurHorizontal.frag?raw";
import blurVerticalFrag from "./blurVertical.frag?raw";
import maskFrag from "./mask.frag?raw";
import renderFrag from "./render.frag?raw";
import { pointRect, strokeRect, unionRect } from "./rect";
import type { MosaicPoint, MosaicRect } from "./rect";

export type { MosaicPoint, MosaicRect } from "./rect";

export type MosaicMode = "pixel" | "blur";

export interface CreateMosaicOptions {
  imageTexture: WebGLTexture;
  resultTexture: WebGLTexture;
  width: number;
  height: number;
}

const TEXTURE_UNIT = {
  BLUR: 11,
  TEMP: 12,
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

export function createMosaic(
  gl: WebGL2RenderingContext,
  options: CreateMosaicOptions,
) {
  return new Mosaic(gl, options);
}

class Mosaic {
  private width: number;
  private height: number;
  private radius = 10;
  private strength = 0.5;
  private mode: MosaicMode = "pixel";
  private committedMode: MosaicMode = "pixel";
  private committedStrength = 0.5;
  private lastPoint: MosaicPoint | null = null;
  private strokeRect: MosaicRect | null = null;
  private dirtyRect: MosaicRect | null = null;
  private maskRect: MosaicRect | null = null;
  private pendingMaskRect: MosaicRect | null = null;
  private history: MosaicHistory[] = [];
  private redoHistory: MosaicHistory[] = [];

  private maskTexture: WebGLTexture;
  private tempMaskTexture: WebGLTexture;
  private committedMaskTexture: WebGLTexture;
  private blurTexture: WebGLTexture;
  private maskFBO: WebGLFramebuffer;
  private tempMaskFBO: WebGLFramebuffer;
  private committedMaskFBO: WebGLFramebuffer;
  private blurFBO: WebGLFramebuffer;
  private resultFBO: WebGLFramebuffer;

  private maskProgram: WebGLProgram;
  private renderProgram: WebGLProgram;
  private blurHorizontalProgram: WebGLProgram;
  private blurVerticalProgram: WebGLProgram;
  private quadBuffer: WebGLBuffer;
  private maskVAO: WebGLVertexArrayObject;
  private renderVAO: WebGLVertexArrayObject;
  private blurHorizontalVAO: WebGLVertexArrayObject;
  private blurVerticalVAO: WebGLVertexArrayObject;

  private uMaskResolution: WebGLUniformLocation;
  private uMaskStart: WebGLUniformLocation;
  private uMaskEnd: WebGLUniformLocation;
  private uMaskRadius: WebGLUniformLocation;

  private uRenderResolution: WebGLUniformLocation;
  private uRenderRadius: WebGLUniformLocation;

  private uBlurHorizontalResolution: WebGLUniformLocation;
  private uBlurHorizontalRadius: WebGLUniformLocation;
  private uBlurVerticalResolution: WebGLUniformLocation;
  private uBlurVerticalRadius: WebGLUniformLocation;

  constructor(
    private gl: WebGL2RenderingContext,
    private options: CreateMosaicOptions,
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

  setStrength(strength: number) {
    const nextStrength = Math.max(0, Math.min(1, strength));
    if (this.strength === nextStrength) return;

    this.strength = nextStrength;
    if (this.maskRect) {
      this.dirtyRect = unionRect(this.dirtyRect, this.maskRect);
    }
  }

  setMode(mode: MosaicMode) {
    if (this.mode === mode) return;

    this.mode = mode;
    if (this.maskRect) {
      this.dirtyRect = unionRect(this.dirtyRect, this.maskRect);
    }
  }

  start(point: MosaicPoint) {
    this.lastPoint = point;
    this.strokeRect = pointRect(point, this.radius, this.width, this.height);
  }

  move(point: MosaicPoint): MosaicRect | null {
    if (!this.lastPoint) {
      this.start(point);
      return this.strokeRect;
    }

    const rect = this.drawMask(this.lastPoint, point);
    this.lastPoint = point;
    this.strokeRect = unionRect(this.strokeRect, rect);
    this.dirtyRect = unionRect(this.dirtyRect, rect);
    this.maskRect = unionRect(this.maskRect, rect);
    this.pendingMaskRect = unionRect(this.pendingMaskRect, rect);
    return rect;
  }

  makeHistory() {
    const modeChanged = this.mode !== this.committedMode;
    const strengthChanged = this.strength !== this.committedStrength;
    if (
      !modeChanged &&
      !strengthChanged &&
      (!this.pendingMaskRect ||
        this.pendingMaskRect.width === 0 ||
        this.pendingMaskRect.height === 0)
    ) {
      return;
    }

    const rect = this.pendingMaskRect;
    const history: MosaicHistory = {
      rect,
      before: rect ? this.readMask(rect, this.committedMaskFBO) : null,
      after: rect ? this.readMask(rect, this.maskFBO) : null,
      beforeMode: this.committedMode,
      afterMode: this.mode,
      beforeStrength: this.committedStrength,
      afterStrength: this.strength,
    };

    this.history.push(history);
    this.redoHistory = [];
    this.copyMaskRect(rect, this.maskFBO, this.committedMaskFBO);
    this.committedMode = this.mode;
    this.committedStrength = this.strength;
    this.strokeRect = null;
    this.pendingMaskRect = null;
    this.lastPoint = null;
  }

  cancel() {
    const rect = this.pendingMaskRect;
    this.copyMaskRect(rect, this.committedMaskFBO, this.maskFBO);
    this.copyMaskRect(rect, this.committedMaskFBO, this.tempMaskFBO);

    if (rect) {
      this.dirtyRect = unionRect(this.dirtyRect, rect);
    }
    if (this.mode !== this.committedMode && this.maskRect) {
      this.dirtyRect = unionRect(this.dirtyRect, this.maskRect);
    }
    if (this.strength !== this.committedStrength && this.maskRect) {
      this.dirtyRect = unionRect(this.dirtyRect, this.maskRect);
    }

    this.mode = this.committedMode;
    this.strength = this.committedStrength;
    this.strokeRect = null;
    this.pendingMaskRect = null;
    this.lastPoint = null;
  }

  undo() {
    const history = this.history.pop();
    if (!history) return;

    this.redoHistory.push(history);
    if (history.rect && history.before) {
      this.writeMask(history.rect, history.before);
      this.dirtyRect = unionRect(this.dirtyRect, history.rect);
    }
    if (this.mode !== history.beforeMode && this.maskRect) {
      this.dirtyRect = unionRect(this.dirtyRect, this.maskRect);
    }
    if (this.strength !== history.beforeStrength && this.maskRect) {
      this.dirtyRect = unionRect(this.dirtyRect, this.maskRect);
    }
    this.mode = history.beforeMode;
    this.committedMode = history.beforeMode;
    this.strength = history.beforeStrength;
    this.committedStrength = history.beforeStrength;
  }

  redo() {
    const history = this.redoHistory.pop();
    if (!history) return;

    this.history.push(history);
    if (history.rect && history.after) {
      this.writeMask(history.rect, history.after);
      this.dirtyRect = unionRect(this.dirtyRect, history.rect);
    }
    if (this.mode !== history.afterMode && this.maskRect) {
      this.dirtyRect = unionRect(this.dirtyRect, this.maskRect);
    }
    if (this.strength !== history.afterStrength && this.maskRect) {
      this.dirtyRect = unionRect(this.dirtyRect, this.maskRect);
    }
    this.mode = history.afterMode;
    this.committedMode = history.afterMode;
    this.strength = history.afterStrength;
    this.committedStrength = history.afterStrength;
  }

  getHistoryCount() {
    return {
      undoCount: this.history.length,
      redoCount: this.redoHistory.length,
    };
  }

  render(): MosaicRect | null {
    const rect = this.dirtyRect;
    if (!rect || rect.width === 0 || rect.height === 0) {
      return null;
    }

    if (this.mode === "blur") {
      this.renderGaussian(rect);
      this.dirtyRect = null;
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
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultFBO);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(rect.x, rect.y, rect.width, rect.height);
    gl.viewport(0, 0, this.width, this.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.SCISSOR_TEST);

    this.dirtyRect = null;
    return rect;
  }

  destroy() {
    const gl = this.gl;

    gl.deleteTexture(this.maskTexture);
    gl.deleteTexture(this.tempMaskTexture);
    gl.deleteTexture(this.committedMaskTexture);
    gl.deleteTexture(this.blurTexture);
    gl.deleteFramebuffer(this.maskFBO);
    gl.deleteFramebuffer(this.tempMaskFBO);
    gl.deleteFramebuffer(this.committedMaskFBO);
    gl.deleteFramebuffer(this.blurFBO);
    gl.deleteFramebuffer(this.resultFBO);
    gl.deleteProgram(this.maskProgram);
    gl.deleteProgram(this.renderProgram);
    gl.deleteProgram(this.blurHorizontalProgram);
    gl.deleteProgram(this.blurVerticalProgram);
    gl.deleteBuffer(this.quadBuffer);
    gl.deleteVertexArray(this.maskVAO);
    gl.deleteVertexArray(this.renderVAO);
    gl.deleteVertexArray(this.blurHorizontalVAO);
    gl.deleteVertexArray(this.blurVerticalVAO);
  }

  private setTextureSize(width: number, height: number) {
    const gl = this.gl;

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.MASK);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, width, height, 0, gl.RED, gl.FLOAT, null);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, this.tempMaskTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, width, height, 0, gl.RED, gl.FLOAT, null);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, this.committedMaskTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, width, height, 0, gl.RED, gl.FLOAT, null);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.BLUR);
    gl.bindTexture(gl.TEXTURE_2D, this.blurTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

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

    gl.useProgram(this.maskProgram);
    gl.uniform2f(this.uMaskResolution, width, height);
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

    if (!gl.getExtension("OES_texture_float_linear") && !gl.getExtension("EXT_texture_filter_float")) {
      throw new Error("Float texture linear filtering is required for mosaic.");
    }
  }

  private createTextures() {
    const gl = this.gl;

    this.maskTexture = createFloatTexture(gl);
    this.tempMaskTexture = createFloatTexture(gl);
    this.committedMaskTexture = createFloatTexture(gl);
    this.blurTexture = createColorTexture(gl);

    this.maskFBO = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.maskFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.maskTexture,
      0,
    );

    this.tempMaskFBO = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.tempMaskFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.tempMaskTexture,
      0,
    );

    this.committedMaskFBO = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.committedMaskFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.committedMaskTexture,
      0,
    );

    this.blurFBO = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.blurTexture,
      0,
    );

    this.resultFBO = gl.createFramebuffer()!;
  }

  private createPrograms() {
    const gl = this.gl;
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, FULL_QUAD_VERTEX_SHADER);
    this.quadBuffer = createFullQuadBuffer(gl);

    this.maskProgram = createProgram(
      gl,
      vertexShader,
      createShader(gl, gl.FRAGMENT_SHADER, maskFrag),
    );
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

    this.maskVAO = createFullQuadVAO(gl, this.quadBuffer, this.maskProgram);
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

    this.setupMaskProgram();
    this.setupRenderProgram();
    this.setupBlurPrograms();
  }

  private setupMaskProgram() {
    const gl = this.gl;

    gl.useProgram(this.maskProgram);
    gl.uniform1i(
      gl.getUniformLocation(this.maskProgram, "u_mask"),
      TEXTURE_UNIT.MASK,
    );

    this.uMaskResolution = gl.getUniformLocation(this.maskProgram, "u_resolution")!;
    this.uMaskStart = gl.getUniformLocation(this.maskProgram, "u_start")!;
    this.uMaskEnd = gl.getUniformLocation(this.maskProgram, "u_end")!;
    this.uMaskRadius = gl.getUniformLocation(this.maskProgram, "u_radius")!;
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

    this.uRenderResolution = gl.getUniformLocation(this.renderProgram, "u_resolution")!;
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
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);

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

  private drawMask(start: MosaicPoint, end: MosaicPoint): MosaicRect {
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

  private drawMaskPass(rect: MosaicRect) {
    const gl = this.gl;

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.MASK);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.tempMaskFBO);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(rect.x, rect.y, rect.width, rect.height);
    gl.viewport(0, 0, this.width, this.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.tempMaskFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.maskFBO);
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

    gl.disable(gl.SCISSOR_TEST);
  }

  private readMask(rect: MosaicRect, framebuffer: WebGLFramebuffer) {
    const gl = this.gl;
    const pixels = new Float32Array(rect.width * rect.height);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer);
    gl.readPixels(rect.x, rect.y, rect.width, rect.height, gl.RED, gl.FLOAT, pixels);

    return pixels;
  }

  private writeMask(rect: MosaicRect, mask: Float32Array) {
    const gl = this.gl;

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.MASK);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      gl.RED,
      gl.FLOAT,
      mask,
    );

    this.copyMaskRect(rect, this.maskFBO, this.tempMaskFBO);
    this.copyMaskRect(rect, this.maskFBO, this.committedMaskFBO);
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

interface MosaicHistory {
  rect: MosaicRect | null;
  before: Float32Array | null;
  after: Float32Array | null;
  beforeMode: MosaicMode;
  afterMode: MosaicMode;
  beforeStrength: number;
  afterStrength: number;
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
