/// <reference lib="webworker" />

import {
  BrushTool,
  EraserTool,
  installTools,
  LiquifyTool,
} from "../gl/tool/tool";
import { paintOptions } from "../gl/texture";
import {
  getRenderingManager,
  resizeLayer,
  resizeScreen,
} from "../gl/render";
import { getSelectionManager } from "../gl/selection";
interface Pointer {
  x: number;
  y: number;
}

export class PaintService {
  canvas: OffscreenCanvas;
  gl: WebGL2RenderingContext;

  toolId: string;
  tools: any;
  lastPointer: Pointer;

  constructor(canvas: OffscreenCanvas) {
    this.canvas = canvas;
    let gl = canvas.getContext("webgl2", {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: true,
      premultipliedAlpha: true,
    });
    if (!gl) {
      throw Error("Can't make webgl2 context");
    }
    this.gl = gl;
    this.toolId = "brush";
    //paintOptions.dpr = dpr;

    this.init();
  }
  async init() {
    await this.installTools();
    console.log("Making Layer Complete!");
  }

  async installTools() {
    await installTools(this.canvas, this.gl);

    let brushTool = new BrushTool(this.canvas, this.gl);
    let eraserTool = new EraserTool(this.canvas, this.gl);
    let liquifyTool = new LiquifyTool(this.canvas, this.gl);

    this.tools = {
      brush: brushTool,
      eraser: eraserTool,
      liquify: liquifyTool,
    };
  }

  setCameraPosition(x, y, magnification) {
    paintOptions.x = x;
    paintOptions.y = y;
    paintOptions.magnification = magnification;
  }
  resizeLayer(width, height) {
    resizeLayer(this.canvas, this.gl, width, height);
  }
  resizeScreen(screenWidth, screenHeight) {
    resizeScreen(this.canvas, this.gl, screenWidth, screenHeight);
  }
  render() {
    const renderingManager = getRenderingManager(this.canvas, this.gl);
    renderingManager.render();
  }

  setStrokeColor(r, g, b) {
    paintOptions.setColor({ r, g, b });
  }

  setStrokeSize(strokeSize) {
    let radius = strokeSize / 2; // 거리기반으로 하다보니 내부 로직 결과가 이렇게 됌..
    paintOptions.setRadius(radius);
  }

  setAlpha(alpha) {
    paintOptions.setAlpha(alpha);
  }
  setTool(toolId) {
    if (toolId == "select") return;
    if (this.toolId != toolId) {
      this.getTool().exit();
    }
    this.toolId = toolId;
    this.getTool().enter();
  }
  getTool() {
    return this.tools[this.toolId];
  }
  start(pointer: Pointer) {
    this.getTool().start(pointer);
    this.lastPointer = pointer;
  }
  strokeTo(pointer: Pointer) {
    this.getTool().stroke(this.lastPointer, pointer);
    this.lastPointer = pointer;
  }
  end() {
    this.getTool().end();
  }
  cancel() {
    this.getTool().cancel();
  }
  select(x, y, width, height) {
    let selectionManager = getSelectionManager(this.canvas, this.gl);
    selectionManager.select(x, y, width, height);
  }
  moveSelection(x, y, width, height) {
    let selectionManager = getSelectionManager(this.canvas, this.gl);
    selectionManager.setSize(x, y, width, height);
  }
  applySelection() {
    if (paintOptions.showSelection) {
      let selectionManager = getSelectionManager(this.canvas, this.gl);
      selectionManager.applySelection();
    }
  }
  paste(x, y, width, height, imageBitmap) {
    let selectionManager = getSelectionManager(this.canvas, this.gl);
    selectionManager.paste(x, y, width, height, imageBitmap);
  }
  copy() {
    // 선택 된 이미지를 다운로드 해서 클립보드로 저장.
    let selectionManager = getSelectionManager(this.canvas, this.gl);
    let { pixels, width, height } = selectionManager.getPixelData();

    self.postMessage(
      {
        type: "copy",
        payload: {
          pixels,
          width,
          height,
        },
      },
      [pixels.buffer],
    );
  }
  cut() {
    // 선택 된 이미지를 다운로드 해서 클립보드로 저장.
    let selectionManager = getSelectionManager(this.canvas, this.gl);
    let { pixels, width, height } = selectionManager.getPixelData();

    selectionManager.afterCut();

    self.postMessage(
      {
        type: "copy",
        payload: {
          pixels,
          width,
          height,
        },
      },
      [pixels.buffer],
    );
  }
}
