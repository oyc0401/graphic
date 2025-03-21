let layerData;

function saveLayer(layerId, layer) {
  layerData = layer;
}
function getLayer(layerId) {
  return layerData;
}

interface Pointer {
  x: number;
  y: number;
}

export const workerApi = {
  /**
   * 새로운 레이어를 만듭니다.
   */
  async initState(
    canvas: OffscreenCanvas,
    width: number,
    height: number,
    screenWidth: number,
    screenHeight: number,
  ) {
    console.log('새로운 시작!')
  },

  resetLayer() {
    selection = null;
    layers = {};
  },

  setStrokeColor(layerId, r, g, b) {
    const layer = getLayer(layerId);
    layer.setStrokeColor(r, g, b);
  },

  setStrokeSize(layerId, size) {
    const layer = getLayer(layerId);
    let radius = (size - 1) / 2 + 1; // 거리기반으로 하다보니 내부 로직 결과가 이렇게 됌..
    layer.setStrokeSize(radius);
  },
  setAlpha(layerId, alpha) {
    const layer = getLayer(layerId);
    layer.setAlpha(alpha);
  },

  drawStart(layerId: string, pointer: Pointer) {
    //console.log(pointer)
    const layer = getLayer(layerId);
    layer.drawStart(pointer);
  },

  drawTo(layerId: string, pointer: Pointer) {
    const layer = getLayer(layerId);
    layer.drawTo(pointer);
  },
  drawEnd(layerId: string) {
    const layer = getLayer(layerId);
    layer.drawEnd();
  },

  eraserStart(layerId: string, pointer: Pointer) {
    const layer = getLayer(layerId);
    layer.eraserStart(pointer);
  },

  eraserTo(layerId: string, pointer: Pointer) {
    const layer = getLayer(layerId);
    layer.eraserTo(pointer);
  },
  eraserEnd(layerId: string) {
    const layer = getLayer(layerId);
    layer.drawEnd();
  },

  liquifyStart(layerId: string, pointer: Pointer) {
    const layer = getLayer(layerId);
    layer.liquifyStart(pointer);
  },
  liquifyTo(layerId: string, pointer: Pointer) {
    const layer = getLayer(layerId);
    layer.liquifyTo(pointer);
  },
  liquifyCancel(layerId: string) {
    const layer = getLayer(layerId);
    layer.liquifyCancel();
  },
  liquifyEnd(layerId: string) {
    const layer = getLayer(layerId);
    layer.liquifyEnd();
  },
  liquifyReset(layerId: string) {
    const layer = getLayer(layerId);
    layer.liquifyReset();
  },

  strokeEnd() {
    // 히스토리에 하나 추가하기!
  },

  cancel(layerId) {
    // 그리기 전 (현재) 히스토리로 돌아간다.
    const layer = getLayer(layerId);
    layer.cancel();
  },
};
