import brushFrag from "../brush.frag?raw";
import eraserFrag from "../eraser.frag?raw";
import { createDist } from "../distModule";
import { createPencil } from "../pencilModule";
import { createSpline } from "../splineModule";

export type BrushStrokeType = "spline" | "dist" | "pencil";
export type BrushMode = "brush" | "eraser";
export type BrushColor = [number, number, number];

export interface BrushPoint {
  x: number;
  y: number;
}

export interface BrushRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CreateBrushOptions {
  imageTexture: WebGLTexture;
  resultTexture: WebGLTexture;
  width: number;
  height: number;
}

interface BrushStrokeModule {
  setAlpha(alpha: number): void;
  setDiameter(diameter: number): void;
  start(point: BrushPoint): BrushRect | null;
  move(point: BrushPoint): BrushRect | null;
  end(): BrushRect | null;
}

const TEXTURE_UNIT = {
  SOURCE: 0,
  PATHMAP: 3,
};

const FULL_QUAD_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;

void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const COPY_FRAGMENT_SHADER = `#version 300 es
precision mediump float;

uniform sampler2D u_texture;
in vec2 v_texCoord;
out vec4 outColor;

void main() {
  outColor = texture(u_texture, v_texCoord);
}`;

export function createBrush(
  gl: WebGL2RenderingContext,
  options: CreateBrushOptions,
) {
  return new Brush(gl, options);
}

class Brush {
  private readonly width: number;
  private readonly height: number;
  private readonly alphaMapTexture: WebGLTexture;
  private readonly resultFramebuffer: WebGLFramebuffer;
  private readonly imageFramebuffer: WebGLFramebuffer;
  private readonly brushProgram: WebGLProgram;
  private readonly eraserProgram: WebGLProgram;
  private readonly copyProgram: WebGLProgram;
  private readonly brushVAO: WebGLVertexArrayObject;
  private readonly eraserVAO: WebGLVertexArrayObject;
  private readonly copyVAO: WebGLVertexArrayObject;
  private readonly splinePath: BrushStrokeModule;
  private readonly distPath: BrushStrokeModule;
  private readonly pencilPath: BrushStrokeModule;
  private alpha = 1;
  private brushSize = 1;
  private color: BrushColor = [0, 0, 0];
  private mode: BrushMode = "brush";
  private strokeType: BrushStrokeType = "spline";
  private strokeModule: BrushStrokeModule;
  private dirtyRect: BrushRect | null = null;

  constructor(
    private gl: WebGL2RenderingContext,
    private options: CreateBrushOptions,
  ) {
    this.width = options.width;
    this.height = options.height;
    this.alphaMapTexture = this.createAlphaMapTexture();
    this.resultFramebuffer = this.createFramebuffer(options.resultTexture);
    this.imageFramebuffer = this.createFramebuffer(options.imageTexture);
    this.brushProgram = createProgram(
      gl,
      createShader(gl, gl.VERTEX_SHADER, FULL_QUAD_VERTEX_SHADER),
      createShader(gl, gl.FRAGMENT_SHADER, brushFrag),
    );
    this.eraserProgram = createProgram(
      gl,
      createShader(gl, gl.VERTEX_SHADER, FULL_QUAD_VERTEX_SHADER),
      createShader(gl, gl.FRAGMENT_SHADER, eraserFrag),
    );
    this.copyProgram = createProgram(
      gl,
      createShader(gl, gl.VERTEX_SHADER, FULL_QUAD_VERTEX_SHADER),
      createShader(gl, gl.FRAGMENT_SHADER, COPY_FRAGMENT_SHADER),
    );
    this.brushVAO = this.createFullQuadVAO(this.brushProgram);
    this.eraserVAO = this.createFullQuadVAO(this.eraserProgram);
    this.copyVAO = this.createFullQuadVAO(this.copyProgram);
    this.splinePath = createSpline(gl, {
      alphaMapTexture: this.alphaMapTexture,
      width: this.width,
      height: this.height,
    });
    this.distPath = createDist(gl, {
      alphaMapTexture: this.alphaMapTexture,
      width: this.width,
      height: this.height,
    });
    this.pencilPath = createPencil(gl, {
      alphaMapTexture: this.alphaMapTexture,
      width: this.width,
      height: this.height,
    });
    this.strokeModule = this.splinePath;
    this.bindRenderUniforms(this.brushProgram);
    this.bindRenderUniforms(this.eraserProgram);
  }

  setAlpha(alpha: number) {
    this.alpha = Math.max(0, Math.min(1, alpha));
  }

  setBrushSize(brushSize: number) {
    this.brushSize = Math.max(1, brushSize);
  }

  setColor(color: BrushColor) {
    this.color = color;
  }

  setMode(mode: BrushMode) {
    this.mode = mode;
  }

  setStrokeType(type: BrushStrokeType) {
    this.strokeType = type;
  }

  start(point: BrushPoint) {
    this.strokeModule = this.getStrokeModule(this.strokeType);
    this.strokeModule.setAlpha(this.alpha);
    this.strokeModule.setDiameter(this.brushSize);
    this.dirtyRect = null;

    const rect = this.strokeModule.start(point);
    if (rect) {
      this.dirtyRect = unionRect(this.dirtyRect, rect);
      this.renderStroke(rect);
    }
  }

  move(point: BrushPoint) {
    const rect = this.strokeModule.move(point);
    if (!rect) return;

    this.dirtyRect = unionRect(this.dirtyRect, rect);
    this.renderStroke(rect);
  }

  end(): BrushRect | null {
    const strokeRect = this.strokeModule.end();
    const rect = unionRect(this.dirtyRect, strokeRect);
    if (!rect || isEmptyRect(rect)) {
      this.dirtyRect = null;
      return null;
    }

    this.renderStroke(rect);
    this.copyTextureRect(
      this.options.resultTexture,
      this.imageFramebuffer,
      rect,
    );
    this.clearAlphaMap(rect);
    this.dirtyRect = null;
    return rect;
  }

  cancel() {
    const strokeRect = this.strokeModule.end();
    const rect = unionRect(this.dirtyRect, strokeRect);
    if (!rect || isEmptyRect(rect)) {
      this.dirtyRect = null;
      return;
    }

    this.copyTextureRect(
      this.options.imageTexture,
      this.resultFramebuffer,
      rect,
    );
    this.clearAlphaMap(rect);
    this.dirtyRect = null;
  }

  private getStrokeModule(type: BrushStrokeType) {
    if (type === "dist") return this.distPath;
    if (type === "pencil") return this.pencilPath;
    return this.splinePath;
  }

  private renderStroke(rect: BrushRect) {
    if (isEmptyRect(rect)) return;

    const gl = this.gl;
    const program = this.getRenderProgram();
    const vao = this.getRenderVAO();
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
    gl.bindTexture(gl.TEXTURE_2D, this.alphaMapTexture);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE);
    gl.bindTexture(gl.TEXTURE_2D, this.options.imageTexture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultFramebuffer);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(rect.x, rect.y, rect.width, rect.height);
    gl.viewport(0, 0, this.width, this.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.SCISSOR_TEST);
  }

  private getRenderProgram() {
    if (this.mode === "eraser") return this.eraserProgram;
    return this.brushProgram;
  }

  private getRenderVAO() {
    if (this.mode === "eraser") return this.eraserVAO;
    return this.brushVAO;
  }

  private copyTextureRect(
    sourceTexture: WebGLTexture,
    targetFramebuffer: WebGLFramebuffer,
    rect: BrushRect,
  ) {
    if (isEmptyRect(rect)) return;

    const gl = this.gl;
    gl.useProgram(this.copyProgram);
    gl.bindVertexArray(this.copyVAO);
    gl.uniform1i(
      gl.getUniformLocation(this.copyProgram, "u_texture"),
      TEXTURE_UNIT.SOURCE,
    );
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE);
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);

    gl.bindFramebuffer(gl.FRAMEBUFFER, targetFramebuffer);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(rect.x, rect.y, rect.width, rect.height);
    gl.viewport(0, 0, this.width, this.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.SCISSOR_TEST);
  }

  private bindRenderUniforms(program: WebGLProgram) {
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

  private createAlphaMapTexture() {
    const texture = this.gl.createTexture();
    if (!texture) {
      throw new Error("Failed to create brush alpha map texture.");
    }

    this.gl.activeTexture(this.gl.TEXTURE0 + TEXTURE_UNIT.PATHMAP);
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
    return texture;
  }

  private clearAlphaMap(rect: BrushRect) {
    this.gl.activeTexture(this.gl.TEXTURE0 + TEXTURE_UNIT.PATHMAP);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.alphaMapTexture);
    this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);
    this.gl.texSubImage2D(
      this.gl.TEXTURE_2D,
      0,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      this.gl.RED,
      this.gl.UNSIGNED_BYTE,
      new Uint8Array(rect.width * rect.height),
    );
  }

  private createFramebuffer(texture: WebGLTexture) {
    const framebuffer = this.gl.createFramebuffer();
    if (!framebuffer) {
      throw new Error("Failed to create brush framebuffer.");
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
      throw new Error("Brush framebuffer is incomplete.");
    }
    return framebuffer;
  }

  private createFullQuadVAO(program: WebGLProgram) {
    const buffer = this.gl.createBuffer();
    const vao = this.gl.createVertexArray();
    if (!buffer || !vao) {
      throw new Error("Failed to create brush full quad.");
    }

    this.gl.bindVertexArray(vao);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      this.gl.STATIC_DRAW,
    );

    const position = this.gl.getAttribLocation(program, "a_position");
    this.gl.enableVertexAttribArray(position);
    this.gl.vertexAttribPointer(position, 2, this.gl.FLOAT, false, 0, 0);
    return vao;
  }
}

function unionRect(a: BrushRect | null, b: BrushRect | null): BrushRect | null {
  if (!a) return b;
  if (!b) return a;

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

function isEmptyRect(rect: BrushRect) {
  return rect.width === 0 || rect.height === 0;
}

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create brush shader.");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(
      gl.getShaderInfoLog(shader) ?? "Brush shader compile failed.",
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
    throw new Error("Failed to create brush program.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(
      gl.getProgramInfoLog(program) ?? "Brush program link failed.",
    );
  }
  return program;
}
