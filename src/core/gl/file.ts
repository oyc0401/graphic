import { getLayerManager } from "./layer";
import { getRenderingManager, resizeLayer } from "./render";
import { getSourceTextureManager, paintOptions, TEXTURE_UNIT } from "./texture";

export function uploadImage(canvas, gl, bitmap: ImageBitmap) {
  const sourceTextureManager = getSourceTextureManager(canvas, gl);
  const renderingManager = getRenderingManager(canvas, gl);
  const layerManager = getLayerManager(canvas, gl);

  resizeLayer(
    canvas,
    gl,
    paintOptions.x,
    paintOptions.y,
    bitmap.width,
    bitmap.height,
  );

  layerManager.bindCurrentLayer();

  gl.texImage2D(
    gl.TEXTURE_2D,
    0, // mip level
    gl.RGBA, // internal format
    gl.RGBA, // format
    gl.UNSIGNED_BYTE, // type
    bitmap, // ✅ 직접 전달 가능
  );

  sourceTextureManager.uploadCurrent();

  renderingManager.render();
}

export function resetImage(canvas, gl, width, height) {
  const sourceTextureManager = getSourceTextureManager(canvas, gl);
  const renderingManager = getRenderingManager(canvas, gl);
  const layerManager = getLayerManager(canvas, gl);

  resizeLayer(canvas, gl, paintOptions.x, paintOptions.y, width, height);

  layerManager.bindCurrentLayer();

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,                // mip level
    gl.RGBA,          // internal format
    width,            // ✅ 반드시 필요
    height,           // ✅ 반드시 필요
    0,                // border (항상 0)
    gl.RGBA,          // format
    gl.UNSIGNED_BYTE, // type
    null              // → allocate only
  );

  sourceTextureManager.uploadCurrent();

  renderingManager.render();
}
