import { describe, expect, it } from "vitest";
import { createEllipse } from ".";

describe("ellipse module", () => {
  it("draws thick ellipse strokes without gaps inside each scanline segment", () => {
    const gl = new FakeWebGL2RenderingContext();
    const ellipse = createEllipse(gl as unknown as WebGL2RenderingContext, {
      shapeTexture: {},
      imageTexture: {},
      resultTexture: {},
      width: 240,
      height: 180,
    } as unknown as Parameters<typeof createEllipse>[1]);

    ellipse.setWidth(18);
    ellipse.create({ x: 0, y: 0, width: 160, height: 100 });

    expect(gl.uploadedPixels).toBeInstanceOf(Uint8Array);
    expect(gl.uploadedWidth).toBe(160);
    expect(gl.uploadedHeight).toBe(100);

    const pixels = gl.uploadedPixels!;
    for (let y = 0; y < gl.uploadedHeight; y += 1) {
      expect(countAlphaRuns(pixels, gl.uploadedWidth, y)).toBeLessThanOrEqual(
        2,
      );
    }
  });
});

function countAlphaRuns(pixels: Uint8Array, width: number, y: number) {
  let runs = 0;
  let insideRun = false;
  for (let x = 0; x < width; x += 1) {
    const hasAlpha = pixels[(y * width + x) * 4 + 3] > 0;
    if (hasAlpha && !insideRun) {
      runs += 1;
      insideRun = true;
    }
    if (!hasAlpha) {
      insideRun = false;
    }
  }
  return runs;
}

class FakeWebGL2RenderingContext {
  readonly TEXTURE0 = 0;
  readonly TEXTURE_2D = 1;
  readonly FRAMEBUFFER = 2;
  readonly COLOR_ATTACHMENT0 = 3;
  readonly FRAMEBUFFER_COMPLETE = 4;
  readonly VERTEX_SHADER = 5;
  readonly FRAGMENT_SHADER = 6;
  readonly COMPILE_STATUS = 7;
  readonly LINK_STATUS = 8;
  readonly ARRAY_BUFFER = 9;
  readonly STATIC_DRAW = 10;
  readonly FLOAT = 11;
  readonly RGBA = 12;
  readonly UNSIGNED_BYTE = 13;
  readonly TEXTURE_WRAP_S = 14;
  readonly TEXTURE_WRAP_T = 15;
  readonly CLAMP_TO_EDGE = 16;
  readonly TEXTURE_MIN_FILTER = 17;
  readonly TEXTURE_MAG_FILTER = 18;
  readonly NEAREST = 19;
  readonly UNPACK_ALIGNMENT = 20;

  uploadedPixels: Uint8Array | null = null;
  uploadedWidth = 0;
  uploadedHeight = 0;

  activeTexture() {}
  bindTexture() {}
  texImage2D() {}
  texParameteri() {}
  bindFramebuffer() {}
  framebufferTexture2D() {}
  bindVertexArray() {}
  bindBuffer() {}
  bufferData() {}
  enableVertexAttribArray() {}
  vertexAttribPointer() {}
  useProgram() {}
  uniform1i() {}
  uniform2f() {}
  uniform4f() {}
  pixelStorei() {}

  createFramebuffer() {
    return {};
  }

  checkFramebufferStatus() {
    return this.FRAMEBUFFER_COMPLETE;
  }

  createShader() {
    return {};
  }

  shaderSource() {}
  compileShader() {}

  getShaderParameter() {
    return true;
  }

  getShaderInfoLog() {
    return null;
  }

  createProgram() {
    return {};
  }

  attachShader() {}
  linkProgram() {}

  getProgramParameter() {
    return true;
  }

  getProgramInfoLog() {
    return null;
  }

  createBuffer() {
    return {};
  }

  createVertexArray() {
    return {};
  }

  getAttribLocation() {
    return 0;
  }

  getUniformLocation() {
    return {};
  }

  texSubImage2D(
    _target: number,
    _level: number,
    _xoffset: number,
    _yoffset: number,
    width: number,
    height: number,
    _format: number,
    _type: number,
    pixels: Uint8Array,
  ) {
    this.uploadedWidth = width;
    this.uploadedHeight = height;
    this.uploadedPixels = pixels;
  }
}
