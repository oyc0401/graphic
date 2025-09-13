import { PathRenderer } from "./PathRenderer";
import { Pointer } from "@/core/types";
import { DirtyRectRecorder, Rect } from "@/core/utils/rect";
import { paintOptions, TEXTURE_UNIT } from "../../../texture";
import { createShader, createProgram } from "../../../utils/glHelper";
import { getFullQuadShader, getBufferManager } from "../../../vertexShader";

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
        "This device does not support linear filtering for float textures."
      );
    }
  }

  private initializeShaderResources() {
    const gl = this.gl;

    const fullQuadVertexShader = getFullQuadShader(gl);
    const bufferManager = getBufferManager(6, gl);

    const strokeShaderSource = `#version 300 es
      precision mediump float;
      
      // 현재까지 그려진 알파 채널이 담긴 텍스처
      uniform sampler2D u_pathMap;
      
      // 선분 정보와 브러시 특성
      uniform vec2 u_start;
      uniform vec2 u_end;
      uniform float u_radius;
      uniform float u_alpha;
      
      // 화면 해상도 (텍스처 좌표 → 픽셀 좌표 변환)
      uniform vec2 u_resolution;
      
      // 메인 텍스 좌표 & 출력
      in vec2 v_texCoord;
      out float outAlpha;
      
      // 16샘플(2×2) 오프셋
      const vec2 sampleOffsets[16] = vec2[](
          vec2(-0.375, -0.375), vec2(-0.125, -0.375), vec2(0.125, -0.375), vec2(0.375, -0.375),
          vec2(-0.375, -0.125), vec2(-0.125, -0.125), vec2(0.125, -0.125), vec2(0.375, -0.125),
          vec2(-0.375,  0.125), vec2(-0.125,  0.125), vec2(0.125,  0.125), vec2(0.375,  0.125),
          vec2(-0.375,  0.375), vec2(-0.125,  0.375), vec2(0.125,  0.375), vec2(0.375,  0.375)
      );
      
      // 픽셀(또는 샘플)과 선분 사이의 최단거리 구하기
      float distanceToSegment(vec2 p, vec2 a, vec2 b) {
          vec2 ab = b - a;
          float abLen2 = dot(ab, ab); // 선분 길이^2
          if(abLen2 < 0.000001) {
              // 선분이 거의 점에 가깝다면, 그냥 a와의 거리
              return length(p - a);
          }
          // 투영 비율 t
          float t = dot(p - a, ab) / abLen2;
          t = clamp(t, 0.0, 1.0);
          // 선분 위의 최근접 점
          vec2 closest = a + ab * t;
          return distance(p, closest);
      }
      
      void main() {
          // (1) 현재 픽셀에서 기존 알파값
          float basicAlpha = texture(u_pathMap, v_texCoord).r;
      
          // (2) 픽셀 중심 좌표 (픽셀 단위)
          vec2 pixelCoord = v_texCoord * u_resolution;
      
          // (3) 이 픽셀 중심 ~ 선분 거리
          float distCenter = distanceToSegment(pixelCoord, u_start, u_end);
      
          // 내부/외부 빠른 판정용 범위
          float inner = u_radius - 1.0;
          float outer = u_radius + 1.0;
      
          float finalAlpha;
      
          // (A) 완전 내부: 알파 100%
          if(distCenter < inner) {
              finalAlpha = u_alpha;
          }
          // (B) 완전 외부: 알파 0%
          else if(distCenter > outer) {
              finalAlpha = 0.0;
          }
          // (C) 경계 영역 16샘플 수동 SSAA
          else {
              float coverage = 0.0;
      
              // 16번 샘플링
              for(int i = 0; i < 16; i++) {
                  vec2 offset = sampleOffsets[i];
                  vec2 sampleCoord = pixelCoord + offset;
                  float distSample = distanceToSegment(sampleCoord, u_start, u_end);
                  if(distSample < u_radius) {
                      coverage += 1.0;
                  }
              }
              // 16샘플 평균 → [0..1] 커버리지
              coverage /= 16.0;
              
              // 최종 알파
              finalAlpha = coverage * u_alpha;
          }
      
          // (4) 기존 알파(basicAlpha)와 비교해 더 큰 값 적용
          outAlpha = max(basicAlpha, finalAlpha);
      }
    
    `;

    const strokeShader = createShader(
      gl,
      gl.FRAGMENT_SHADER,
      strokeShaderSource
    );
    this.strokeProgram = createProgram(gl, fullQuadVertexShader, strokeShader);

    gl.useProgram(this.strokeProgram);
    gl.uniform1i(
      gl.getUniformLocation(this.strokeProgram, "u_pathMap"),
      TEXTURE_UNIT.PATHMAP
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
      0
    );

    this.readFrameBuffer = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.readFrameBuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.pathTexOut,
      0
    );

    bufferManager.createFullQuadVAO(this.strokeProgram);
  }

  resetWorkSpace(width: number, height: number) {
    const gl = this.gl;

    gl.useProgram(this.strokeProgram);
    gl.uniform2f(
      gl.getUniformLocation(this.strokeProgram, "u_resolution"),
      width,
      height
    );

    this.clearAlpha(width, height);
  }

  start(pointer: Pointer) {
    super.start(pointer);
    this.strokeDirtyRecorder = DirtyRectRecorder.clampedRect(
      0,
      0,
      paintOptions.width,
      paintOptions.height
    );
    this.strokeDirtyRecorder.updatePointer(pointer, paintOptions.radius);
  }

  stroke(pointer: Pointer): Rect | null {
    super.stroke(pointer);

    const rect = this.drawLineToTex(
      this.points[this.points.length - 2],
      this.points[this.points.length - 1]
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
      paintOptions.radius
    );
    gl.uniform1f(
      gl.getUniformLocation(this.strokeProgram, "u_alpha"),
      paintOptions.alpha
    );
    gl.uniform2f(
      gl.getUniformLocation(this.strokeProgram, "u_start"),
      start.x,
      start.y
    );
    gl.uniform2f(
      gl.getUniformLocation(this.strokeProgram, "u_end"),
      end.x,
      end.y
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
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

    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(
      scissorRect.x,
      scissorRect.y,
      scissorRect.width,
      scissorRect.height
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
      0
    );

    gl.framebufferTexture2D(
      gl.DRAW_FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.pathTex,
      0
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
      gl.NEAREST
    );

    return scissorRect;
  }

  private clearAlpha(w: number, h: number) {
    super.clearPathTex(w, h);

    const gl = this.gl;

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, this.pathTexOut);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      w,
      h,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      null
    );
  }
}
