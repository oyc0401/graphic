import { getLayerManager } from "./layer";
import { getSourceTextureManager, paintOptions, TEXTURE_UNIT } from "./texture";
import { getManager } from "./utils/cachedManager";

export function getSelectionManager(canvas, gl) {
  const manager = getManager(gl, "selection", () =>
    createSelectionManager(canvas, gl),
  );
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
  let width = 300;
  let height = 200;

  // 초기 데이터(하늘색)로 채운다 (RGBA: (135,206,235,255))
  const pixelCount = width * height;
  const skyBlue = new Uint8Array(pixelCount * 4); // RGBA 4채널

  for (let i = 0; i < pixelCount; i++) {
    const isTopHalf = i < pixelCount / 2;

    if (isTopHalf) {
      // 자홍색: RGB(255, 0, 255)
      skyBlue[i * 4 + 0] = 255; // R
      skyBlue[i * 4 + 1] = 0; // G
      skyBlue[i * 4 + 2] = 255; // B
      skyBlue[i * 4 + 3] = 255; // A
    } else {
      // 하늘색: RGB(135, 206, 235)
      skyBlue[i * 4 + 0] = 135; // R
      skyBlue[i * 4 + 1] = 206; // G
      skyBlue[i * 4 + 2] = 235; // B
      skyBlue[i * 4 + 3] = 255; // A
    }
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

  // 1) selection 텍스처를 붙일 FBO 생성
  const selectionFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, selectionFBO);

  // selection 텍스처를 color attachment로 연결
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0,
  );

  let layerManager = getLayerManager(canvas, gl);
  const sourceTextureManager = getSourceTextureManager(canvas, gl);

  // 3) 부분 복사(blit) 함수
  function applySelection() {
    // (a) selectionFBO → READ_FRAMEBUFFER
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, selectionFBO);

    // (b) layerFBO → DRAW_FRAMEBUFFER
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, layerManager.layerFBO);

    // (c) 실제 blitFramebuffer 호출
    //   src: (0, 0) ~ (width, height)
    //   dst: (x, y) ~ (x+width, y+height)
    //   mask: COLOR_BUFFER_BIT
    //   filter: NEAREST
    gl.blitFramebuffer(
      0,
      0,
      width,
      height, // 복사할 영역 (selectionFBO 내부)
      x,
      paintOptions.height - y - height,
      x + width,
      paintOptions.height - y, // 복사 대상 (layerFBO 내부)
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );

    sourceTextureManager.uploadCurrent();
  }
  return {
    texture,
    x,
    y,
    width,
    height,
    applySelection,
  };
}
