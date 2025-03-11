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
    dataBlob?: Blob,
  ) {
    const layer = new PaintLayer(
      layerId,
      name,
      main_canvas,
      width,
      height,
      priority,
      dataBlob,
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
    layer.setStrokeSize(size);
  },
  setAlpha(layerId, alpha) {
    const layer = getLayer(layerId);
    layer.setAlpha(alpha);
  },

  drawStart(layerId: string, pointer: Pointer) {
    const layer = getLayer(layerId);
    layer.drawStart(pointer);
  },

  drawTo(layerId: string, pointer: Pointer) {
    const layer = getLayer(layerId);
    layer.drawTo(pointer);
  },

  eraserStart(layerId: string, pointer: Pointer) {
    const layer = getLayer(layerId);
    layer.eraserStart(pointer);
  },

  eraserTo(layerId: string, pointer: Pointer) {
    const layer = getLayer(layerId);
    layer.eraserTo(pointer);
  },

  strokeEnd(){
    // 히스토리에 하나 추가하기!
  },

  cancel(layerId){
    // 그리기 전 (현재) 히스토리로 돌아간다. 
    const layer = getLayer(layerId);
    layer.cancel();
  },

  updateSize(width, height, set_canvas_css) {
    console.log("[worker] size:", width, height);
    const firstLayer = Object.values(layers)[0];
    let temp_canvas = new OffscreenCanvas(firstLayer.width, firstLayer.height);
    let temp_ctx = temp_canvas.getContext("2d");

    temp_ctx.globalCompositeOperation = "copy";

    for (const layer of Object.values(layers)) {
      const beforeWidth = layer.width;
      const beforeHeight = layer.height;

      const canvas = layer.main_canvas;
      const ctx = layer.main_gl;

      temp_ctx.drawImage(canvas, 0, 0);

      // 캔버스 초기화
      layer.setSize(width, height);

      if (layer.background) {
        ctx.fillStyle = layer.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.clearRect(0, 0, beforeWidth, beforeHeight);
      }

      // 기존 영역은 기존 그림으로 그리기
      ctx.drawImage(temp_canvas, 0, 0);
    }

    // 캔버스 메모리 할당 해제
    temp_canvas.width = 0;
    temp_canvas.height = 0;
    temp_ctx = null;
    temp_canvas = null;

    requestAnimationFrame(() => {
      set_canvas_css();
    });
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
