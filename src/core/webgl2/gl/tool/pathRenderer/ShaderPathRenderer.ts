import { PathRenderer } from "./PathRenderer";
import { Pointer } from "@/core/types";
import { DirtyRectRecorder, Rect } from "@/core/utils/rect";
import { paintOptions, TEXTURE_UNIT } from "../../texture";
import { createShader, createProgram } from "../../utils/glHelper";
import { getFullQuadShader, getBufferManager } from "../../vertexShader";

export class ShaderPathRenderer extends PathRenderer {
  private strokeProgram: WebGLProgram;
  private pathTexOut: WebGLTexture;
  private framebuffer: WebGLFramebuffer;
  private readFrameBuffer: WebGLFramebuffer;
  private strokeDirtyRecorder: DirtyRectRecorder;
  private scissorDirtyRecorder: DirtyRectRecorder;
  private points: Pointer[];

  constructor(gl: WebGL2RenderingContext, pathTex: WebGLTexture) {
    super(gl, pathTex);
    this.initializeShaderResources();
  }

  private initializeShaderResources() {
    const fullQuadVertexShader = getFullQuadShader(this.gl);
    const bufferManager = getBufferManager(6, this.gl);

    const strokeShaderSource = `#version 300 es
      precision mediump float;

      uniform sampler2D u_pathMap;
      uniform vec2 u_start;
      uniform vec2 u_end;
      uniform float u_radius;
      uniform float u_alpha;
      uniform vec2 u_resolution;

      in vec2 v_texCoord;
      out float outAlpha;

      const vec2 sampleOffsets[16] = vec2[](
          vec2(-0.375, -0.375), vec2(-0.125, -0.375), vec2(0.125, -0.375), vec2(0.375, -0.375),
          vec2(-0.375, -0.125), vec2(-0.125, -0.125), vec2(0.125, -0.125), vec2(0.375, -0.125),
          vec2(-0.375,  0.125), vec2(-0.125,  0.125), vec2(0.125,  0.125), vec2(0.375,  0.125),
          vec2(-0.375,  0.375), vec2(-0.125,  0.375), vec2(0.125,  0.375), vec2(0.375,  0.375)
      );

      float distanceToSegment(vec2 p, vec2 a, vec2 b) {
          vec2 ab = b - a;
          float abLen2 = dot(ab, ab);
          if(abLen2 < 0.000001) {
              return length(p - a);
          }
          float t = dot(p - a, ab) / abLen2;
          t = clamp(t, 0.0, 1.0);
          vec2 closest = a + ab * t;
          return distance(p, closest);
      }

      void main() {
          float basicAlpha = texture(u_pathMap, v_texCoord).r;
          vec2 pixelCoord = v_texCoord * u_resolution;
          float distCenter = distanceToSegment(pixelCoord, u_start, u_end);

          float inner = u_radius - 1.0;
          float outer = u_radius + 1.0;

          float finalAlpha;

          if(distCenter < inner) {
              finalAlpha = u_alpha;
          }
          else if(distCenter > outer) {
              finalAlpha = 0.0;
          }
          else {
              float coverage = 0.0;
              for(int i = 0; i < 16; i++) {
                  vec2 offset = sampleOffsets[i];
                  vec2 sampleCoord = pixelCoord + offset;
                  float distSample = distanceToSegment(sampleCoord, u_start, u_end);
                  if(distSample < u_radius) {
                      coverage += 1.0;
                  }
              }
              coverage /= 16.0;
              finalAlpha = coverage * u_alpha;
          }

          outAlpha = max(basicAlpha, finalAlpha);
      }`;

    const strokeShader = createShader(
      this.gl,
      this.gl.FRAGMENT_SHADER,
      strokeShaderSource
    );
    this.strokeProgram = createProgram(
      this.gl,
      fullQuadVertexShader,
      strokeShader
    );

    this.gl.useProgram(this.strokeProgram);
    this.gl.uniform1i(
      this.gl.getUniformLocation(this.strokeProgram, "u_pathMap"),
      TEXTURE_UNIT.PATHMAP
    );

    this.pathTexOut = this.gl.createTexture()!;
    this.gl.activeTexture(this.gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.pathTexOut);
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.CLAMP_TO_EDGE
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.CLAMP_TO_EDGE
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.LINEAR
    );

    this.framebuffer = this.gl.createFramebuffer()!;
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      this.pathTexOut,
      0
    );

    this.readFrameBuffer = this.gl.createFramebuffer()!;
    this.gl.bindFramebuffer(this.gl.READ_FRAMEBUFFER, this.readFrameBuffer);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      this.pathTexOut,
      0
    );

    bufferManager.createFullQuadVAO(this.strokeProgram);
  }

  resetWorkSpace(width: number, height: number) {
    this.gl.useProgram(this.strokeProgram);
    this.gl.uniform2f(
      this.gl.getUniformLocation(this.strokeProgram, "u_resolution"),
      width,
      height
    );

    this.clearAlpha(width, height);
  }

  start(pointer: Pointer) {
    this.points = [];
    this.points.push(pointer);
    this.strokeDirtyRecorder = DirtyRectRecorder.clampedRect(
      0,
      0,
      paintOptions.width,
      paintOptions.height
    );
    this.strokeDirtyRecorder.updatePointer(pointer, paintOptions.radius);
  }

  stroke(point: Pointer): Rect | null {
    this.points.push(point);

    const rect = this.drawLineToTex(
      this.points[this.points.length - 2],
      this.points[this.points.length - 1]
    );

    return rect;
  }

  end(): Rect | null {
    this.points = [];

    return null;
  }

  cancel() {
    this.points = [];
  }

  getStrokeDirtyRect(): Rect {
    return this.strokeDirtyRecorder.generateRect();
  }

  private drawLineToTex(start, end) {
    this.gl.useProgram(this.strokeProgram);

    this.gl.activeTexture(this.gl.TEXTURE0 + TEXTURE_UNIT.PATHMAP);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.pathTex);

    this.gl.uniform1f(
      this.gl.getUniformLocation(this.strokeProgram, "u_radius"),
      paintOptions.radius
    );
    this.gl.uniform1f(
      this.gl.getUniformLocation(this.strokeProgram, "u_alpha"),
      paintOptions.alpha
    );
    this.gl.uniform2f(
      this.gl.getUniformLocation(this.strokeProgram, "u_start"),
      start.x,
      start.y
    );
    this.gl.uniform2f(
      this.gl.getUniformLocation(this.strokeProgram, "u_end"),
      end.x,
      end.y
    );

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      this.pathTexOut,
      0
    );

    this.scissorDirtyRecorder = DirtyRectRecorder.clampedRect(
      0,
      0,
      paintOptions.width,
      paintOptions.height
    );
    this.scissorDirtyRecorder.updatePointer(start, paintOptions.radius);
    this.scissorDirtyRecorder.updatePointer(end, paintOptions.radius);

    this.strokeDirtyRecorder.updatePointer(start, paintOptions.radius);
    this.strokeDirtyRecorder.updatePointer(end, paintOptions.radius);

    const scissorRect = this.scissorDirtyRecorder.generateRect();

    this.gl.enable(this.gl.SCISSOR_TEST);
    this.gl.scissor(
      scissorRect.x,
      scissorRect.y,
      scissorRect.width,
      scissorRect.height
    );
    this.gl.viewport(0, 0, paintOptions.width, paintOptions.height);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    this.gl.bindFramebuffer(this.gl.READ_FRAMEBUFFER, this.readFrameBuffer);
    this.gl.bindFramebuffer(this.gl.DRAW_FRAMEBUFFER, this.framebuffer);

    this.gl.framebufferTexture2D(
      this.gl.READ_FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      this.pathTexOut,
      0
    );

    this.gl.framebufferTexture2D(
      this.gl.DRAW_FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      this.pathTex,
      0
    );

    this.gl.blitFramebuffer(
      scissorRect.x,
      scissorRect.y,
      scissorRect.ex + 1,
      scissorRect.ey + 1,
      scissorRect.x,
      scissorRect.y,
      scissorRect.ex + 1,
      scissorRect.ey + 1,
      this.gl.COLOR_BUFFER_BIT,
      this.gl.NEAREST
    );

    return scissorRect;
  }

  private clearAlpha(w: number, h: number) {
    this.gl.activeTexture(this.gl.TEXTURE0 + TEXTURE_UNIT.PATHMAP);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.pathTex);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.R8,
      w,
      h,
      0,
      this.gl.RED,
      this.gl.UNSIGNED_BYTE,
      null
    );

    this.gl.activeTexture(this.gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.pathTexOut);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.R8,
      w,
      h,
      0,
      this.gl.RED,
      this.gl.UNSIGNED_BYTE,
      null
    );
  }
}
