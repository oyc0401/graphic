import { PathRenderer } from "./PathRenderer";
import { Pointer } from "@/core/types";
import { DirtyRectRecorder, Rect } from "@/core/utils/rect";
import { paintOptions, TEXTURE_UNIT } from "../../../texture";
import { createShader, createProgram } from "../../../utils/glHelper";
import { getFullQuadShader, getBufferManager } from "../../../vertexShader";
import strokeShaderSource from "./strokeShader.frag?raw";

export class ShaderPathRenderer extends PathRenderer {
  private strokeProgram: WebGLProgram;
  private pathTexOut: WebGLTexture;
  private framebuffer: WebGLFramebuffer;
  private readFrameBuffer: WebGLFramebuffer;
  private strokeDirtyRecorder: DirtyRectRecorder;
  private scissorDirtyRecorder: DirtyRectRecorder;

  constructor(gl: WebGL2RenderingContext, pathTex: WebGLTexture) {
    super(gl, pathTex);
    this.checkExtensions();
    this.initializeShaderResources();
  }

  private checkExtensions() {
    const gl = this.gl;

    const ext = gl.getExtension("EXT_color_buffer_float");
    if (!ext) {
      console.error("EXT_color_buffer_float not supported!");
    }
    const extFloatLinear =
      gl.getExtension("OES_texture_float_linear") ||
      gl.getExtension("EXT_texture_filter_float");
    if (!extFloatLinear) {
      console.error(
        "This device does not support linear filtering for float textures.",
      );
    }
  }

  private initializeShaderResources() {
    const gl = this.gl;

    const fullQuadVertexShader = getFullQuadShader(gl);
    const bufferManager = getBufferManager(gl);

    const strokeShader = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      strokeShaderSource,
    );
    this.strokeProgram = createProgram(gl, fullQuadVertexShader, strokeShader);

    gl.useProgram(this.strokeProgram);
    gl.uniform1i(
      gl.getUniformLocation(this.strokeProgram, "u_pathMap"),
      TEXTURE_UNIT.PATHMAP,
    );

    this.pathTexOut = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, this.pathTexOut);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.framebuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.pathTexOut,
      0,
    );

    this.readFrameBuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.readFrameBuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.pathTexOut,
      0,
    );

    bufferManager.createFullQuadVAO(this.strokeProgram);
  }

  resetWorkSpace(width: number, height: number) {
    const gl = this.gl;

    gl.useProgram(this.strokeProgram);
    gl.uniform2f(
      gl.getUniformLocation(this.strokeProgram, "u_resolution"),
      width,
      height,
    );

    super.clearPathTex(width, height);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, this.pathTexOut);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      width,
      height,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      null,
    );
  }

  start(pointer: Pointer) {
    super.start(pointer);
    this.strokeDirtyRecorder = DirtyRectRecorder.clampedRect(
      0,
      0,
      paintOptions.width,
      paintOptions.height,
    );
    this.strokeDirtyRecorder.updatePointer(pointer, paintOptions.radius);
  }

  stroke(pointer: Pointer): Rect | null {
    super.stroke(pointer);

    const rect = this.drawLineToTex(
      this.points[this.points.length - 2],
      this.points[this.points.length - 1],
    );

    return rect;
  }

  getStrokeDirtyRect(): Rect {
    return this.strokeDirtyRecorder.generateRect();
  }

  private drawLineToTex(start, end) {
    const gl = this.gl;

    gl.useProgram(this.strokeProgram);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.PATHMAP);
    gl.bindTexture(gl.TEXTURE_2D, this.pathTex);

    gl.uniform1f(
      gl.getUniformLocation(this.strokeProgram, "u_radius"),
      paintOptions.radius,
    );
    gl.uniform1f(
      gl.getUniformLocation(this.strokeProgram, "u_alpha"),
      paintOptions.alpha,
    );
    gl.uniform2f(
      gl.getUniformLocation(this.strokeProgram, "u_start"),
      start.x,
      start.y,
    );
    gl.uniform2f(
      gl.getUniformLocation(this.strokeProgram, "u_end"),
      end.x,
      end.y,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.pathTexOut,
      0,
    );

    this.scissorDirtyRecorder = DirtyRectRecorder.clampedRect(
      0,
      0,
      paintOptions.width,
      paintOptions.height,
    );
    this.scissorDirtyRecorder.updatePointer(start, paintOptions.radius);
    this.scissorDirtyRecorder.updatePointer(end, paintOptions.radius);

    this.strokeDirtyRecorder.updatePointer(start, paintOptions.radius);
    this.strokeDirtyRecorder.updatePointer(end, paintOptions.radius);

    const scissorRect = this.scissorDirtyRecorder.generateRect();

    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(
      scissorRect.x,
      scissorRect.y,
      scissorRect.width,
      scissorRect.height,
    );
    gl.viewport(0, 0, paintOptions.width, paintOptions.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.readFrameBuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.framebuffer);

    gl.framebufferTexture2D(
      gl.READ_FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.pathTexOut,
      0,
    );

    gl.framebufferTexture2D(
      gl.DRAW_FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.pathTex,
      0,
    );

    gl.blitFramebuffer(
      scissorRect.x,
      scissorRect.y,
      scissorRect.ex + 1,
      scissorRect.ey + 1,
      scissorRect.x,
      scissorRect.y,
      scissorRect.ex + 1,
      scissorRect.ey + 1,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );

    return scissorRect;
  }
}
