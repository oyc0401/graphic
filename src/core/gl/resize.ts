import { TEXTURE_UNIT, getSourceTextureManager, paintOptions } from "./texture";
import { getLayerManager } from "./layer";
import { getLiquifyManager } from "./tool/liquify";
import { getBrushManager } from "./tool/brushTool";
import { getManager } from "./utils/cachedManager";
import { getOffscreenManager } from "./render";

/**
 * 도화지의 크기를 조절함
 */
export function resizeLayer(canvas, gl, x, y, width, height) {
  const resizeTexManager = getResizeLayerTexManager(canvas, gl);
  const sourceTextureManager = getSourceTextureManager(canvas, gl);
  const drawManager = getBrushManager(canvas, gl);
  const liquifyManager = getLiquifyManager(canvas, gl);
  console.log("resizeLayer");

  // 현재 그림은 그대로 둔 상태로 크기만 바꾸기
  resizeTexManager.preserveAndResize(
    x,
    y,
    paintOptions.width,
    paintOptions.height,
    width,
    height,
  );

  paintOptions.width = width;
  paintOptions.height = height;

  sourceTextureManager.setSize();
  sourceTextureManager.uploadCurrent();

  if (!drawManager || !liquifyManager) {
    console.error("지금 도구가 다운되기 전에 사이즈 변경이 일어남!");
  } else {
    drawManager.setSize();
    liquifyManager.setSize();
  }
}

// 화면의 크기를 조절함
export function resizeScreen(canvas, gl, screenWidth, screenHeight) {
  const offscreenManager = getOffscreenManager(canvas, gl);

  console.log("resizeScreen");

  // canvas Element의 크기를 변경
  canvas.width = screenWidth;
  canvas.height = screenHeight;

  paintOptions.screenWidth = screenWidth;
  paintOptions.screenHeight = screenHeight;
  offscreenManager.resize(screenWidth, screenHeight);
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

  const tempTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
  gl.bindTexture(gl.TEXTURE_2D, tempTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  const tempFBO = gl.createFramebuffer();
  const readFBO = gl.createFramebuffer();

  function resize(
    x,
    y,
    oldWidth: number,
    oldHeight: number,
    newWidth: number,
    newHeight: number,
    layerTex,
  ) {
    console.log("resize", oldWidth, oldHeight, newWidth, newHeight);
    // 3. 기존 layerFBO → 임시 텍스처로 복사
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readFBO);
    gl.framebufferTexture2D(
      gl.READ_FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      layerTex,
      0,
    );

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, tempFBO);
    gl.framebufferTexture2D(
      gl.DRAW_FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tempTex,
      0,
    );

    gl.blitFramebuffer(
      0,
      0,
      oldWidth,
      oldHeight,
      0,
      0,
      oldWidth,
      oldHeight,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );

    // 대상 텍스쳐 늘리기
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, layerTex);
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

    // 4. 임시 텍스처 → 레이어 텍스처로 복사
    // 현재 바인딩된 FRAMEBUFFER로부터 픽셀 데이터를 현재 activeTexture에 바인딩된 텍스처에 복사
    gl.bindFramebuffer(gl.FRAMEBUFFER, tempFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tempTex,
      0,
    );
    // 마지막으로 바인딩된건 함수 밖에 있음.
    gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, x, y, newWidth, newHeight);
  }

  function resizeAll(
    x,
    y,
    oldWidth: number,
    oldHeight: number,
    newWidth: number,
    newHeight: number,
  ) {
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, tempTex);
    // temp 크기 설정
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      oldWidth,
      oldHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );

    for (let layerTex of layerManager.layerArray) {
      resize(x, y, oldWidth, oldHeight, newWidth, newHeight, layerTex);
    }

    layerManager.bindCurrentLayer();
  }

  return {
    preserveAndResize: resizeAll,
  };
}
