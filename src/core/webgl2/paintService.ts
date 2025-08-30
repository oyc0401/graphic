import {
  BrushTool,
  EraserTool,
  installTools,
  LiquifyTool,
} from "./gl/tool/tool";
import { paintOptions } from "./gl/texture";
import { getRenderingManager } from "./gl/render";
import { resizeLayer, resizeScreen } from "./gl/resize";
import { getSelectionManager } from "./gl/selection";
import { getLayerManager } from "./gl/layer";
import { getCanvasPixelManager, resetImage, uploadImage } from "./gl/file";
import { getHistoryManager } from "./gl/history/history";
import { Callink } from "callink";
import init, { do_task } from "../wasm/pkg/wasm_tasks.js";
import { getBitmapManager } from "../canvas/bitmap";

interface Pointer {
  x: number;
  y: number;
}

export class PaintService {
  canvas: OffscreenCanvas;
  gl: WebGL2RenderingContext;

  tools: any;
  lastPointer: Pointer;

  constructor(canvas: OffscreenCanvas) {
    this.canvas = canvas;
    let gl = canvas.getContext("webgl2", {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: false,
      premultipliedAlpha: true,
    });
    if (!gl) {
      throw Error("Can't make webgl2 context");
    }
    this.gl = gl;
    paintOptions.toolId = "brush";
  }

  async initialize() {
    await this.installTools();

    const bitmapManager = getBitmapManager();
    bitmapManager.initState(paintOptions.width, paintOptions.height);

    const renderingManager = getRenderingManager(this.canvas, this.gl);
    renderingManager.render();

    // await init(); // .wasm 로딩 및 초기화
    // do_task(4000 * 4000 * 4); // 실행

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
  resizeLayer(x, y, width, height) {
    resizeLayer(this.canvas, this.gl, x, y, width, height);
  }
  resizeScreen(screenWidth, screenHeight) {
    resizeScreen(this.canvas, this.gl, screenWidth, screenHeight);
  }
  render() {
    const renderingManager = getRenderingManager(this.canvas, this.gl);
    renderingManager.render();
  }
  setLayerId(layerId) {
    // 레이어 바꾸기 전에 무조건 툴, 선택창 종료하기!
    this.getTool().exit();
    this.getTool().enter();

    let layerManager = getLayerManager(this.canvas, this.gl);
    layerManager.setLayerId(layerId);
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
  setTool(toolId, doExit) {
    if (paintOptions.toolId != toolId && doExit) {
      this.getTool()?.exit();
      paintOptions.toolId = toolId;
      this.getTool()?.enter();
    }
    paintOptions.toolId = toolId;
    if (toolId == "select") return;
  }
  getTool() {
    return this.tools[paintOptions.toolId];
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
  endMove() {
    let selectionManager = getSelectionManager(this.canvas, this.gl);
    selectionManager.endMove();
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
  getSelectionPixel() {
    let selectionManager = getSelectionManager(this.canvas, this.gl);
    let { pixels, width, height } = selectionManager.getPixelData();

    return { pixels, width, height };
  }
  cut() {
    // 선택 된 이미지를 다운로드 해서 클립보드로 저장.
    let selectionManager = getSelectionManager(this.canvas, this.gl);
    let { pixels, width, height } = selectionManager.getPixelData();

    selectionManager.afterCut();
    return { pixels, width, height };
  }
  selectionDelete() {
    paintOptions.showSelection = false;
    const renderingManager = getRenderingManager(this.canvas, this.gl);
    renderingManager.render();
  }
  uploadImage(imageBitmap: ImageBitmap) {
    return uploadImage(this.canvas, this.gl, imageBitmap);
  }
  resetImage(width, height) {
    return resetImage(this.canvas, this.gl, width, height);
  }
  downloadImage() {
    let manager = getCanvasPixelManager(this.canvas, this.gl);
    let { pixels, width, height } = manager.getCanvasPixelData();
    return { pixels, width, height };
  }

  undo() {
    let historyManager = getHistoryManager(this.canvas, this.gl);
    return historyManager.undo();
  }
  redo() {
    let historyManager = getHistoryManager(this.canvas, this.gl);
    return historyManager.redo();
  }
  getHistoryCount() {
    let historyManager = getHistoryManager(this.canvas, this.gl);
    return historyManager.getHistoryCount();
  }
}
