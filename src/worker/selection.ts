import { TEXTURE_UNIT } from "./texture";
import { getManager } from "./cachedManager";

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

  function applySelection() {}
  return {
    texture,
    x,
    y,
    width,
    height,
  };
}
