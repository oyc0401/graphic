import { createShader, createProgram, getGlHelper } from "./glHelper";
import { getLiquifyManager } from "./liquify/liquify";
import {
  TEXTURE_UNIT,
  getSourceTextureManager,
  paintOptions,
  getOffscreenManager,
} from "./texture";
import { getFullQuadVertexShader } from "./vertexShader";

/**
 * 싱글톤, 처음 시작할 때만 glsl 컴파일 함.
 */
const drawManagers = new Map();

export function getBrushManager(canvas, gl) {
  if (drawManagers.has(gl)) {
    return drawManagers.get(gl);
  }

  const brushManager = makeBrushManager(canvas, gl);
  drawManagers.set(gl, brushManager);

  return brushManager;
}

function makeBrushManager(canvas, gl) {
  // let width = paintOptions.width;
  //  let height = paintOptions.height;

  // gl.viewport(0, 0, width, height);
  //  gl.clearColor(0, 0, 0, 0);

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

  // 원본 이미지 텍스처 생성
  const sourceTextureManager = getSourceTextureManager(canvas, gl);
  const fullQuadVertexShader = getFullQuadVertexShader(gl);

  let strokeShaderSource = `#version 300 es
    precision highp float;

    uniform sampler2D u_pathMap;

    uniform vec2 u_start;
    uniform vec2 u_end;
    uniform float u_radius;
    uniform vec2 u_resolution;
    uniform float u_alpha;

    in vec2 v_texCoord;
    out float outAlpha;

    void main() {
      float basicAlpha = texture(u_pathMap, v_texCoord).x; // 원래 해당 좌표의 투명도
      vec2 pixelCoord = v_texCoord * u_resolution; // 텍스쳐 좌표를 픽셀 단위로 변환

      vec2 ab = u_end - u_start;
      float t = clamp(dot(pixelCoord - u_start, ab) / dot(ab, ab), 0.0, 1.0);
      vec2 closestPoint = u_start + ab * t;
      float dist = length(pixelCoord - closestPoint);

      float newAlpha = u_alpha;
      if (dist < u_radius) {
        // 테두리 보간
        if (u_radius - dist < 1.0) {
          newAlpha = (u_radius - dist) * u_alpha;

          // 이렇게 하면 도트 그리기
           //newAlpha = (u_radius - dist) < 0.5 ? 0.0 : u_alpha;
        }
      } else {
        newAlpha = 0.0;
      }

      // 더 투명도가 높은 것 선택.
      if (basicAlpha < newAlpha) {
        outAlpha = newAlpha;
      } else {
        outAlpha = basicAlpha;
      }
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
    TEXTURE_UNIT.PATHMAP,
  );

  // 출력용 텍스처 생성
  let pathTexOut = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
  gl.bindTexture(gl.TEXTURE_2D, pathTexOut);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // gl.texImage2D(
  //   gl.TEXTURE_2D,
  //   0,
  //   gl.R32F,
  //   width,
  //   height,
  //   0,
  //   gl.RED,
  //   gl.FLOAT,
  //   null,
  // );

  // 프레임버퍼 생성 및 바인딩
  let framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    pathTexOut,
    0,
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
    0,
  );

  let positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
    gl.STATIC_DRAW,
  );
  let posLoc = gl.getAttribLocation(strokeProgram, "a_position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
  //////////////////////////

  //////////////////////////
  //gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  let brushShaderSource = `#version 300 es
      precision highp float;

      uniform sampler2D u_pathMap;
      uniform sampler2D u_sourse;  // 원본 텍스처
      uniform vec2 u_resolution;
      uniform vec3 u_color; // 원하는 색

      in vec2 v_texCoord;
      out vec4 outColor;

      void main() {
        float value = texture(u_pathMap, v_texCoord).x; // 브러시 알파값 (0~1)
        vec4 imageColor = texture(u_sourse, v_texCoord); // 기존 이미지 색
        vec4 brushColor = vec4(u_color, value); // 새로운 색

        // Premultiplied Alpha 적용
        vec3 premultBrush = brushColor.rgb * brushColor.a; // RGB에 알파를 미리 곱함
        vec3 premultImage = imageColor.rgb * imageColor.a;

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
  // gl.uniform2f(
  //   gl.getUniformLocation(brushProgram, "u_resolution"),
  //   width,
  //   height,
  // );
  gl.uniform1i(
    gl.getUniformLocation(brushProgram, "u_pathMap"),
    TEXTURE_UNIT.PATHMAP,
  );

  gl.uniform1i(
    gl.getUniformLocation(brushProgram, "u_sourse"),
    TEXTURE_UNIT.SOURCE,
  ); // 텍스처 유닛 1에 할당

  let posLoc2 = gl.getAttribLocation(brushProgram, "a_position");
  gl.enableVertexAttribArray(posLoc2);
  gl.vertexAttribPointer(posLoc2, 2, gl.FLOAT, false, 0, 0);

  ///////////////////////////////////////
  let eraserShaderSource = `#version 300 es
      precision highp float;

      uniform sampler2D u_pathMap;
      uniform sampler2D u_sourse;  // 원본 텍스처
      uniform vec2 u_resolution;

      in vec2 v_texCoord;
      out vec4 outColor;

      void main() {
        float value = texture(u_pathMap, v_texCoord).x; // 브러시 알파값 (0~1)
        vec4 imageColor = texture(u_sourse, v_texCoord); // 기존 이미지 색

        float newAlpha = imageColor.a - imageColor.a * value;
        outColor = vec4(imageColor.rgb * newAlpha , newAlpha);
      }
      `;

  let eraserShader = createShader(gl, gl.FRAGMENT_SHADER, eraserShaderSource);
  let eraserProgram = createProgram(gl, fullQuadVertexShader, eraserShader);
  gl.useProgram(eraserProgram);
  // gl.uniform2f(
  //   gl.getUniformLocation(eraserProgram, "u_resolution"),
  //   width,
  //   height,
  // );
  gl.uniform1i(
    gl.getUniformLocation(eraserProgram, "u_pathMap"),
    TEXTURE_UNIT.PATHMAP,
  );

  gl.uniform1i(
    gl.getUniformLocation(eraserProgram, "u_sourse"),
    TEXTURE_UNIT.SOURCE,
  ); // 텍스처 유닛 1에 할당

  let posLoc3 = gl.getAttribLocation(eraserProgram, "a_position");
  gl.enableVertexAttribArray(posLoc3);
  gl.vertexAttribPointer(posLoc3, 2, gl.FLOAT, false, 0, 0);

  //////////////////////
  let dirtyRect = { x: 0, y: 0, ex: 0, ey: 0, width: 0, height: 0 };

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
      height,
    );

    gl.useProgram(brushProgram);
    gl.uniform2f(
      gl.getUniformLocation(brushProgram, "u_resolution"),
      width,
      height,
    );
    gl.useProgram(eraserProgram);
    gl.uniform2f(
      gl.getUniformLocation(eraserProgram, "u_resolution"),
      width,
      height,
    );

    // 알파맵 텍스처 데이터 업로드
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.PATHMAP);
    gl.bindTexture(gl.TEXTURE_2D, pathTex);

    // 0으로 초기화
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R32F,
      width,
      height,
      0,
      gl.RED,
      gl.FLOAT,
      null,
    );

    // 출력용 텍스처
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, pathTexOut);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R32F,
      width,
      height,
      0,
      gl.RED,
      gl.FLOAT,
      null,
    );

    clearMap();
  }

  setSize();

  let offScreenManager = getOffscreenManager(canvas, gl);

  function stroke(start, end) {
    let height = paintOptions.height;

    gl.useProgram(strokeProgram);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.PATHMAP);
    gl.bindTexture(gl.TEXTURE_2D, pathTex);

    // 유나폼 변수 설정
    gl.uniform1f(
      gl.getUniformLocation(strokeProgram, "u_radius"),
      paintOptions.radius,
    );
    gl.uniform1f(
      gl.getUniformLocation(strokeProgram, "u_alpha"),
      paintOptions.alpha,
    );

    gl.uniform2f(
      gl.getUniformLocation(strokeProgram, "u_start"),
      start.x,
      height - start.y,
    );
    gl.uniform2f(
      gl.getUniformLocation(strokeProgram, "u_end"),
      end.x,
      height - end.y,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    // 프레임버퍼에 쓰기 텍스처 넣기
    // 이전에 blit할때 다른거 지정되어있었음
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      pathTexOut,
      0,
    );

    let ceiledRadius = Math.ceil(paintOptions.radius);
    let minX = Math.min(start.x, end.x);
    let maxX = Math.max(start.x, end.x);
    let minY = Math.min(height - start.y, height - end.y);
    let maxY = Math.max(height - start.y, height - end.y);

    dirtyRect.x = minX - ceiledRadius;
    dirtyRect.y = minY - ceiledRadius;
    dirtyRect.ex = maxX + ceiledRadius + 1;
    dirtyRect.ey = maxY + ceiledRadius + 1;
    dirtyRect.width = maxX - minX + 1 + 2 * ceiledRadius;
    dirtyRect.height = maxY - minY + 1 + 2 * ceiledRadius;

    // SCISSOR TEST로 일부만 렌더링
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(dirtyRect.x, dirtyRect.y, dirtyRect.width, dirtyRect.height);
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
      0,
    );

    gl.framebufferTexture2D(
      gl.DRAW_FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      pathTex,
      0,
    );

    gl.blitFramebuffer(
      dirtyRect.x,
      dirtyRect.y,
      dirtyRect.ex,
      dirtyRect.ey, // 소스
      dirtyRect.x,
      dirtyRect.y,
      dirtyRect.ex,
      dirtyRect.ey, // 대상
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );
  }

  function brush() {
    gl.useProgram(brushProgram);

    gl.uniform3fv(
      gl.getUniformLocation(brushProgram, "u_color"),
      paintOptions.color,
    );
    // 쓰기 영역: 내 화면
    gl.bindFramebuffer(gl.FRAMEBUFFER, offScreenManager.offscreenFBO);
    gl.viewport(0, 0, paintOptions.width, paintOptions.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.disable(gl.SCISSOR_TEST);

    offScreenManager.renderOffscreenToCanvas();
  }

  function eraser() {
    gl.useProgram(eraserProgram);
    // 쓰기 영역: 내 화면
    gl.bindFramebuffer(gl.FRAMEBUFFER, offScreenManager.offscreenFBO);
    gl.viewport(0, 0, paintOptions.width, paintOptions.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.disable(gl.SCISSOR_TEST);

    offScreenManager.renderOffscreenToCanvas();
  }

  function cancel() {
    sourceTextureManager.restore();
  }

  function end() {
    clearMap();
    // 위는 해야하지만,
    // 아래꺼는 캔슬되서 엔드가 실행되면 굳이 실행 안해도 됌
    // 근데, 이게.. 어쩔수 없어서 그냥 두자.
    // 캔슬이 그리 자주나나? 캔슬은 핀치줌인데, 일어나도 1초간은 어짜피 드로우 안할거같음.
    sourceTextureManager.uploadCurrent();
  }

  function clearMap() {
    let glHelper = getGlHelper(gl);
    glHelper.clearTexture(pathTex, paintOptions.width, paintOptions.height, 0);
  }

  let brushManager = {
    stroke,
    brush,
    eraser,
    end,
    cancel,
    setSize,
    clearMap,
  };

  return brushManager;
}

export async function renderScreen(
  canvas,
  gl,
  width,
  height,
  screenWidth,
  screenHeight,
  x,
  y,
  magnification,
) {
  let offScreenManager = getOffscreenManager(canvas, gl);
  // console.log(width, height, screenWidth, screenHeight, x, y, magnification);
  if (
    paintOptions.screenWidth != screenWidth ||
    paintOptions.screenHeight != screenHeight
  ) {
    console.log("전체 화면 크기가 변함!");
    canvas.width = screenWidth;
    canvas.height = screenHeight;
  }
  if (paintOptions.width != width || paintOptions.height != height) {
    console.log("그림 영역 크기가 변함!");

    // 텍스펴 크기를 낮추기()
    changeTex(
      canvas,
      gl,
      paintOptions.width,
      paintOptions.height,
      width,
      height,
    );

    paintOptions.width = width;
    paintOptions.height = height;
    paintOptions.screenWidth = screenWidth;
    paintOptions.screenHeight = screenHeight;
    paintOptions.x = x;
    paintOptions.y = y;
    paintOptions.magnification = magnification;

    let sourceTextureManager = getSourceTextureManager(canvas, gl);
    sourceTextureManager.uploadCurrent();

    let drawManager = getBrushManager(canvas, gl);
    drawManager.setSize();
    let liquifyManager = await getLiquifyManager(canvas, gl);
    liquifyManager.setSize();
  }

  paintOptions.width = width;
  paintOptions.height = height;
  paintOptions.screenWidth = screenWidth;
  paintOptions.screenHeight = screenHeight;
  paintOptions.x = x;
  paintOptions.y = y;
  paintOptions.magnification = magnification;

  offScreenManager.renderOffscreenToCanvas();
}

function changeTex(canvas, gl, oldWidth, oldHeight, newWidth, newHeight) {
  console.log("changeTex");
  const newTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE17);
  gl.bindTexture(gl.TEXTURE_2D, newTexture);
  // WebGL2에서는 texImage2D로 먼저 공간(크기) 할당해주고, 이후 copyTexImage2D 사용
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    newWidth,
    newHeight,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );

  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

  // 텍스처를 프레임버퍼에 첨부
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    newTexture,
    0,
  );

  let offScreenManager = getOffscreenManager(canvas, gl);

  // 이제 화면으로 blit (복사)하기 위해
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, offScreenManager.offscreenFBO);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, framebuffer); // null은 기본 화면 프레임버퍼

  let diffHeight = newHeight - oldHeight;
  gl.blitFramebuffer(
    0,
    0,
    oldWidth,
    oldHeight,
    0,
    diffHeight,
    oldWidth,
    oldHeight + diffHeight,
    gl.COLOR_BUFFER_BIT, // 복사할 버퍼
    gl.NEAREST,
  );

  // 그걸 다시 원래 텍스쳐에 붙여넣기

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TARGET);
  gl.bindTexture(gl.TEXTURE_2D, offScreenManager.offscreenTex);

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    newWidth,
    newHeight,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );

  gl.copyTexSubImage2D(
    gl.TEXTURE_2D, // 타겟 텍스처
    0, // 레벨
    0,
    0, // 텍스처 내에서 복사할 시작 좌표
    0,
    0, // 프레임버퍼에서 복사할 시작 좌표
    newWidth,
    newHeight, // 복사할 크기
  );

  gl.deleteTexture(newTexture);
}
