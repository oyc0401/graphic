import { getEaseInOutLiquifyLookup } from "./liquifyLookup";
import liquifyPushFrag from "./push.frag?raw";
import renderFrag from "./render.frag?raw";
import { pointRect, strokeRect, unionRect } from "./rect";
import type { LiquifyPoint, LiquifyRect } from "./rect";
import liquifyScaleFrag from "./scale.frag?raw";
import liquifyTwirlFrag from "./spin.frag?raw";

export type { LiquifyPoint, LiquifyRect } from "./rect";

export interface CreateLiquifyOptions {
  imageTexture: WebGLTexture;
  resultTexture: WebGLTexture;
  width: number;
  height: number;
}

const TEXTURE_UNIT = {
  TEMP: 12,
  IMAGE: 13,
  DISPLACEMENT: 14,
  PRIMITIVE: 15,
};

const FULL_QUAD_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;

void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export function createLiquify(
  gl: WebGL2RenderingContext,
  options: CreateLiquifyOptions,
) {
  return new Liquify(gl, options);
}

class Liquify {
  private width: number;
  private height: number;
  private radius = 10;
  private strength = 0.5;
  private lastPoint: LiquifyPoint | null = null;
  private currentPoint: LiquifyPoint | null = null;
  private strokeRect: LiquifyRect | null = null;
  private dirtyRect: LiquifyRect | null = null;
  private history: LiquifyHistory[] = [];
  private redoHistory: LiquifyHistory[] = [];

  private displacementTexture: WebGLTexture;
  private tempDisplacementTexture: WebGLTexture;
  private committedDisplacementTexture: WebGLTexture;
  private primitiveTexture: WebGLTexture;
  private displacementFBO: WebGLFramebuffer;
  private tempDisplacementFBO: WebGLFramebuffer;
  private committedDisplacementFBO: WebGLFramebuffer;
  private resultFBO: WebGLFramebuffer;

  private pushProgram: WebGLProgram;
  private twirlProgram: WebGLProgram;
  private scaleProgram: WebGLProgram;
  private renderProgram: WebGLProgram;
  private quadBuffer: WebGLBuffer;
  private pushVAO: WebGLVertexArrayObject;
  private twirlVAO: WebGLVertexArrayObject;
  private scaleVAO: WebGLVertexArrayObject;
  private renderVAO: WebGLVertexArrayObject;

  private uPushResolution: WebGLUniformLocation;
  private uPushStart: WebGLUniformLocation;
  private uPushEnd: WebGLUniformLocation;
  private uPushRadius: WebGLUniformLocation;
  private uPushStrength: WebGLUniformLocation;

  private uTwirlResolution: WebGLUniformLocation;
  private uTwirlCenter: WebGLUniformLocation;
  private uTwirlRadius: WebGLUniformLocation;
  private uTwirlStrength: WebGLUniformLocation;
  private uTwirlDirection: WebGLUniformLocation;

  private uScaleResolution: WebGLUniformLocation;
  private uScaleCenter: WebGLUniformLocation;
  private uScaleRadius: WebGLUniformLocation;
  private uScaleStrength: WebGLUniformLocation;
  private uScaleDirection: WebGLUniformLocation;

  private uRenderResolution: WebGLUniformLocation;

  constructor(
    private gl: WebGL2RenderingContext,
    private options: CreateLiquifyOptions,
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
    this.strength = strength;
  }

  start(point: LiquifyPoint) {
    this.lastPoint = point;
    this.currentPoint = point;
    this.strokeRect = pointRect(point, this.radius, this.width, this.height);
  }

  move(point: LiquifyPoint): LiquifyRect | null {
    if (!this.lastPoint) {
      this.start(point);
      return this.strokeRect;
    }

    const rect = this.push(this.lastPoint, point);
    this.lastPoint = point;
    this.currentPoint = point;
    this.strokeRect = unionRect(this.strokeRect, rect);
    if (rect) {
      this.dirtyRect = unionRect(this.dirtyRect, rect);
    }
    return rect;
  }

  spin(point = this.currentPoint): LiquifyRect | null {
    if (!point) return null;

    const rect = this.twirl(point, 1);
    this.currentPoint = point;
    this.strokeRect = unionRect(this.strokeRect, rect);
    this.dirtyRect = unionRect(this.dirtyRect, rect);
    return rect;
  }

  rightSpin(point = this.currentPoint): LiquifyRect | null {
    if (!point) return null;

    const rect = this.twirl(point, -1);
    this.currentPoint = point;
    this.strokeRect = unionRect(this.strokeRect, rect);
    this.dirtyRect = unionRect(this.dirtyRect, rect);
    return rect;
  }

  bloat(point = this.currentPoint): LiquifyRect | null {
    if (!point) return null;

    const rect = this.scale(point, 1);
    this.currentPoint = point;
    this.strokeRect = unionRect(this.strokeRect, rect);
    this.dirtyRect = unionRect(this.dirtyRect, rect);
    return rect;
  }

  pucker(point = this.currentPoint): LiquifyRect | null {
    if (!point) return null;

    const rect = this.scale(point, -1);
    this.currentPoint = point;
    this.strokeRect = unionRect(this.strokeRect, rect);
    this.dirtyRect = unionRect(this.dirtyRect, rect);
    return rect;
  }

  makeHistory() {
    if (!this.strokeRect || this.strokeRect.width === 0 || this.strokeRect.height === 0) {
      return;
    }

    const history: LiquifyHistory = {
      rect: this.strokeRect,
      before: this.readDisplacement(this.strokeRect, this.committedDisplacementFBO),
      after: this.readDisplacement(this.strokeRect, this.displacementFBO),
    };

    this.history.push(history);
    this.redoHistory = [];
    this.copyDisplacementRect(this.strokeRect, this.displacementFBO, this.committedDisplacementFBO);
    this.strokeRect = null;
    this.lastPoint = null;
  }

  cancel() {
    const rect = this.strokeRect;
    this.copyDisplacementRect(
      rect,
      this.committedDisplacementFBO,
      this.displacementFBO,
    );
    this.copyDisplacementRect(
      rect,
      this.committedDisplacementFBO,
      this.tempDisplacementFBO,
    );
    if (rect) {
      this.dirtyRect = unionRect(this.dirtyRect, rect);
    }
    this.strokeRect = null;
    this.lastPoint = null;
  }

  undo() {
    const history = this.history.pop();
    if (!history) return;

    this.redoHistory.push(history);
    this.writeDisplacement(history.rect, history.before);
    this.dirtyRect = unionRect(this.dirtyRect, history.rect);
  }

  redo() {
    const history = this.redoHistory.pop();
    if (!history) return;

    this.history.push(history);
    this.writeDisplacement(history.rect, history.after);
    this.dirtyRect = unionRect(this.dirtyRect, history.rect);
  }

  getHistoryCount() {
    return {
      undoCount: this.history.length,
      redoCount: this.redoHistory.length,
    };
  }

  destroy() {
    const gl = this.gl;

    gl.deleteTexture(this.displacementTexture);
    gl.deleteTexture(this.tempDisplacementTexture);
    gl.deleteTexture(this.committedDisplacementTexture);
    gl.deleteTexture(this.primitiveTexture);
    gl.deleteFramebuffer(this.displacementFBO);
    gl.deleteFramebuffer(this.tempDisplacementFBO);
    gl.deleteFramebuffer(this.committedDisplacementFBO);
    gl.deleteFramebuffer(this.resultFBO);
    gl.deleteProgram(this.pushProgram);
    gl.deleteProgram(this.twirlProgram);
    gl.deleteProgram(this.scaleProgram);
    gl.deleteProgram(this.renderProgram);
    gl.deleteBuffer(this.quadBuffer);
    gl.deleteVertexArray(this.pushVAO);
    gl.deleteVertexArray(this.twirlVAO);
    gl.deleteVertexArray(this.scaleVAO);
    gl.deleteVertexArray(this.renderVAO);
  }

  render(): LiquifyRect | null {
    const rect = this.dirtyRect;
    if (!rect || rect.width === 0 || rect.height === 0) {
      return null;
    }

    const gl = this.gl;

    gl.useProgram(this.renderProgram);
    gl.bindVertexArray(this.renderVAO);
    gl.uniform2f(this.uRenderResolution, this.width, this.height);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.IMAGE);
    gl.bindTexture(gl.TEXTURE_2D, this.options.imageTexture);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, this.displacementTexture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultFBO);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(rect.x, rect.y, rect.width, rect.height);
    gl.viewport(0, 0, this.width, this.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.SCISSOR_TEST);

    this.dirtyRect = null;
    return rect;
  }

  private setTextureSize(width: number, height: number) {
    const gl = this.gl;

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, this.displacementTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, width, height, 0, gl.RG, gl.FLOAT, null);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, this.tempDisplacementTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, width, height, 0, gl.RG, gl.FLOAT, null);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, this.committedDisplacementTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, width, height, 0, gl.RG, gl.FLOAT, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.options.resultTexture,
      0,
    );

    gl.useProgram(this.pushProgram);
    gl.uniform2f(this.uPushResolution, width, height);
    gl.useProgram(this.twirlProgram);
    gl.uniform2f(this.uTwirlResolution, width, height);
    gl.useProgram(this.scaleProgram);
    gl.uniform2f(this.uScaleResolution, width, height);
    gl.useProgram(this.renderProgram);
    gl.uniform2f(this.uRenderResolution, width, height);
  }

  private checkExtensions() {
    const gl = this.gl;

    if (!gl.getExtension("EXT_color_buffer_float")) {
      throw new Error("EXT_color_buffer_float is required for liquify.");
    }

    if (!gl.getExtension("OES_texture_float_linear") && !gl.getExtension("EXT_texture_filter_float")) {
      throw new Error("Float texture linear filtering is required for liquify.");
    }
  }

  private createTextures() {
    const gl = this.gl;

    this.displacementTexture = createFloatTexture(gl);
    this.tempDisplacementTexture = createFloatTexture(gl);
    this.committedDisplacementTexture = createFloatTexture(gl);

    this.displacementFBO = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.displacementFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.displacementTexture,
      0,
    );

    this.tempDisplacementFBO = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.tempDisplacementFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.tempDisplacementTexture,
      0,
    );

    this.committedDisplacementFBO = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.committedDisplacementFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.committedDisplacementTexture,
      0,
    );

    this.resultFBO = gl.createFramebuffer()!;
  }

  private createPrograms() {
    const gl = this.gl;
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, FULL_QUAD_VERTEX_SHADER);
    this.quadBuffer = createFullQuadBuffer(gl);

    this.pushProgram = createProgram(
      gl,
      vertexShader,
      createShader(gl, gl.FRAGMENT_SHADER, liquifyPushFrag),
    );
    this.twirlProgram = createProgram(
      gl,
      vertexShader,
      createShader(gl, gl.FRAGMENT_SHADER, liquifyTwirlFrag),
    );
    this.scaleProgram = createProgram(
      gl,
      vertexShader,
      createShader(gl, gl.FRAGMENT_SHADER, liquifyScaleFrag),
    );
    this.renderProgram = createProgram(
      gl,
      vertexShader,
      createShader(gl, gl.FRAGMENT_SHADER, renderFrag),
    );

    this.pushVAO = createFullQuadVAO(gl, this.quadBuffer, this.pushProgram);
    this.twirlVAO = createFullQuadVAO(gl, this.quadBuffer, this.twirlProgram);
    this.scaleVAO = createFullQuadVAO(gl, this.quadBuffer, this.scaleProgram);
    this.renderVAO = createFullQuadVAO(gl, this.quadBuffer, this.renderProgram);

    this.setupPushProgram();
    this.setupTwirlProgram();
    this.setupScaleProgram();
    this.setupRenderProgram();
  }

  private setupPushProgram() {
    const gl = this.gl;
    const lookup = getEaseInOutLiquifyLookup();
    this.primitiveTexture = createPrimitiveTexture(gl, lookup);

    gl.useProgram(this.pushProgram);
    gl.uniform1i(
      gl.getUniformLocation(this.pushProgram, "u_displacement"),
      TEXTURE_UNIT.DISPLACEMENT,
    );
    gl.uniform1i(
      gl.getUniformLocation(this.pushProgram, "u_primitive"),
      TEXTURE_UNIT.PRIMITIVE,
    );

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.PRIMITIVE);
    gl.bindTexture(gl.TEXTURE_2D, this.primitiveTexture);

    this.uPushResolution = gl.getUniformLocation(this.pushProgram, "u_resolution")!;
    this.uPushStart = gl.getUniformLocation(this.pushProgram, "u_start")!;
    this.uPushEnd = gl.getUniformLocation(this.pushProgram, "u_end")!;
    this.uPushRadius = gl.getUniformLocation(this.pushProgram, "u_radius")!;
    this.uPushStrength = gl.getUniformLocation(this.pushProgram, "u_strength")!;
  }

  private setupTwirlProgram() {
    const gl = this.gl;

    gl.useProgram(this.twirlProgram);
    gl.uniform1i(
      gl.getUniformLocation(this.twirlProgram, "u_displacement"),
      TEXTURE_UNIT.DISPLACEMENT,
    );

    this.uTwirlResolution = gl.getUniformLocation(this.twirlProgram, "u_resolution")!;
    this.uTwirlCenter = gl.getUniformLocation(this.twirlProgram, "u_center")!;
    this.uTwirlRadius = gl.getUniformLocation(this.twirlProgram, "u_radius")!;
    this.uTwirlStrength = gl.getUniformLocation(this.twirlProgram, "u_strength")!;
    this.uTwirlDirection = gl.getUniformLocation(this.twirlProgram, "u_direction")!;
  }

  private setupScaleProgram() {
    const gl = this.gl;

    gl.useProgram(this.scaleProgram);
    gl.uniform1i(
      gl.getUniformLocation(this.scaleProgram, "u_displacement"),
      TEXTURE_UNIT.DISPLACEMENT,
    );

    this.uScaleResolution = gl.getUniformLocation(this.scaleProgram, "u_resolution")!;
    this.uScaleCenter = gl.getUniformLocation(this.scaleProgram, "u_center")!;
    this.uScaleRadius = gl.getUniformLocation(this.scaleProgram, "u_radius")!;
    this.uScaleStrength = gl.getUniformLocation(this.scaleProgram, "u_strength")!;
    this.uScaleDirection = gl.getUniformLocation(this.scaleProgram, "u_direction")!;
  }

  private setupRenderProgram() {
    const gl = this.gl;

    gl.useProgram(this.renderProgram);
    gl.uniform1i(
      gl.getUniformLocation(this.renderProgram, "u_source"),
      TEXTURE_UNIT.IMAGE,
    );
    gl.uniform1i(
      gl.getUniformLocation(this.renderProgram, "u_displacement"),
      TEXTURE_UNIT.DISPLACEMENT,
    );

    this.uRenderResolution = gl.getUniformLocation(this.renderProgram, "u_resolution")!;
  }

  private push(start: LiquifyPoint, end: LiquifyPoint): LiquifyRect {
    const rect = strokeRect(start, end, this.radius, this.width, this.height);
    const gl = this.gl;

    gl.useProgram(this.pushProgram);
    gl.bindVertexArray(this.pushVAO);
    gl.uniform2f(this.uPushStart, start.x, start.y);
    gl.uniform2f(this.uPushEnd, end.x, end.y);
    gl.uniform1f(this.uPushRadius, this.radius);
    gl.uniform1f(this.uPushStrength, this.strength);

    this.drawDisplacementPass(rect);
    return rect;
  }

  private twirl(point: LiquifyPoint, direction: number): LiquifyRect {
    const rect = pointRect(point, this.radius, this.width, this.height);
    const gl = this.gl;

    gl.useProgram(this.twirlProgram);
    gl.bindVertexArray(this.twirlVAO);
    gl.uniform2f(this.uTwirlCenter, point.x, point.y);
    gl.uniform1f(this.uTwirlRadius, this.radius);
    gl.uniform1f(this.uTwirlStrength, this.strength);
    gl.uniform1f(this.uTwirlDirection, direction);

    this.drawDisplacementPass(rect);
    return rect;
  }

  private scale(point: LiquifyPoint, direction: number): LiquifyRect {
    const rect = pointRect(point, this.radius, this.width, this.height);
    const gl = this.gl;

    gl.useProgram(this.scaleProgram);
    gl.bindVertexArray(this.scaleVAO);
    gl.uniform2f(this.uScaleCenter, point.x, point.y);
    gl.uniform1f(this.uScaleRadius, this.radius);
    gl.uniform1f(this.uScaleStrength, this.strength);
    gl.uniform1f(this.uScaleDirection, direction);

    this.drawDisplacementPass(rect);
    return rect;
  }

  private drawDisplacementPass(rect: LiquifyRect) {
    const gl = this.gl;

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, this.displacementTexture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.tempDisplacementFBO);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(rect.x, rect.y, rect.width, rect.height);
    gl.viewport(0, 0, this.width, this.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.tempDisplacementFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.displacementFBO);
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

  private readDisplacement(rect: LiquifyRect, framebuffer: WebGLFramebuffer) {
    const gl = this.gl;
    const pixels = new Float32Array(rect.width * rect.height * 2);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer);
    gl.readPixels(rect.x, rect.y, rect.width, rect.height, gl.RG, gl.FLOAT, pixels);

    return pixels;
  }

  private writeDisplacement(rect: LiquifyRect, displacement: Float32Array) {
    const gl = this.gl;

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, this.displacementTexture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      gl.RG,
      gl.FLOAT,
      displacement,
    );

    this.copyDisplacementRect(rect, this.displacementFBO, this.tempDisplacementFBO);
    this.copyDisplacementRect(rect, this.displacementFBO, this.committedDisplacementFBO);
  }

  private copyDisplacementRect(
    rect: LiquifyRect | null,
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

interface LiquifyHistory {
  rect: LiquifyRect;
  before: Float32Array;
  after: Float32Array;
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

function createPrimitiveTexture(
  gl: WebGL2RenderingContext,
  lookup: ReturnType<typeof getEaseInOutLiquifyLookup>,
) {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.R32F,
    lookup.primitiveWidth,
    lookup.primitiveHeight,
    0,
    gl.RED,
    gl.FLOAT,
    lookup.primitive,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}
