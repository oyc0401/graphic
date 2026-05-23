import type { Pointer } from "@/core/types";
import { Rect } from "@/core/utils/rect";
import { paintOptions, TEXTURE_UNIT } from "../../texture";
import { createProgram, createShader } from "../../utils/glHelper";
import { getBufferManager, getFullQuadShader } from "../../vertexShader";
import liquifyTwirlFrag from "./liquifyTwirl.frag?raw";

export type TwirlDirection = "clockwise" | "counterClockwise";

export class TwirlDisplacementModifier {
  private twirlProgram: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private uCenterLoc: WebGLUniformLocation;
  private uRadiusLoc: WebGLUniformLocation;
  private uStrengthLoc: WebGLUniformLocation;
  private uDirectionLoc: WebGLUniformLocation;

  private constructor(
    private gl: WebGL2RenderingContext,
    private targetFBO: WebGLFramebuffer,
  ) {}

  static async create(
    gl: WebGL2RenderingContext,
    targetFBO: WebGLFramebuffer,
  ): Promise<TwirlDisplacementModifier> {
    const modifier = new TwirlDisplacementModifier(gl, targetFBO);
    modifier.initializeShaderResources();
    return modifier;
  }

  private initializeShaderResources() {
    const gl = this.gl;
    const fullQuadVertexShader = getFullQuadShader(gl);
    const bufferManager = getBufferManager(gl);
    const twirlShader = createShader(gl, gl.FRAGMENT_SHADER, liquifyTwirlFrag);

    this.twirlProgram = createProgram(
      gl,
      fullQuadVertexShader,
      twirlShader,
    );
    gl.useProgram(this.twirlProgram);

    gl.uniform1i(
      gl.getUniformLocation(this.twirlProgram, "u_displacement"),
      TEXTURE_UNIT.DISPLACEMENT,
    );

    this.uCenterLoc = gl.getUniformLocation(this.twirlProgram, "u_center")!;
    this.uRadiusLoc = gl.getUniformLocation(this.twirlProgram, "u_radius")!;
    this.uStrengthLoc = gl.getUniformLocation(this.twirlProgram, "u_strength")!;
    this.uDirectionLoc = gl.getUniformLocation(
      this.twirlProgram,
      "u_direction",
    )!;

    this.vao = bufferManager.createFullQuadVAO(this.twirlProgram);
  }

  setSize(width: number, height: number) {
    const gl = this.gl;
    gl.useProgram(this.twirlProgram);
    gl.uniform2f(
      gl.getUniformLocation(this.twirlProgram, "u_resolution"),
      width,
      height,
    );
  }

  apply(pointer: Pointer, direction: TwirlDirection): Rect {
    const gl = this.gl;
    const radius = paintOptions.radius;
    const rect = Rect.fromPosition(
      Math.floor(pointer.x - radius),
      Math.floor(pointer.y - radius),
      Math.floor(pointer.x + radius),
      Math.floor(pointer.y + radius),
    ).clampTo(0, 0, paintOptions.width, paintOptions.height);

    gl.useProgram(this.twirlProgram);
    gl.bindVertexArray(this.vao);
    gl.uniform2f(this.uCenterLoc, pointer.x, pointer.y);
    gl.uniform1f(this.uRadiusLoc, radius);
    gl.uniform1f(this.uStrengthLoc, paintOptions.alpha);
    gl.uniform1f(
      this.uDirectionLoc,
      direction === "clockwise" ? -1 : 1,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.targetFBO);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(rect.x, rect.y, rect.width, rect.height);
    gl.viewport(0, 0, paintOptions.width, paintOptions.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    return rect;
  }
}
