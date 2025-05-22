import { getManager } from "./utils/cachedManager";
import { TEXTURE_UNIT, getSourceTextureManager, paintOptions } from "./texture";
import { getRenderingManager } from "./render";
import { Rect } from "./utils/dirtyRect";

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
    null
  );

  let layerFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, layerFBO);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    layerTex,
    0
  );
  layerTex.id = 0;

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
    null
  );
  layerTex2.id = 1;

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
    console.log("setLayerId:", currentLayerTex.id);
    gl.bindFramebuffer(gl.FRAMEBUFFER, layerFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      currentLayerTex,
      0
    );

    const sourceTextureManager = getSourceTextureManager(canvas, gl);
    sourceTextureManager.upload(0, 0, paintOptions.width, paintOptions.height);
    const renderingManager = getRenderingManager(canvas, gl);
    renderingManager.render();
  }

  function bindCurrentLayer() {
    let currentLayerTex = layerArray[paintOptions.layerId];

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
    gl.bindTexture(gl.TEXTURE_2D, currentLayerTex);
    //console.log("현재 bindCurrentLayer:", paintOptions.layerId);
  }

  function getLayerTex(layerId) {
    if (layerId == 1) {
      return layerTex2;
    }
    return layerTex;
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
      null
    );
  }
  return {
    layerFBO,
    setLayerId,
    layerArray,
    bindCurrentLayer,
    getLayerTex,
  };
}

const d = {};
export function getBitmapManager(
  a: OffscreenCanvas | number = 1,
  b: WebGL2RenderingContext | number = 2
) {
  const manager = getManager(d, "bitmap", () => new BitmapManager());
  return manager;
}

class BitmapManager {
  bitmap: Uint8ClampedArray;
  width: number;
  height: number;

  initState(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.bitmap = new Uint8ClampedArray(width * height * 4);
  }

  copyDirtRect(rect: Rect): Uint8Array {
    const { x, y, width, height } = rect;

    const output = new Uint8Array(width * height * 4);

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const srcIndex = ((y + row) * this.width + (x + col)) * 4;
        const dstIndex = (row * width + col) * 4;

        output[dstIndex] = this.bitmap[srcIndex]; // R
        output[dstIndex + 1] = this.bitmap[srcIndex + 1]; // G
        output[dstIndex + 2] = this.bitmap[srcIndex + 2]; // B
        output[dstIndex + 3] = this.bitmap[srcIndex + 3]; // A
      }
    }
    console.log(output);
    return output;
  }

  applyDirtyRect(image: Uint8Array, rect: Rect): void {
    const { x, y, width, height } = rect;

    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const dstIndex = ((y + row) * this.width + (x + col)) * 4;
        const srcIndex = (row * width + col) * 4;

        this.bitmap[dstIndex] = image[srcIndex]; // R
        this.bitmap[dstIndex + 1] = image[srcIndex + 1]; // G
        this.bitmap[dstIndex + 2] = image[srcIndex + 2]; // B
        this.bitmap[dstIndex + 3] = image[srcIndex + 3]; // A
      }
    }
  }
}
