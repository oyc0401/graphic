import { TEXTURE_UNIT, getSourceTextureManager, paintOptions } from "./texture";
import { getLayerManager } from "./layer";
import { getLiquifyManager } from "./tool/liquify";

import { getSelectionManager } from "./selection";
import { getBrushManager } from "./tool/brushTool";

import { createShader, createProgram } from "./utils/glHelper";
import { enable_a_position, getFullQuadShader } from "./vertexShader";
import { getManager } from "./utils/cachedManager";

export function getRenderingManager(canvas, gl) {
  const manager = getManager(gl, "rendering", () =>
    makeRenderingManager(canvas, gl),
  );
  return manager;
}

function makeRenderingManager(canvas, gl) {
  const fullQuadVertexShader = getFullQuadShader(gl);
  const offscreenManager = getOffscreenManager(canvas, gl);

  let displaySource = `#version 300 es
      precision highp float;
    
      in vec2 v_texCoord;
      out vec4 outColor;
    
      uniform vec2 u_resolution;
      uniform vec2 u_pos;
      uniform vec2 u_screenSize;
      uniform float u_magnification;
      uniform float u_dpr;
    
    
    void main() {
      // 실제 픽셀 좌표
      float px = v_texCoord.x * u_screenSize.x / u_dpr ;
      float py = v_texCoord.y * u_screenSize.y / u_dpr ;
    
      float cellSize = 16.0 ;   // 셀 크기
      float borderSize = 1.0;  // 테두리 두께
    
      float modX = mod(px, cellSize);
      float modY = mod(py, cellSize);
    
      // 경계선 근처면 밝은 선 색
      if (modX < borderSize || modY < borderSize) {
        outColor = vec4(0.89, 0.89, 0.89, 1.0);  // 테두리
      } else {
        outColor = vec4(0.91, 0.91, 0.91, 1.0);  // 셀 내부 
      }
    }
  `;

  let displayShader = createShader(gl, gl.FRAGMENT_SHADER, displaySource);
  let displayProgram = createProgram(gl, fullQuadVertexShader, displayShader);
  gl.useProgram(displayProgram);

  enable_a_position(gl, displayProgram);

  function renderDisplay() {
    gl.useProgram(displayProgram);

    gl.uniform2f(
      gl.getUniformLocation(displayProgram, "u_resolution"),
      paintOptions.width,
      paintOptions.height,
    );
    gl.uniform2f(
      gl.getUniformLocation(displayProgram, "u_pos"),
      paintOptions.x,
      paintOptions.y,
    );
    gl.uniform2f(
      gl.getUniformLocation(displayProgram, "u_screenSize"),
      paintOptions.screenWidth,
      paintOptions.screenHeight,
    );
    gl.uniform1f(
      gl.getUniformLocation(displayProgram, "u_magnification"),
      paintOptions.magnification,
    );
    gl.uniform1f(
      gl.getUniformLocation(displayProgram, "u_dpr"),
      paintOptions.dpr,
    );

    // 쓰기 영역: 캔버스
    gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenManager.offscreenFBO);
    gl.viewport(0, 0, paintOptions.screenWidth, paintOptions.screenHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  let backgroundSource = `#version 300 es
    precision highp float;
    
    in vec2 v_texCoord;
    out vec4 outColor;
    
    uniform vec2 u_resolution;   // 캔버스(원본 텍스처) 해상도 (px)
    uniform vec2 u_pos;          // 캔버스의 왼쪽 상단 위치 (2D UI 좌표, px)
    uniform vec2 u_screenSize;   // 전체 스크린 크기 (px)
    uniform float u_magnification; // 확대 배율 (값이 클수록 크게 보임)

    void main() {
      // 1. magnification을 반영한 "스케일된 스크린" 크기 계산
      vec2 scaledScreenSize = u_screenSize / u_magnification;
      vec2 size = u_resolution;
      
      // 2. 풀스크린 정규 좌표(v_texCoord)를 스케일된 픽셀 좌표로 변환
      vec2 scaledFragCoord = v_texCoord * scaledScreenSize;
      
      // 3. 2D UI 기준 (왼쪽 상단 기준)인 캔버스 영역을 스케일된 좌표계로 변환  
      vec2 canvasPos = vec2(u_pos.x, scaledScreenSize.y - size.y - u_pos.y);
      vec2 min = canvasPos;
      vec2 max = canvasPos + size;
      
      // 4. 현재 픽셀이 캔버스 영역 내부에 있는지 체크
      if (scaledFragCoord.x < min.x ||
          scaledFragCoord.x > max.x ||
          scaledFragCoord.y < min.y ||
          scaledFragCoord.y > max.y) {
        discard;
      }
      
      // 5. 캔버스 영역 내부라면, 지정한 배경색을 출력  
      vec3 rgb = vec3(0.0, 0.0, 0.0);
      float alpha = 0.04;
      // outColor = vec4(rgb * alpha, alpha);
       
      outColor = vec4(1.0, 1.0, 1.0, 1.0);
    }
  `;

  let backgroundShader = createShader(gl, gl.FRAGMENT_SHADER, backgroundSource);
  let backgroundProgram = createProgram(
    gl,
    fullQuadVertexShader,
    backgroundShader,
  );
  gl.useProgram(backgroundProgram);

  enable_a_position(gl, backgroundProgram);

  function renderBackground() {
    gl.useProgram(backgroundProgram);

    gl.uniform2f(
      gl.getUniformLocation(backgroundProgram, "u_resolution"),
      paintOptions.width,
      paintOptions.height,
    );
    gl.uniform2f(
      gl.getUniformLocation(backgroundProgram, "u_pos"),
      paintOptions.x,
      paintOptions.y,
    );
    gl.uniform2f(
      gl.getUniformLocation(backgroundProgram, "u_screenSize"),
      paintOptions.screenWidth,
      paintOptions.screenHeight,
    );
    gl.uniform1f(
      gl.getUniformLocation(backgroundProgram, "u_magnification"),
      paintOptions.magnification,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenManager.offscreenFBO);
    gl.viewport(0, 0, paintOptions.screenWidth, paintOptions.screenHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  let renderShaderSource = `#version 300 es
    precision highp float;
    
    uniform sampler2D u_sourse;   // 원본 텍스처
    
    uniform vec2 u_resolution;    // 캔버스의 전체 화면 기준(왼쪽 상단) 위치 (픽셀 단위)
    uniform vec2 u_pos;           // 전체 스크린 크기 (픽셀 단위)
    uniform vec2 u_screenSize;    // 확대 배율 (값이 클수록 크게 보임)
    uniform float u_magnification;
    
    in vec2 v_texCoord;           // 풀스크린 정규화 좌표 (0~1)
    out vec4 outColor;
    
    void main() {
      // 1. magnification 반영된 "스케일된 스크린" 크기 계산
      vec2 scaledScreenSize = u_screenSize / u_magnification;
      vec2 size = u_resolution;
      
      // 2. v_texCoord (0~1)를 scaledScreenSize 기준 픽셀 좌표로 변환
      vec2 scaledFragCoord = v_texCoord * scaledScreenSize;
     
      // 3. 캔버스(원본 텍스처)가 차지하는 영역을 scaledScreenSize 좌표계로 구함.
      vec2 canvasPos = vec2(u_pos.x, scaledScreenSize.y - size.y - u_pos.y);
      vec2 min = canvasPos;
      vec2 max = canvasPos + size;
    
      // 4. 현재 픽셀이 캔버스 영역 내부에 있는지 검사
      if (scaledFragCoord.x < min.x ||
          scaledFragCoord.x > max.x ||
          scaledFragCoord.y < min.y ||
          scaledFragCoord.y > max.y) {
        discard;
      }
    
      // 5.) 캔버스 영역 내의 상대 좌표 (0~1) 계산
      vec2 local = (scaledFragCoord - min) / size;
    
      // 6. 원본 텍스처에서 local 좌표로 색상을 샘플링
      vec4 imageColor = texture(u_sourse, local);
      outColor = vec4(imageColor.rgb, imageColor.a);
    }
  `;

  let renderShader = createShader(gl, gl.FRAGMENT_SHADER, renderShaderSource);
  let renderProgram = createProgram(gl, fullQuadVertexShader, renderShader);
  gl.useProgram(renderProgram);

  gl.uniform1i(
    gl.getUniformLocation(renderProgram, "u_sourse"),
    TEXTURE_UNIT.LAYER,
  );

  enable_a_position(gl, renderProgram);

  function renderTexture() {
    gl.useProgram(renderProgram);

    gl.uniform2f(
      gl.getUniformLocation(renderProgram, "u_resolution"),
      paintOptions.width,
      paintOptions.height,
    );
    gl.uniform2f(
      gl.getUniformLocation(renderProgram, "u_pos"),
      paintOptions.x,
      paintOptions.y,
    );
    gl.uniform2f(
      gl.getUniformLocation(renderProgram, "u_screenSize"),
      paintOptions.screenWidth,
      paintOptions.screenHeight,
    );
    gl.uniform1f(
      gl.getUniformLocation(renderProgram, "u_magnification"),
      paintOptions.magnification,
    );

    // 쓰기 영역: 캔버스
    gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenManager.offscreenFBO);
    gl.viewport(0, 0, paintOptions.screenWidth, paintOptions.screenHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  let selectionShaderSource = `#version 300 es
    precision highp float;
    
    uniform sampler2D u_selection;
    
    uniform vec2 u_pos;             // 전체 화면 기준: 캔버스 왼쪽 상단
    uniform vec2 u_resolution;      // 실제 캔버스 크기 (px)
    uniform vec2 u_screenSize;      // 전체 스크린 크기 (px)
    uniform float u_magnification;
    
    uniform vec2 u_selectionPos;    // 선택 영역 위치 (캔버스 내부 기준)
    uniform vec2 u_selectionSize;   // 선택 영역 크기
    
    in vec2 v_texCoord;             // 풀스크린 정규화 좌표 (0~1)
    out vec4 outColor;
    
    void main() {
      // 1. magnification 반영된 "스케일된 스크린" 크기 계산
      vec2 scaledScreenSize = u_screenSize / u_magnification;
  
      // 2. v_texCoord (0~1)를 scaledScreenSize 기준 픽셀 좌표로 변환
      vec2 scaledFragCoord = v_texCoord * scaledScreenSize;
      vec2 size = u_selectionSize;
      
      // 3. 선택요소(원본 텍스처)가 차지하는 영역을 scaledScreenSize 좌표계로 구함.
      vec2 selectionPos = vec2(u_pos.x + u_selectionPos.x, scaledScreenSize.y - u_pos.y - size.y  - u_selectionPos.y);
      vec2 min = selectionPos;
      vec2 max = selectionPos + size;
    
      // 현재 픽셀이 selection 안에 있지 않으면 버림
      if (
        scaledFragCoord.x < min.x || scaledFragCoord.x > max.x ||
        scaledFragCoord.y < min.y || scaledFragCoord.y > max.y
      ) {
        discard;
      }
    
      // 선택영역 내에 있으면 텍스처 좌표 계산
      vec2 local = (scaledFragCoord - min) / size;

      // 이제 변환을 해야하는데, 현재 100px너비에서의 0.5 라면 50px인데, 이걸 4096텍스쳐 기준으로 잡으면 몇일까 0.0x일것임.
      // local => 0.5, size.x=> 100, 
      vec2 newLocal = local * size / 8192.0;
      vec4 imageColor = texture(u_selection, newLocal);
      outColor = vec4(imageColor.rgb, imageColor.a);
    }
  `;

  let selectionShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    selectionShaderSource,
  );
  let selectionProgram = createProgram(
    gl,
    fullQuadVertexShader,
    selectionShader,
  );
  gl.useProgram(selectionProgram);

  gl.uniform1i(
    gl.getUniformLocation(selectionProgram, "u_selection"),
    TEXTURE_UNIT.RENDERED_SELECTION,
  );
  // I want... => selectionProgram.setUniform1i("u_selection", TEXTURE_UNIT.SELECTION);

  enable_a_position(gl, selectionProgram);

  function renderSelection() {
    let selectionManager = getSelectionManager(canvas, gl);
    let selectionPos = selectionManager.getPosition();
    gl.useProgram(selectionProgram);

    gl.uniform2f(
      gl.getUniformLocation(selectionProgram, "u_pos"),
      paintOptions.x,
      paintOptions.y,
    );
    gl.uniform2f(
      gl.getUniformLocation(selectionProgram, "u_resolution"),
      paintOptions.width,
      paintOptions.height,
    );
    gl.uniform2f(
      gl.getUniformLocation(selectionProgram, "u_screenSize"),
      paintOptions.screenWidth,
      paintOptions.screenHeight,
    );
    gl.uniform1f(
      gl.getUniformLocation(selectionProgram, "u_magnification"),
      paintOptions.magnification,
    );

    gl.uniform2f(
      gl.getUniformLocation(selectionProgram, "u_selectionPos"),
      selectionPos.x,
      selectionPos.y,
    );
    gl.uniform2f(
      gl.getUniformLocation(selectionProgram, "u_selectionSize"),
      selectionPos.width,
      selectionPos.height,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenManager.offscreenFBO);
    gl.viewport(0, 0, paintOptions.screenWidth, paintOptions.screenHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function render() {
    console.log("render");
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);

    renderDisplay();

    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);

    renderBackground();
    renderTexture();
    if (paintOptions.showSelection) {
      renderSelection();
    }

    gl.disable(gl.BLEND);

    gl.flush();
    
    // 오프스크린을 null 프레임버퍼로 blit, 더블버퍼링을 구현하기 위해.
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, offscreenManager.offscreenFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);

    gl.blitFramebuffer(
      0,
      0,
      paintOptions.screenWidth,
      paintOptions.screenHeight, // src rect
      0,
      0,
      paintOptions.screenWidth,
      paintOptions.screenHeight, // dst rect
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );
  }

  return {
    render,
  };
}

function getOffscreenManager(canvas, gl) {
  const manager = getManager(gl, "offscreen", () =>
    createOffscreenManager(canvas, gl),
  );
  return manager;
}
function createOffscreenManager(canvas, gl) {
  const offscreenTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.OFFSCREEN);
  gl.bindTexture(gl.TEXTURE_2D, offscreenTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  const offscreenFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, offscreenFBO);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    offscreenTex,
    0,
  );

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    paintOptions.screenWidth,
    paintOptions.screenHeight,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );

  function resize(newWidth, newHeight) {
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.OFFSCREEN);
    // temp 크기 설정
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
  }

  return {
    resize,
    offscreenFBO,
  };
}

/**
 * 크기가 바뀌면 바꾸고 안바뀌면 렌더링만 함
 */
export async function resizeScreen(
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
  const renderingManager = getRenderingManager(canvas, gl);
  const resizeTexManager = getResizeLayerTexManager(canvas, gl);
  const offscreenManager = getOffscreenManager(canvas, gl);
  let resized = false;

  if (
    paintOptions.screenWidth != screenWidth ||
    paintOptions.screenHeight != screenHeight
  ) {
    console.log("전체 화면 크기가 변함!");
    // canvas Element의 크기를 변경
    canvas.width = screenWidth;
    canvas.height = screenHeight;

    offscreenManager.resize(screenWidth, screenHeight);
  }

  if (paintOptions.width != width || paintOptions.height != height) {
    console.log("그림 크기가 변함!");

    // 텍스쳐 크기를 낮추기
    resizeTexManager.resize(
      paintOptions.width,
      paintOptions.height,
      width,
      height,
    );
    resized = true;
  }

  paintOptions.width = width;
  paintOptions.height = height;
  paintOptions.screenWidth = screenWidth;
  paintOptions.screenHeight = screenHeight;
  paintOptions.x = x;
  paintOptions.y = y;
  paintOptions.magnification = magnification;

  if (resized) {
    const sourceTextureManager = getSourceTextureManager(canvas, gl);
    sourceTextureManager.uploadCurrent();

    const drawManager = getBrushManager(canvas, gl);
    const liquifyManager = getLiquifyManager(canvas, gl);

    if (!drawManager || !liquifyManager) {
      console.error("지금 도구가 다운되기 전에 사이즈 변경이 일어남!");
    } else {
      drawManager.setSize();
      liquifyManager.setSize();
    }
  }

  renderingManager.render();
}

function getResizeLayerTexManager(canvas, gl) {
  const manager = getManager(gl, "resizeTex", () =>
    createResizeManager(canvas, gl),
  );
  return manager;
}

function createResizeManager(canvas, gl) {
  const layerManager = getLayerManager(canvas, gl);

  // 1. 임시 텍스처 생성
  const tempFBO = gl.createFramebuffer();

  const tempTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
  gl.bindTexture(gl.TEXTURE_2D, tempTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  gl.bindFramebuffer(gl.FRAMEBUFFER, tempFBO);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    tempTex,
    0,
  );

  function resize(
    oldWidth: number,
    oldHeight: number,
    newWidth: number,
    newHeight: number,
  ) {
    console.log("[TextureResizeManager] resize", {
      oldWidth,
      oldHeight,
      newWidth,
      newHeight,
    });

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, tempTex);
    // temp 크기 설정
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

    // 3. 기존 layerFBO → 임시 텍스처로 복사
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, layerManager.layerFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, tempFBO);

    const diffHeight = newHeight - oldHeight;
    gl.blitFramebuffer(
      0,
      0,
      oldWidth,
      oldHeight,
      0,
      diffHeight,
      oldWidth,
      oldHeight + diffHeight,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );

    // 4. 임시 텍스처 → 레이어 텍스처로 복사
    gl.bindFramebuffer(gl.FRAMEBUFFER, tempFBO);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
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
    // 현재 바인딩된 FRAMEBUFFER로부터 픽셀 데이터를 현재 바인딩된 텍스처에 복사
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, newWidth, newHeight);
  }

  return {
    resize,
  };
}
