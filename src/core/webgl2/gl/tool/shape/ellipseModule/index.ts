import applyFrag from "./apply.frag?raw";

export type EllipseColor = [number, number, number, number];

export interface EllipseRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CreateEllipseOptions {
  shapeTexture: WebGLTexture;
  imageTexture: WebGLTexture;
  resultTexture: WebGLTexture;
  width: number;
  height: number;
}

interface NormalizedRect {
  textureWidth: number;
  textureHeight: number;
  targetRect: EllipseRect;
  visibleRect: EllipseRect;
}

const TEXTURE_UNIT = {
  IMAGE: 0,
  SHAPE: 1,
};

const FULL_QUAD_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;

void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export function createEllipse(
  gl: WebGL2RenderingContext,
  options: CreateEllipseOptions,
) {
  return new Ellipse(gl, options);
}

class Ellipse {
  private readonly shapeFramebuffer: WebGLFramebuffer;
  private readonly resultFramebuffer: WebGLFramebuffer;
  private readonly applyProgram: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private color: EllipseColor = [0, 0, 0, 1];
  private strokeWidth = 1;
  private renderedRect: {
    key: string;
    targetRect: EllipseRect;
  } | null = null;

  constructor(
    private gl: WebGL2RenderingContext,
    private options: CreateEllipseOptions,
  ) {
    this.initializeShapeTexture();
    this.shapeFramebuffer = this.createFramebuffer(options.shapeTexture);
    this.resultFramebuffer = this.createFramebuffer(options.resultTexture);
    this.applyProgram = createProgram(
      gl,
      createShader(gl, gl.VERTEX_SHADER, FULL_QUAD_VERTEX_SHADER),
      createShader(gl, gl.FRAGMENT_SHADER, applyFrag),
    );
    this.vao = this.createFullQuadVAO();
    this.bindApplyUniforms();
  }

  setColor(color: EllipseColor) {
    this.color = [...color];
    if (this.renderedRect) this.renderedRect.key = "";
  }

  setWidth(width: number) {
    this.strokeWidth = Math.max(1, width);
    if (this.renderedRect) this.renderedRect.key = "";
  }

  create(rect: EllipseRect): EllipseRect {
    const normalized = normalizeRect(
      rect,
      this.options.width,
      this.options.height,
    );

    const key = this.createRectKey(
      normalized.textureWidth,
      normalized.textureHeight,
    );
    if (this.renderedRect?.key !== key) {
      this.clearShapeTexture();
      if (normalized.textureWidth > 0 && normalized.textureHeight > 0) {
        this.drawEllipse(normalized.textureWidth, normalized.textureHeight);
      }
    }
    this.renderedRect = {
      key,
      targetRect: normalized.targetRect,
    };
    return normalized.visibleRect;
  }

  apply(rect: EllipseRect): EllipseRect {
    const targetRect = this.renderedRect?.targetRect ?? rect;

    const gl = this.gl;
    gl.useProgram(this.applyProgram);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.IMAGE);
    gl.bindTexture(gl.TEXTURE_2D, this.options.imageTexture);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SHAPE);
    gl.bindTexture(gl.TEXTURE_2D, this.options.shapeTexture);
    gl.uniform4f(
      gl.getUniformLocation(this.applyProgram, "u_targetRect"),
      targetRect.x,
      targetRect.y,
      targetRect.width,
      targetRect.height,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.resultFramebuffer);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(
      rect.x,
      rect.y,
      Math.max(0, rect.width),
      Math.max(0, rect.height),
    );
    gl.viewport(0, 0, this.options.width, this.options.height);
    if (rect.width > 0 && rect.height > 0) {
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.disable(gl.SCISSOR_TEST);

    this.clearShapeTexture();
    return rect;
  }

  destroy() {
    const gl = this.gl;
    gl.deleteFramebuffer(this.shapeFramebuffer);
    gl.deleteFramebuffer(this.resultFramebuffer);
    gl.deleteProgram(this.applyProgram);
    gl.deleteVertexArray(this.vao);
  }

  private drawEllipse(width: number, height: number) {
    const pixels = new Uint8Array(width * height * 4);
    const stroke = Math.max(
      1,
      Math.min(Math.round(this.strokeWidth), width, height),
    );

    if (stroke > 1) {
      drawFilledEllipseStroke(pixels, width, height, stroke, this.color);
      this.uploadPixels(width, height, pixels);
      return;
    }

    for (let inset = 0; inset < stroke; inset += 1) {
      const left = inset;
      const top = inset;
      const right = width - 1 - inset;
      const bottom = height - 1 - inset;
      if (left > right || top > bottom) break;
      drawMidpointEllipse(
        pixels,
        width,
        height,
        left,
        top,
        right,
        bottom,
        this.color,
      );
    }

    this.uploadPixels(width, height, pixels);
  }

  private uploadPixels(width: number, height: number, pixels: Uint8Array) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SHAPE);
    gl.bindTexture(gl.TEXTURE_2D, this.options.shapeTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      width,
      height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
  }

  private bindApplyUniforms() {
    const gl = this.gl;
    gl.useProgram(this.applyProgram);
    gl.uniform1i(
      gl.getUniformLocation(this.applyProgram, "u_image"),
      TEXTURE_UNIT.IMAGE,
    );
    gl.uniform1i(
      gl.getUniformLocation(this.applyProgram, "u_shape"),
      TEXTURE_UNIT.SHAPE,
    );
    gl.uniform2f(
      gl.getUniformLocation(this.applyProgram, "u_resolution"),
      this.options.width,
      this.options.height,
    );
  }

  private initializeShapeTexture() {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SHAPE);
    gl.bindTexture(gl.TEXTURE_2D, this.options.shapeTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      this.options.width,
      this.options.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  private clearShapeTexture() {
    if (!this.renderedRect) return;

    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shapeFramebuffer);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(
      0,
      0,
      this.renderedRect.targetRect.width,
      this.renderedRect.targetRect.height,
    );
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);
    this.renderedRect = null;
  }

  private createRectKey(width: number, height: number) {
    return [
      width,
      height,
      this.strokeWidth,
      this.color[0],
      this.color[1],
      this.color[2],
      this.color[3],
    ].join(":");
  }

  private createFramebuffer(texture: WebGLTexture) {
    const framebuffer = this.gl.createFramebuffer();
    if (!framebuffer) {
      throw new Error("Failed to create ellipse framebuffer.");
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
      throw new Error("Ellipse framebuffer is incomplete.");
    }
    return framebuffer;
  }

  private createFullQuadVAO() {
    const buffer = this.gl.createBuffer();
    const vao = this.gl.createVertexArray();
    if (!buffer || !vao) {
      throw new Error("Failed to create ellipse full quad.");
    }

    this.gl.bindVertexArray(vao);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      this.gl.STATIC_DRAW,
    );

    const position = this.gl.getAttribLocation(this.applyProgram, "a_position");
    this.gl.enableVertexAttribArray(position);
    this.gl.vertexAttribPointer(position, 2, this.gl.FLOAT, false, 0, 0);
    return vao;
  }
}

function normalizeRect(
  rect: EllipseRect,
  canvasWidth: number,
  canvasHeight: number,
): NormalizedRect {
  const left = Math.floor(rect.x);
  const top = Math.floor(rect.y);
  const right = Math.ceil(rect.x + rect.width);
  const bottom = Math.ceil(rect.y + rect.height);
  const textureWidth = Math.max(0, right - left);
  const textureHeight = Math.max(0, bottom - top);

  const visibleRect = intersectRect(
    left,
    top,
    right,
    bottom,
    canvasWidth,
    canvasHeight,
  );
  return {
    textureWidth,
    textureHeight,
    targetRect: {
      x: left,
      y: top,
      width: textureWidth,
      height: textureHeight,
    },
    visibleRect,
  };
}

function intersectRect(
  left: number,
  top: number,
  right: number,
  bottom: number,
  width: number,
  height: number,
): EllipseRect {
  const x = Math.max(0, left);
  const y = Math.max(0, top);
  const ex = Math.min(width, right);
  const ey = Math.min(height, bottom);
  return {
    x,
    y,
    width: Math.max(0, ex - x),
    height: Math.max(0, ey - y),
  };
}

function drawFilledEllipseStroke(
  pixels: Uint8Array,
  textureWidth: number,
  textureHeight: number,
  stroke: number,
  color: EllipseColor,
) {
  const outerRadiusX = textureWidth * 0.5;
  const outerRadiusY = textureHeight * 0.5;
  const innerRadiusX = outerRadiusX - stroke;
  const innerRadiusY = outerRadiusY - stroke;
  const fillInner = innerRadiusX <= 0 || innerRadiusY <= 0;
  const centerX = outerRadiusX;
  const centerY = outerRadiusY;

  for (let y = 0; y < textureHeight; y += 1) {
    const pointY = y + 0.5 - centerY;
    for (let x = 0; x < textureWidth; x += 1) {
      const pointX = x + 0.5 - centerX;
      if (!isInsideEllipse(pointX, pointY, outerRadiusX, outerRadiusY)) {
        continue;
      }
      if (
        !fillInner &&
        isInsideEllipse(pointX, pointY, innerRadiusX, innerRadiusY)
      ) {
        continue;
      }
      plot(pixels, textureWidth, textureHeight, x, y, color);
    }
  }
}

function isInsideEllipse(
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
) {
  return (x * x) / (radiusX * radiusX) + (y * y) / (radiusY * radiusY) <= 1;
}

function drawMidpointEllipse(
  pixels: Uint8Array,
  textureWidth: number,
  textureHeight: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  color: EllipseColor,
) {
  const rx = Math.floor((right - left) / 2);
  const ry = Math.floor((bottom - top) / 2);
  if (rx <= 0 || ry <= 0) {
    drawDegenerateEllipse(
      pixels,
      textureWidth,
      textureHeight,
      left,
      top,
      right,
      bottom,
      color,
    );
    return;
  }

  const cx = left + rx;
  const cy = top + ry;
  const rx2 = rx * rx;
  const ry2 = ry * ry;
  let x = 0;
  let y = ry;
  let dx = 0;
  let dy = 2 * rx2 * y;
  let d1 = ry2 - rx2 * ry + 0.25 * rx2;

  while (dx < dy) {
    plotSymmetric(pixels, textureWidth, textureHeight, cx, cy, x, y, color);
    x += 1;
    dx += 2 * ry2;
    if (d1 < 0) {
      d1 += dx + ry2;
    } else {
      y -= 1;
      dy -= 2 * rx2;
      d1 += dx - dy + ry2;
    }
  }

  let d2 =
    ry2 * (x + 0.5) * (x + 0.5) +
    rx2 * (y - 1) * (y - 1) -
    rx2 * ry2;

  while (y >= 0) {
    plotSymmetric(pixels, textureWidth, textureHeight, cx, cy, x, y, color);
    y -= 1;
    dy -= 2 * rx2;
    if (d2 > 0) {
      d2 += rx2 - dy;
    } else {
      x += 1;
      dx += 2 * ry2;
      d2 += dx - dy + rx2;
    }
  }
}

function drawDegenerateEllipse(
  pixels: Uint8Array,
  textureWidth: number,
  textureHeight: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  color: EllipseColor,
) {
  if (left === right) {
    for (let y = top; y <= bottom; y += 1) {
      plot(pixels, textureWidth, textureHeight, left, y, color);
    }
    return;
  }

  if (top === bottom) {
    for (let x = left; x <= right; x += 1) {
      plot(pixels, textureWidth, textureHeight, x, top, color);
    }
  }
}

function plotSymmetric(
  pixels: Uint8Array,
  textureWidth: number,
  textureHeight: number,
  cx: number,
  cy: number,
  x: number,
  y: number,
  color: EllipseColor,
) {
  plot(pixels, textureWidth, textureHeight, cx + x, cy + y, color);
  plot(pixels, textureWidth, textureHeight, cx - x, cy + y, color);
  plot(pixels, textureWidth, textureHeight, cx + x, cy - y, color);
  plot(pixels, textureWidth, textureHeight, cx - x, cy - y, color);
}

function plot(
  pixels: Uint8Array,
  textureWidth: number,
  textureHeight: number,
  x: number,
  y: number,
  color: EllipseColor,
) {
  if (x < 0 || y < 0 || x >= textureWidth || y >= textureHeight) return;

  const alpha = Math.round(color[3] * 255);
  const offset = (y * textureWidth + x) * 4;
  pixels[offset] = Math.round(color[0] * alpha);
  pixels[offset + 1] = Math.round(color[1] * alpha);
  pixels[offset + 2] = Math.round(color[2] * alpha);
  pixels[offset + 3] = alpha;
}

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create ellipse shader.");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(
      gl.getShaderInfoLog(shader) ?? "Ellipse shader compile failed.",
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
    throw new Error("Failed to create ellipse program.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(
      gl.getProgramInfoLog(program) ?? "Ellipse program link failed.",
    );
  }
  return program;
}
