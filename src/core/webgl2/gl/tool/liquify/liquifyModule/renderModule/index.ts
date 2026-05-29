import renderFrag from "../render.frag?raw";
import type { LiquifyRect } from "../rect";

export interface CreateLiquifyRenderOptions {
  imageTexture: WebGLTexture;
  displacementTexture: WebGLTexture;
  resultTexture: WebGLTexture;
  width: number;
  height: number;
}

const TEXTURE_UNIT = {
  IMAGE: 13,
  DISPLACEMENT: 14,
};

const FULL_QUAD_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;

void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export function createLiquifyRender(
  gl: WebGL2RenderingContext,
  options: CreateLiquifyRenderOptions,
) {
  return new LiquifyRender(gl, options);
}

class LiquifyRender {
  private width: number;
  private height: number;
  private resultFBO: WebGLFramebuffer;
  private renderProgram: WebGLProgram;
  private quadBuffer: WebGLBuffer;
  private renderVAO: WebGLVertexArrayObject;
  private uRenderResolution: WebGLUniformLocation;

  constructor(
    private gl: WebGL2RenderingContext,
    private options: CreateLiquifyRenderOptions,
  ) {
    this.width = options.width;
    this.height = options.height;
    this.checkExtensions();
    this.createPrograms();
    this.createFramebuffer();
    this.setSize(options.width, options.height);
  }

  render(rect: LiquifyRect | null): LiquifyRect | null {
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
    gl.bindTexture(gl.TEXTURE_2D, this.options.displacementTexture);

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
    gl.deleteFramebuffer(this.resultFBO);
    gl.deleteProgram(this.renderProgram);
    gl.deleteBuffer(this.quadBuffer);
    gl.deleteVertexArray(this.renderVAO);
  }

  private setSize(width: number, height: number) {
    const gl = this.gl;

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

  private createFramebuffer() {
    this.resultFBO = this.gl.createFramebuffer()!;
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
    this.renderVAO = createFullQuadVAO(gl, this.quadBuffer, this.renderProgram);

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
