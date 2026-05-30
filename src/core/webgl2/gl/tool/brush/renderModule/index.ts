import brushFrag from "./brush.frag?raw";
import eraserFrag from "./eraser.frag?raw";

export type BrushRenderMode = "brush" | "eraser";
export type BrushRenderColor = [number, number, number, number];

export interface BrushRenderRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CreateBrushRenderOptions {
  imageTexture: WebGLTexture;
  resultTexture: WebGLTexture;
  maskTexture: WebGLTexture;
  width: number;
  height: number;
}

const TEXTURE_UNIT = {
  SOURCE: 0,
  PATHMAP: 3,
};

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;

void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export function createBrushRender(
  gl: WebGL2RenderingContext,
  options: CreateBrushRenderOptions,
) {
  return new BrushRender(gl, options);
}

export { createBrushRender as BrushRenderModule };

class BrushRender {
  private readonly width: number;
  private readonly height: number;
  private readonly resultFBO: WebGLFramebuffer;
  private readonly brushProgram: WebGLProgram;
  private readonly eraserProgram: WebGLProgram;
  private readonly brushVAO: WebGLVertexArrayObject;
  private readonly eraserVAO: WebGLVertexArrayObject;
  private mode: BrushRenderMode = "brush";
  private color: BrushRenderColor = [0, 0, 0, 1];

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly options: CreateBrushRenderOptions,
  ) {
    this.width = options.width;
    this.height = options.height;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    this.brushProgram = createProgram(
      gl,
      vertexShader,
      createShader(gl, gl.FRAGMENT_SHADER, brushFrag),
    );
    this.eraserProgram = createProgram(
      gl,
      vertexShader,
      createShader(gl, gl.FRAGMENT_SHADER, eraserFrag),
    );

    this.brushVAO = createFullQuadVAO(gl, this.brushProgram);
    this.eraserVAO = createFullQuadVAO(gl, this.eraserProgram);

    this.resultFBO = createFramebuffer(gl, options.resultTexture);

    this.setupRenderUniforms(this.brushProgram);
    this.setupRenderUniforms(this.eraserProgram);
  }

  setMode(mode: BrushRenderMode) {
    this.mode = mode;
  }

  setColor(color: BrushRenderColor) {
    this.color = color;
  }

  /**
   * 해당 범위의 resultTexture를 수정한다.
   * @param rect
   * @returns
   */
  render(rect: BrushRenderRect | null) {
    if (!rect || rect.width === 0 || rect.height === 0) return;

    const gl = this.gl;
    const program =
      this.mode === "eraser" ? this.eraserProgram : this.brushProgram;
    const vao = this.mode === "eraser" ? this.eraserVAO : this.brushVAO;

    gl.useProgram(program);
    gl.bindVertexArray(vao);

    if (this.mode === "brush") {
      gl.uniform3f(
        gl.getUniformLocation(program, "u_color"),
        this.color[0],
        this.color[1],
        this.color[2],
      );
    }

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.PATHMAP);
    gl.bindTexture(gl.TEXTURE_2D, this.options.maskTexture);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE);
    gl.bindTexture(gl.TEXTURE_2D, this.options.imageTexture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultFBO);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(rect.x, rect.y, rect.width, rect.height);
    gl.viewport(0, 0, this.width, this.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.SCISSOR_TEST);
  }

  private setupRenderUniforms(program: WebGLProgram) {
    const gl = this.gl;
    gl.useProgram(program);
    gl.uniform1i(
      gl.getUniformLocation(program, "u_pathMap"),
      TEXTURE_UNIT.PATHMAP,
    );
    gl.uniform1i(
      gl.getUniformLocation(program, "u_source"),
      TEXTURE_UNIT.SOURCE,
    );
    gl.uniform2f(
      gl.getUniformLocation(program, "u_resolution"),
      this.width,
      this.height,
    );
  }
}

function createShader(
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "Shader compile failed.");
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vs: WebGLShader,
  fs: WebGLShader,
) {
  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create program.");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "Program link failed.");
  }
  return program;
}

function createFullQuadVAO(gl: WebGL2RenderingContext, program: WebGLProgram) {
  const buffer = gl.createBuffer()!;
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const pos = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  return vao;
}

function createFramebuffer(gl: WebGL2RenderingContext, texture: WebGLTexture) {
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );
  return fbo;
}
