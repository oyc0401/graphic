import {
  TEXTURE_UNIT,
  getSourceTextureManager,
  paintOptions,
} from "./texture";
import {getLayerManager} from './layer'
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

  uniform vec2 u_resolution;
  uniform vec2 u_pos;
  uniform vec2 u_screenSize;
  uniform float u_magnification;
  uniform float u_dpr;

  void main() {
    vec2 scaledScreenSize = u_screenSize / u_magnification;
    vec2 ratio = u_resolution / scaledScreenSize;

    float left = u_pos.x / scaledScreenSize.x;
    float top = u_pos.y / scaledScreenSize.y;
    float bottom = (scaledScreenSize.y - u_resolution.y) / scaledScreenSize.y - top;
    
    if (left < v_texCoord.x && v_texCoord.x < left + ratio.x &&
        bottom < v_texCoord.y && v_texCoord.y < bottom + ratio.y) {
        vec3 rgb = vec3(0.0, 0.0, 0.0);
        float alpha = 0.04;
       // outColor = vec4(rgb * alpha, alpha);
       outColor = vec4(1.0 ,1.0 ,1.0 ,1.0);
      return;
    }

    outColor = vec4(0.0, 0.0, 0.0, 0.0); // 외곽 배경
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

      uniform sampler2D u_sourse;  // 원본 텍스처

      in vec2 v_texCoord;
      out vec4 outColor;
      uniform vec2 u_resolution;
      uniform vec2 u_pos;
      uniform vec2 u_screenSize;
      uniform float u_magnification;

      void main() {

        vec2 scaledScreenSize = u_screenSize / u_magnification;
        vec2 ratio =  u_resolution / scaledScreenSize;

        float left = u_pos.x / scaledScreenSize.x;
        float top = u_pos.y / scaledScreenSize.y;
        float bottom = (scaledScreenSize.y - u_resolution.y) / scaledScreenSize.y  - top;

        if( left < v_texCoord.x && v_texCoord.x < left + ratio.x
          && bottom < v_texCoord.y && v_texCoord.y < bottom + ratio.y){

          vec2 target = (v_texCoord - vec2(left, bottom)) / ratio;
          vec4 imageColor = texture(u_sourse, target); // 기존 이미지 색
          outColor = vec4(imageColor.rgb * imageColor.a, imageColor.a);

          return;
        }
        outColor = vec4(0.0, 0.0, 0.0, 0.0);
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

  function render() {
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);
    
    renderDisplay();

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    renderBackground();
    renderTexture();

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
