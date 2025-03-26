import {
  TEXTURE_UNIT,
  getSourceTextureManager,
  paintOptions,
  getOffscreenManager,
} from "./texture";
import { getLiquifyManager } from "./tool/liquify";

import { getBrushManager } from "./tool/brushTool";

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
    let liquifyManager = await getLiquifyManager(canvas, gl);

    drawManager.setSize();
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
