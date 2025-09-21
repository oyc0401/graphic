import { Pointer } from "@/core/types";
import { DirtyRectRecorder, Rect } from "@/core/utils/rect";
import { paintOptions, TEXTURE_UNIT } from "../../texture";
import { createShader, createProgram, getGlHelper } from "../../utils/glHelper";
import { getFullQuadShader, getBufferManager } from "../../vertexShader";
import {
  getIntegralEaseInOut,
  getIntegralEaseInOutMirror,
} from "./cachedIntegrals";
import liquifyPushFrag from "./liquifyPush.frag?raw";

export class DisplacementModifier {
  protected gl: WebGL2RenderingContext;
  private pushProgram: WebGLProgram;
  private displacementTexInput: WebGLTexture;
  private displacementTexOutput: WebGLTexture;
  private displaceInFBO: WebGLFramebuffer;
  private displaceOutFBO: WebGLFramebuffer;
  private strokeDirtyRecorder: DirtyRectRecorder;
  private scissorDirtyRecorder: DirtyRectRecorder;

  // Cached uniform locations
  private u_radiusLoc: WebGLUniformLocation;
  private u_strengthLoc: WebGLUniformLocation;
  private u_startLoc: WebGLUniformLocation;
  private u_endLoc: WebGLUniformLocation;

  private constructor(
    gl: WebGL2RenderingContext,
    displacementTexInput: WebGLTexture,
    displaceInFBO: WebGLFramebuffer,
  ) {
    this.gl = gl;
    this.displacementTexInput = displacementTexInput;
    this.displaceInFBO = displaceInFBO;
    this.checkExtensions();
  }

  static async create(
    gl: WebGL2RenderingContext,
    displacementTexInput: WebGLTexture,
    displaceInFBO: WebGLFramebuffer,
  ): Promise<DisplacementModifier> {
    const modifier = new DisplacementModifier(
      gl,
      displacementTexInput,
      displaceInFBO,
    );
    await modifier.initializeShaderResources();
    return modifier;
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

  private async initializeShaderResources() {
    const gl = this.gl;

    // Load integral data
    let integralData = await getIntegralEaseInOut();
    let integralMirrorData = await getIntegralEaseInOutMirror();

    const fullQuadVertexShader = getFullQuadShader(gl);
    const bufferManager = getBufferManager(gl);

    const pushShader = createShader(gl, gl.FRAGMENT_SHADER, liquifyPushFrag);
    this.pushProgram = createProgram(gl, fullQuadVertexShader, pushShader);

    gl.useProgram(this.pushProgram);

    // Setup displacement texture uniform
    gl.uniform1i(
      gl.getUniformLocation(this.pushProgram, "u_displacement"),
      TEXTURE_UNIT.DISPLACEMENT,
    );

    // 출력용 텍스처 생성
    this.displacementTexOutput = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, this.displacementTexOutput);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Create and setup integral textures
    const integralTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.EASE_INTEGRAL);
    gl.bindTexture(gl.TEXTURE_2D, integralTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R32F,
      integralData.length,
      1,
      0,
      gl.RED,
      gl.FLOAT,
      integralData,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(
      gl.getUniformLocation(this.pushProgram, "u_ease_integral"),
      TEXTURE_UNIT.EASE_INTEGRAL,
    );

    const integralMirrorTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.EASE_MIRROR);
    gl.bindTexture(gl.TEXTURE_2D, integralMirrorTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R32F,
      integralMirrorData.length,
      1,
      0,
      gl.RED,
      gl.FLOAT,
      integralMirrorData,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(
      gl.getUniformLocation(this.pushProgram, "u_ease_mirror"),
      TEXTURE_UNIT.EASE_MIRROR,
    );

    // 쓰여진 결과를 기본 변위맵에 업로드 하기 위해서
    this.displaceOutFBO = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.displaceOutFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.displacementTexOutput,
      0,
    );

    bufferManager.createFullQuadVAO(this.pushProgram);

    // Cache uniform locations
    this.u_radiusLoc = gl.getUniformLocation(this.pushProgram, "u_radius")!;
    this.u_strengthLoc = gl.getUniformLocation(this.pushProgram, "u_strength")!;
    this.u_startLoc = gl.getUniformLocation(this.pushProgram, "u_start")!;
    this.u_endLoc = gl.getUniformLocation(this.pushProgram, "u_end")!;
  }

  resetWorkSpace(width: number, height: number) {
    const gl = this.gl;

    gl.useProgram(this.pushProgram);
    gl.uniform2f(
      gl.getUniformLocation(this.pushProgram, "u_resolution"),
      width,
      height,
    );

    this.clearDisplacement(width, height);
  }

  start(pointer: Pointer) {
    this.strokeDirtyRecorder = DirtyRectRecorder.clampedRect(
      0,
      0,
      paintOptions.width,
      paintOptions.height,
    );
    this.strokeDirtyRecorder.updatePointer(pointer, paintOptions.radius);
  }

  push(start: Pointer, end: Pointer): Rect {
    const gl = this.gl;

    gl.useProgram(this.pushProgram);

    // 유니폼 변수 설정
    gl.uniform1f(this.u_radiusLoc, paintOptions.radius);
    gl.uniform1f(this.u_strengthLoc, paintOptions.alpha);
    gl.uniform2f(this.u_startLoc, start.x, start.y);
    gl.uniform2f(this.u_endLoc, end.x, end.y);

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

    // 렌더 대상: output
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.displaceOutFBO);

    const scissorRect = this.scissorDirtyRecorder.generateRect();

    // SCISSOR TEST로 일부만 렌더링
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(
      scissorRect.x,
      scissorRect.y,
      scissorRect.width,
      scissorRect.height,
    );
    gl.viewport(0, 0, paintOptions.width, paintOptions.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // output 텍스처를 input 텍스처에도 옮기기
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.displaceOutFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.displaceInFBO);

    gl.blitFramebuffer(
      scissorRect.x,
      scissorRect.y,
      scissorRect.right,
      scissorRect.bottom, // 소스
      scissorRect.x,
      scissorRect.y,
      scissorRect.right,
      scissorRect.bottom, // 대상
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );

    return scissorRect;
  }

  getStrokeDirtyRect(): Rect {
    return this.strokeDirtyRecorder.generateRect();
  }

  private clearDisplacement(width: number, height: number) {
    const gl = this.gl;

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, this.displacementTexInput);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG32F,
      width,
      height,
      0,
      gl.RG,
      gl.FLOAT,
      null,
    );

    // Only resize the output texture
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, this.displacementTexOutput);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG32F,
      width,
      height,
      0,
      gl.RG,
      gl.FLOAT,
      null,
    );
  }

  exit() {
    // Cleanup displacement output texture when exiting liquify mode
    const gl = this.gl;

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, this.displacementTexInput);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, 1, 1, 0, gl.RG, gl.FLOAT, null);

    // Resize output texture to 1x1 to free memory
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, this.displacementTexOutput);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, 1, 1, 0, gl.RG, gl.FLOAT, null);
  }
}
