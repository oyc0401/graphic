import { TEXTURE_UNIT, getSourceTextureManager, paintOptions } from "./texture";
import { getLayerManager } from "./layer";
import { getLiquifyManager } from "./tool/liquify";

import { getBrushManager } from "./tool/brushTool";

import { createShader, createProgram } from "./glHelper";
import { enable_a_position, getFullQuadShader } from "./vertexShader";

const renderingManagerStore = new Map();

export function getRenderingManager(canvas, gl) {
  if (renderingManagerStore.has(gl)) {
    return renderingManagerStore.get(gl);
  }

  const manager = makeRenderingManager(canvas, gl);
  renderingManagerStore.set(gl, manager);

  return manager;
}

function makeRenderingManager(canvas, gl) {
  const fullQuadVertexShader = getFullQuadShader(gl);

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
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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
    uniform float u_dpr;         // device pixel ratio (필요시 사용)
    
    void main() {
      // 1. magnification을 반영한 "스케일된 스크린" 크기 계산
      vec2 scaledScreenSize = u_screenSize / u_magnification;
      
      // 2. 풀스크린 정규 좌표(v_texCoord)를 스케일된 픽셀 좌표로 변환
      vec2 scaledFragCoord = v_texCoord * scaledScreenSize;
      
      // 3. 2D UI 기준 (왼쪽 상단 기준)인 캔버스 영역을 스케일된 좌표계로 변환  
      float canvasLeft = u_pos.x;
      float canvasBottom = scaledScreenSize.y - u_resolution.y - u_pos.y;
      vec2 canvasSize = u_resolution;  // 캔버스 크기는 그대로 유지
      
      // 4. 현재 픽셀이 캔버스 영역 내부에 있는지 체크
      if (scaledFragCoord.x < canvasLeft ||
          scaledFragCoord.x > canvasLeft + canvasSize.x ||
          scaledFragCoord.y < canvasBottom ||
          scaledFragCoord.y > canvasBottom + canvasSize.y) {
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
    gl.uniform1f(
      gl.getUniformLocation(backgroundProgram, "u_dpr"),
      paintOptions.dpr,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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
      
      // 2. v_texCoord (0~1)를 scaledScreenSize 기준 픽셀 좌표로 변환
      vec2 scaledFragCoord = v_texCoord * scaledScreenSize;
    
      // 3. 캔버스(원본 텍스처)가 차지하는 영역을 scaledScreenSize 좌표계로 구함.
      float canvasLeft = u_pos.x;
      float canvasBottom = scaledScreenSize.y - u_resolution.y - u_pos.y;
      vec2 canvasSize = u_resolution;  // 캔버스의 크기는 그대로 u_resolution
    
      // 4. 현재 픽셀이 캔버스 영역 내부에 있는지 검사
      if (scaledFragCoord.x < canvasLeft ||
          scaledFragCoord.x > canvasLeft + canvasSize.x ||
          scaledFragCoord.y < canvasBottom ||
          scaledFragCoord.y > canvasBottom + canvasSize.y) {
        discard;
      }
    
      // 5.) 캔버스 영역 내의 상대 좌표 (0~1) 계산
      vec2 local = (scaledFragCoord - vec2(canvasLeft, canvasBottom)) / canvasSize;
    
      // 6. 원본 텍스처에서 local 좌표로 색상을 샘플링
      vec4 imageColor = texture(u_sourse, local);
      outColor = vec4(imageColor.rgb * imageColor.a, imageColor.a);
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
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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
      // 화면에서 이 fragment가 차지하는 실제 위치 (스크린 좌표계)
      vec2 screenCoord = v_texCoord * u_screenSize;
    
      // 확대 적용된 캔버스 크기
      vec2 scaledCanvasSize = u_resolution * u_magnification;
    
      // 캔버스 렌더링 시작 좌상단 좌표
      vec2 canvasOrigin = vec2(u_pos.x * u_magnification, u_screenSize.y - (u_pos.y + u_selectionSize.y) * u_magnification);

      // 보정된 y 좌표
      vec2 selectionPos = vec2(u_selectionPos.x, -u_selectionPos.y);
      
      // 선택영역의 좌상단과 우하단 (화면 기준)
      vec2 selectionScreenMin = canvasOrigin + (selectionPos * u_magnification);
      vec2 selectionScreenMax = selectionScreenMin + (u_selectionSize * u_magnification);
    
      // 현재 픽셀이 selection 안에 있지 않으면 버림
      if (
        screenCoord.x < selectionScreenMin.x || screenCoord.x > selectionScreenMax.x ||
        screenCoord.y < selectionScreenMin.y || screenCoord.y > selectionScreenMax.y
      ) {
        discard;
      }
    
      // 선택영역 내에 있으면 텍스처 좌표 계산
      vec2 local = (screenCoord - selectionScreenMin) / (selectionScreenMax - selectionScreenMin);
      outColor = texture(u_selection, local);
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
    TEXTURE_UNIT.SELECTION,
  );
  enable_a_position(gl, selectionProgram);

  function renderSelection() {
    let selectionManager = getSelectionManager(canvas, gl);

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
      selectionManager.x,
      selectionManager.y,
    );
    gl.uniform2f(
      gl.getUniformLocation(selectionProgram, "u_selectionSize"),
      selectionManager.width,
      selectionManager.height,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, paintOptions.screenWidth, paintOptions.screenHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function render() {
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);

    renderDisplay();

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    renderBackground();
    renderTexture();
    renderSelection();

    gl.disable(gl.BLEND);
  }

  return {
    render,
  };
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
  let renderingManager = getRenderingManager(canvas, gl);
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
    let liquifyManager = getLiquifyManager(canvas, gl);

    if (!drawManager || !liquifyManager) {
      console.error("지금 도구가 다운되기 전에 사이즈 변경이 일어남!");
    } else {
      drawManager.setSize();
      liquifyManager.setSize();
    }
  }

  paintOptions.width = width;
  paintOptions.height = height;
  paintOptions.screenWidth = screenWidth;
  paintOptions.screenHeight = screenHeight;
  paintOptions.x = x;
  paintOptions.y = y;
  paintOptions.magnification = magnification;

  renderingManager.render();
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

  let layerManager = getLayerManager(canvas, gl);

  // 이제 화면으로 blit (복사)하기 위해
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, layerManager.offscreenFBO);
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

  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
  gl.bindTexture(gl.TEXTURE_2D, layerManager.offscreenTex);

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

const selectionManagerStore = new Map();

function getSelectionManager(canvas, gl) {
  if (selectionManagerStore.has(gl)) {
    return selectionManagerStore.get(gl);
  }

  const manager = createSelectionManager(canvas, gl);
  selectionManagerStore.set(gl, manager);

  return manager;
}

function createSelectionManager(canvas, gl) {
  // 텍스처 생성
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SELECTION); // 9번 텍스처 유닛 활성화
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // 텍스처 데이터 초기화 (하늘색으로 채움: rgba(135, 206, 235, 255))
  let x = 50;
  let y = 50;
  const width = 300;
  const height = 200;
  const pixelCount = width * height;
  const skyBlue = new Uint8Array(pixelCount * 4); // RGBA 4채널

  for (let i = 0; i < pixelCount; i++) {
    skyBlue[i * 4 + 0] = 135; // R
    skyBlue[i * 4 + 1] = 206; // G
    skyBlue[i * 4 + 2] = 235; // B
    skyBlue[i * 4 + 3] = 255; // A
  }

  gl.texImage2D(
    gl.TEXTURE_2D,
    0, // mip level
    gl.RGBA, // internal format
    width,
    height,
    0, // border
    gl.RGBA, // format
    gl.UNSIGNED_BYTE, // type
    skyBlue,
  );

  // 필터링 및 래핑 설정 (기본값)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return {
    texture,
    x,
    y,
    width,
    height,
  };
}
