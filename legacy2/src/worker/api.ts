import { PaintLayer } from "./paintLayer";
import { cut_out_background } from "./imageHelper";

// DB
let layers: { [key: string]: PaintLayer } = {};

function saveLayer(layerId, layer) {
  layers[layerId] = layer;
}
function getLayer(layerId) {
  return layers[layerId];
}

let selection: {
  layerId: string;
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  // source: OffscreenCanvas;
  // source_ctx: OffscreenCanvasRenderingContext2D;
} = null;

interface Pointer {
  x: number;
  y: number;
}

export const workerApi = {
  /**
   * 새로운 레이어를 만듭니다.
   */
  async makeLayer(
    layerId: string,
    name: string,
    main_canvas: OffscreenCanvas,
    width: number,
    height: number,
    priority: number,
    canvasWidth,
    canvasHeight,
  ) {
    const layer = new PaintLayer(
      layerId,
      name,
      main_canvas,
      width,
      height,
      priority,
      canvasWidth,
      canvasHeight,
    );

    saveLayer(layerId, layer);

    console.log("layers:", layers, width, height);
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

  updateSize(width, height) {
    console.log("[worker] size:", width, height);

    for (const layer of Object.values(layers)) {
      layer.setSize(width, height);
    }

    console.log("webgl 이후여야함!");
  },

  makeSelection(layerId, canvas, width, height, imageData) {
    selection = {
      layerId,
      canvas,
      ctx: canvas.getContext("2d"),
    };

    //let source = new OffscreenCanvas(width, height);
    // let source_ctx = source.getContext("2d");
    //selection.source = source;
    //selection.source_ctx = source_ctx;

    if (imageData) {
      console.log(imageData);
      selection.ctx.putImageData(imageData, 0, 0);
      //source_ctx.putImageData(imageData, 0, 0);
    } else {
      selection.ctx.fillStyle = "blue";
      selection.ctx.fillRect(0, 0, width, height);
      //source_ctx.drawImage(layer.main_canvas, 0, 0);
    }
  },
  cut_out_background(layerId, x, y, width, height) {
    let view_canvas = selection.canvas;
    let view_ctx = selection.ctx;
    const layer = getLayer(layerId);

    cut_out_background(
      view_canvas,
      view_ctx,
      layer.main_canvas,
      layer.main_gl,
      x,
      y,
      width,
      height,
    );
  },
  unselect(layerId, x, y, width, height) {
    const layer = getLayer(layerId);
    layer.main_gl.drawImage(selection.canvas, x, y, width, height);
    selection = null;
  },

  updateSelectionInfo(layerId, x, y) {
    //selection.x = x;
  },

  saveFile(paintId: string) {
    //saveFileImmediately(paintId);
  },
};
