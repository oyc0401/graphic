import { getManager } from "./utils/cachedManager";
import { TEXTURE_UNIT, paintOptions } from "./texture";

export function getLayerManager(canvas, gl) {
  const manager = getManager(gl, "layer", () => makeLayerManager(canvas, gl));
  return manager;
}

function makeLayerManager(canvas, gl) {
  let layerTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
  gl.bindTexture(gl.TEXTURE_2D, layerTex);

  // 이걸 스케일 업해서 그리려면, 보간이 없어야함.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    paintOptions.width,
    paintOptions.height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );

  let layerFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, layerFBO);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    layerTex,
    0,
  );

  // 빨강으로 초기화
  gl.viewport(0, 0, paintOptions.width, paintOptions.height);
  gl.clearColor(0, 0, 0, 0.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  return {
    layerTex,
    layerFBO,
  };
}
