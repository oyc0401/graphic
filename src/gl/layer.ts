import { getManager } from "./utils/cachedManager";
import { TEXTURE_UNIT, getSourceTextureManager, paintOptions } from "./texture";

export function getLayerManager(canvas, gl) {
  const manager = getManager(gl, "layer", () => makeLayerManager(canvas, gl));
  return manager;
}

function makeLayerManager(canvas, gl) {
  let layerTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
  gl.bindTexture(gl.TEXTURE_2D, layerTex);

  // 축소 되었을 떄는 리니어 보간
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

  let layerTex2 = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
  gl.bindTexture(gl.TEXTURE_2D, layerTex2);

  // 축소 되었을 떄는 리니어 보간
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

  // 처음 레이어 ㄱㄱ
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
  gl.bindTexture(gl.TEXTURE_2D, layerTex);

  // 레이어 모음 구현
  let layerArray = [layerTex, layerTex2];

  function setLayerId(newLayerId) {
    paintOptions.layerId = newLayerId;
    let currentLayerTex = layerArray[paintOptions.layerId];

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
    gl.bindTexture(gl.TEXTURE_2D, currentLayerTex);

    gl.bindFramebuffer(gl.FRAMEBUFFER, layerFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      currentLayerTex,
      0,
    );

    const sourceTextureManager = getSourceTextureManager(canvas, gl);
    sourceTextureManager.uploadCurrent();
  }

  function bindCurrentLayer() {
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
    gl.bindTexture(gl.TEXTURE_2D, layerArray[paintOptions.layerId]);
  }

  function addLayer(newLayerId) {
    let newLayerTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
    gl.bindTexture(gl.TEXTURE_2D, layerTex);

    // 축소 되었을 떄는 리니어 보간
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

    
  }
  return {
    layerFBO,
    setLayerId,
    layerArray,
    bindCurrentLayer,
  };
}
