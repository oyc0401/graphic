import { createShader, createProgram, getGlHelper } from "../utils/glHelper";
import { getRenderingManager } from "../render";
import {
  TEXTURE_UNIT,
  getSourceTextureManager,
  paintOptions,
} from "../texture";
import { getLayerManager } from "../layer";
import { getBufferManager, getFullQuadShader } from "../vertexShader";
import { getManager } from "../../../utils/cachedManager";
import { getHistoryManager, HistoryObject } from "../history/history";
import { DirtyRectRecorder, Rect } from "@/core/utils/rect";

export function getBrushManager(canvas, gl) {
  const manager = getManager(gl, "brushManager", () =>
    makeBrushManager(canvas, gl)
  );
  return manager;
}

function makeBrushManager(canvas, gl) {
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

  // 원본 이미지 텍스처 생성
  const sourceTextureManager = getSourceTextureManager(canvas, gl);
  const fullQuadVertexShader = getFullQuadShader(gl);
  const bufferManager = getBufferManager(canvas, gl);

  let strokeShaderSource = `#version 300 es
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
  let strokeShader = createShader(gl, gl.FRAGMENT_SHADER, strokeShaderSource);

  let strokeProgram = createProgram(gl, fullQuadVertexShader, strokeShader);
  gl.useProgram(strokeProgram);

  // 알파맵 텍스처 생성 및 데이터 업로드
  let pathTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.PATHMAP);
  gl.bindTexture(gl.TEXTURE_2D, pathTex);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  gl.uniform1i(
    gl.getUniformLocation(strokeProgram, "u_pathMap"),
    TEXTURE_UNIT.PATHMAP
  );

  // 출력용 텍스처 생성
  let pathTexOut = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
  gl.bindTexture(gl.TEXTURE_2D, pathTexOut);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // 프레임버퍼 생성 및 바인딩
  let framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    pathTexOut,
    0
  );

  // 쓰여진 결과를 blit으로 기본 변위맵에 업로드 하기 위해서
  let readFrameBuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readFrameBuffer);
  gl.framebufferTexture2D(
    // 당장 안쓰더라도 바인딩 해놓으면 내부에서 자체 최적화 되나?
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    pathTexOut,
    0
  );

  bufferManager.createFullQuadVAO(strokeProgram);

  //////////////////////////

  //////////////////////////
  //gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  let brushShaderSource = `#version 300 es
      precision mediump float;

      uniform sampler2D u_pathMap;
      uniform sampler2D u_source;  // 원본 텍스처
      uniform vec2 u_resolution;
      uniform vec3 u_color; // 원하는 색

      in vec2 v_texCoord;
      out vec4 outColor;

      void main() {
       float value = texture(u_pathMap, v_texCoord).x; // 브러시 알파값 (0~1)
        vec4 brushColor = vec4(u_color, value); // 새로운 색
        vec4 imageColor = texture(u_source, v_texCoord); // 기존 이미지 색

       // Premultiplied Alpha 적용
        vec3 premultBrush = brushColor.rgb * brushColor.a; // RGB에 알파를 미리 곱함
        vec3 premultImage = imageColor.rgb;

        // 블렌딩 (Premultiplied 방식)
        vec3 blendedRGB = premultImage * (1.0 - brushColor.a) + premultBrush;
        float blendedAlpha = imageColor.a + brushColor.a * (1.0 - imageColor.a); 

        // 최종 색상
        outColor = vec4(blendedRGB, blendedAlpha);
      }
      `;

  let brushShader = createShader(gl, gl.FRAGMENT_SHADER, brushShaderSource);
  let brushProgram = createProgram(gl, fullQuadVertexShader, brushShader);
  gl.useProgram(brushProgram);

  gl.uniform1i(
    gl.getUniformLocation(brushProgram, "u_pathMap"),
    TEXTURE_UNIT.PATHMAP
  );

  gl.uniform1i(
    gl.getUniformLocation(brushProgram, "u_source"),
    TEXTURE_UNIT.SOURCE
  ); // 텍스처 유닛 1에 할당

  bufferManager.createFullQuadVAO(brushProgram);

  ///////////////////////////////////////
  let eraserShaderSource = `#version 300 es
      precision mediump float;

      uniform sampler2D u_pathMap;
      uniform sampler2D u_source;  // 원본 텍스처
      uniform vec2 u_resolution;

      in vec2 v_texCoord;
      out vec4 outColor;

      void main() {
        float value = texture(u_pathMap, v_texCoord).x; // 브러시 알파값 (0~1)
        vec4 imageColor = texture(u_source, v_texCoord); // 기존 이미지 색

        float factor = 1.0 - value;
        outColor = vec4(imageColor.rgb * factor, imageColor.a * factor);
      }
      `;

  let eraserShader = createShader(gl, gl.FRAGMENT_SHADER, eraserShaderSource);
  let eraserProgram = createProgram(gl, fullQuadVertexShader, eraserShader);
  gl.useProgram(eraserProgram);

  gl.uniform1i(
    gl.getUniformLocation(eraserProgram, "u_pathMap"),
    TEXTURE_UNIT.PATHMAP
  );

  gl.uniform1i(
    gl.getUniformLocation(eraserProgram, "u_source"),
    TEXTURE_UNIT.SOURCE
  ); // 텍스처 유닛 1에 할당

  bufferManager.createFullQuadVAO(eraserProgram);

  //////////////////////

  ///////////

  function setSize() {
    let width = paintOptions.width;
    let height = paintOptions.height;

    //console.log(paintOptions);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);

    gl.useProgram(strokeProgram);
    gl.uniform2f(
      gl.getUniformLocation(strokeProgram, "u_resolution"),
      width,
      height
    );

    gl.useProgram(brushProgram);
    gl.uniform2f(
      gl.getUniformLocation(brushProgram, "u_resolution"),
      width,
      height
    );
    gl.useProgram(eraserProgram);
    gl.uniform2f(
      gl.getUniformLocation(eraserProgram, "u_resolution"),
      width,
      height
    );

    // 알파맵 텍스처 데이터 업로드
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.PATHMAP);
    gl.bindTexture(gl.TEXTURE_2D, pathTex);

    // 0으로 초기화
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      width,
      height,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      null
    );

    // 출력용 텍스처
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, pathTexOut);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      width,
      height,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      null
    );

    clearMap();
  }

  setSize();

  let layerManager = getLayerManager(canvas, gl);

  let renderingManager = getRenderingManager(canvas, gl);
  function clearMap() {
    let glHelper = getGlHelper(gl);
    glHelper.clearTexture(pathTex, paintOptions.width, paintOptions.height, 0);
  }

  // start부터 end까지
  let strokeDirtyRecorder: DirtyRectRecorder;

  // 이전 move에서 다음 move까지
  let scissorDirtyRecorder: DirtyRectRecorder;

  let brushManager = {
    enter() {
      // console.log("enter!");
    },
    start(pointer) {
      // console.log("start!");

      strokeDirtyRecorder = DirtyRectRecorder.clampedRect(
        0,
        0,
        paintOptions.width,
        paintOptions.height
      );
      strokeDirtyRecorder.updatePointer(pointer, paintOptions.radius);
    },
    stroke(start, end) {
      // stroke는 알파맵에 대상 부위를 저장하는 것이다.

      // 현재는 pathTex를 유니폼으로 넣고. 해당 선분에 위치하는것을 pathOut에 그린다. 이때 pathTex에 이미 그려져있는 부분은 그대로 반영하고. max값만 반영한다.

      // webgl을 사용하는 것에서 canvas2d를 사용하는 코드로 변환을 먼저 해보자.

      gl.useProgram(strokeProgram);

      gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.PATHMAP);
      gl.bindTexture(gl.TEXTURE_2D, pathTex);

      // 유나폼 변수 설정
      gl.uniform1f(
        gl.getUniformLocation(strokeProgram, "u_radius"),
        paintOptions.radius
      );
      gl.uniform1f(
        gl.getUniformLocation(strokeProgram, "u_alpha"),
        paintOptions.alpha
      );

      gl.uniform2f(
        gl.getUniformLocation(strokeProgram, "u_start"),
        start.x,
        start.y
      );
      gl.uniform2f(gl.getUniformLocation(strokeProgram, "u_end"), end.x, end.y);

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      // 프레임버퍼에 쓰기 텍스처 넣기
      // 이전에 blit할때 다른거 지정되어있었음
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        pathTexOut,
        0
      );

      scissorDirtyRecorder = DirtyRectRecorder.clampedRect(
        0,
        0,
        paintOptions.width,
        paintOptions.height
      );
      scissorDirtyRecorder.updatePointer(start, paintOptions.radius);
      scissorDirtyRecorder.updatePointer(end, paintOptions.radius);

      strokeDirtyRecorder.updatePointer(start, paintOptions.radius);
      strokeDirtyRecorder.updatePointer(end, paintOptions.radius);

      let scissorRect = scissorDirtyRecorder.generateRect();
      // SCISSOR TEST로 일부만 렌더링
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(
        scissorRect.x,
        scissorRect.y,
        scissorRect.width,
        scissorRect.height
      );
      gl.viewport(0, 0, paintOptions.width, paintOptions.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // 적용된 텍스처를 read에도 옮기기
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readFrameBuffer);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, framebuffer);

      gl.framebufferTexture2D(
        gl.READ_FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        pathTexOut,
        0
      );

      gl.framebufferTexture2D(
        gl.DRAW_FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        pathTex,
        0
      );

      gl.blitFramebuffer(
        scissorRect.x,
        scissorRect.y,
        scissorRect.ex + 1,
        scissorRect.ey + 1, // 소스
        scissorRect.x,
        scissorRect.y,
        scissorRect.ex + 1,
        scissorRect.ey + 1, // 대상
        gl.COLOR_BUFFER_BIT,
        gl.NEAREST
      );
    },
    brush() {
      gl.useProgram(brushProgram);

      gl.uniform3fv(
        gl.getUniformLocation(brushProgram, "u_color"),
        paintOptions.color
      );
      // 쓰기 영역: 내 화면
      gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.layerFBO);
      gl.viewport(0, 0, paintOptions.width, paintOptions.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.disable(gl.SCISSOR_TEST);

      renderingManager.render(scissorDirtyRecorder.generateRect());
    },
    eraser() {
      gl.useProgram(eraserProgram);
      // 쓰기 영역: 내 화면
      gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.layerFBO);
      gl.viewport(0, 0, paintOptions.width, paintOptions.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      gl.disable(gl.SCISSOR_TEST);

      renderingManager.render(scissorDirtyRecorder.generateRect());
    },
    end() {
      let strokeRect = strokeDirtyRecorder.generateRect();
      let { before, after } = sourceTextureManager.upload(
        strokeRect.x,
        strokeRect.y,
        strokeRect.width,
        strokeRect.height
      );

      const newHistory = new HistoryObject(gl, {
        undo: async () => {
          await before.apply();
          await renderingManager.render();
          return { tool: "brush" };
        },
        redo: async () => {
          await after.apply();
          await renderingManager.render();
          return { tool: "brush" };
        },
      });

      let historyManager = getHistoryManager(canvas, gl);
      historyManager.addUndo(newHistory);
      clearMap();
    },
    cancel() {
      sourceTextureManager.restore();
      clearMap();
      renderingManager.render();
    },
    exit() {},
    setSize,
  };

  return brushManager;
}
