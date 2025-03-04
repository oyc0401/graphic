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
  async makeLayer(
    layerId: string,
    name: string,
    main_canvas: OffscreenCanvas,
    draw_canvas: OffscreenCanvas,
    width: number,
    height: number,
    priority: number,
    background?: string,
    dataBlob?: Blob,
  ) {
    const layer = new PaintLayer(
      layerId,
      name,
      main_canvas,
      draw_canvas,
      width,
      height,
      priority,
      background,
      dataBlob,
    );

    saveLayer(layerId, layer);

    console.log("layers:", layers, width, height);
  },

  resetLayer() {
    selection = null;
    layers = {};
  },

  paintStart(layerId: string, pointer: Pointer, color, size: number, tool) {
    const layer = getLayer(layerId);
    layer.drawStart(pointer, color, size, tool);
  },

  paint(layerId: string, pointer: Pointer, color, size: number) {
    const layer = getLayer(layerId);
    layer.pushDrawPointer(pointer, color, size); // 도구의 종류는 포인터 시작할 때 정해짐
    layer.paint();
  },

  pointerUp(layerId: string) {
    const layer = getLayer(layerId);
    layer.pointerUp();
  },

  eraserStart(layerId: string, pointer: Pointer, width: number, tool) {
    requestAnimationFrame(() => {
      setTimeout(() => {
        const layer = getLayer(layerId);
        layer.eraserStart(pointer, width, tool);
      }, 0);
    });
  },
  eraser(layerId: string, pointer: Pointer, size: number) {
    requestAnimationFrame(() => {
      setTimeout(() => {
        const layer = getLayer(layerId);
        layer.pushDrawPointer(pointer, "white", size);
        layer.eraser();
      }, 0);
    });
  },

  eraserUp(layerId: string) {
    requestAnimationFrame(() => {
      setTimeout(() => {
        const layer = getLayer(layerId);
        layer.eraserUp();
      }, 0);
    });
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
      const ctx = layer.main_ctx;

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
      layer.main_ctx,
      x,
      y,
      width,
      height,
    );
  },
  unselect(layerId, x, y, width, height) {
    const layer = getLayer(layerId);
    layer.main_ctx.drawImage(selection.canvas, x, y, width, height);
    selection = null;
  },

  updateSelectionInfo(layerId, x, y) {
    //selection.x = x;
  },

  saveFile(paintId: string) {
    saveFileImmediately(paintId);
  },
};

async function saveFileImmediately(paintId: string) {
  try {
    // 2) 레이어 메타데이터 저장
    const layerList = [];

    let sortedLayers = Object.values(layers).sort(
      (a, b) => a.priority - b.priority,
    );

    for (const layer of sortedLayers) {
      if (selection && selection.layerId == layer.id) {
        // 기존 canvas와 동일한 크기의 새로운 canvas 생성
        const temp_canvas = new OffscreenCanvas(layer.width, layer.height);

        // 기존 canvas의 내용을 복사
        const temp_ctx = temp_canvas.getContext("2d");
        temp_ctx.drawImage(layer.main_canvas, 0, 0);

        temp_ctx.drawImage(selection.canvas, selection.x, selection.y);

        layerList.push({
          layerId: layer.id,
          name: layer.name,
          paintId: paintId,
          dataBlob: await toBlobAsync(temp_canvas),
          priority: layer.priority,
          background: layer.background,
        });
      } else {
        layerList.push({
          layerId: layer.id,
          name: layer.name,
          paintId: paintId,
          dataBlob: await toBlobAsync(layer.main_canvas),
          priority: layer.priority,
          background: layer.background,
        });
      }
    }

    console.log(layerList);
    //await layerRepository.setLayers(paintId, layerList);

    // //PaintJSState.layerStore = [];
    // for (let layerObj of layerList) {
    //   let { layerId, dataBlob } = layerObj;
    //   const url = URL.createObjectURL(dataBlob);
    //   PaintJSState.layerStore[layerId].imageUrl = url;
    // }

    // const now = new Date();
    // PaintMobXState.lastChanged = now.getTime();

    console.warn("Paint saved. paintId =", paintId);
  } catch (error) {
    console.error(
      "An unexpected error occurred in saveFileImmediately:",
      error,
    );
  }
}

async function toBlobAsync(
  offscreenCanvas: OffscreenCanvas,
  type = "image/png",
  quality?: number,
) {
  const options = {
    type,
    quality,
  };

  return offscreenCanvas.convertToBlob(options).catch((error) => {
    throw new Error(
      "Failed to create Blob from OffscreenCanvas: " + error.message,
    );
  });
}
