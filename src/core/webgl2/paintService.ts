import {
  BrushTool,
  EraserTool,
  installTools,
  LiquifyTool as LiquifyStrokeTool,
  MosaicTool as MosaicStrokeTool,
} from "./gl/tool/tool";
import type { ApplyTool } from "./gl/tool/tool";
import { paintOptions } from "./gl/texture";
import { getRenderingManager } from "./gl/render/render";
import { resizeLayer, resizeScreen } from "./gl/resize";
import { getSelectionManager } from "./gl/select/selection";
import { getLayerManager } from "./gl/layer";
import {
  getCanvasPixelManager,
  resetImage,
  uploadImage,
  uploadInitialImage,
} from "./gl/file";
import { getHistoryManager } from "../history/history";
import { Callink } from "callink";
import init, { do_task } from "../wasm/pkg/wasm_tasks.js";
import { getBitmapManager } from "../canvas/bitmap";
import type { CoreSessionTool, CoreTool, LiquifyTool, MosaicMode } from "../types";
import { getSessionManager } from "./session/session";
import { getLiquifyManager } from "./gl/tool/liquify/liquify";
import { getMosaicManager } from "./gl/tool/mosaic/mosaic";

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
    let liquifyTool = new LiquifyStrokeTool(this.canvas, this.gl);
    let mosaicTool = new MosaicStrokeTool(this.canvas, this.gl);

    this.tools = {
      brush: brushTool,
      eraser: eraserTool,
      liquify: liquifyTool,
      mosaic: mosaicTool,
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
    // 레이어 바꾸기 전에 진행 중인 세션을 먼저 적용한다.
    const sessionManager = getSessionManager(this.canvas, this.gl);
    if (sessionManager.hasActiveSession()) {
      sessionManager.commitSession();
    }

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
  sampleColor(x: number, y: number) {
    const layerManager = getLayerManager(this.canvas, this.gl);
    const gl = this.gl;
    const px = Math.max(0, Math.min(paintOptions.width - 1, Math.floor(x)));
    const py = Math.max(0, Math.min(paintOptions.height - 1, Math.floor(y)));
    const pixel = new Uint8Array(4);
    const previousReadFramebuffer = gl.getParameter(
      gl.READ_FRAMEBUFFER_BINDING,
    );

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, layerManager.layerFBO);
    gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previousReadFramebuffer);

    const alpha = pixel[3];
    return {
      r: Math.min(255, pixel[0] + 255 - alpha),
      g: Math.min(255, pixel[1] + 255 - alpha),
      b: Math.min(255, pixel[2] + 255 - alpha),
    };
  }
  setTool(toolId: CoreTool): void {
    if (paintOptions.toolId != toolId) {
      const sessionManager = getSessionManager(this.canvas, this.gl);
      if (sessionManager.hasActiveSession()) {
        sessionManager.commitSession();
      }
      paintOptions.toolId = toolId;
    }
    paintOptions.toolId = toolId;
  }

  openSession(toolId: CoreSessionTool) {
    const sessionManager = getSessionManager(this.canvas, this.gl);
    if (sessionManager.hasActiveSession()) {
      sessionManager.commitSession();
    }

    if (toolId === "liquify") {
      paintOptions.toolId = toolId;
      sessionManager.startLiquifySession();
      return;
    }

    if (toolId === "mosaic") {
      paintOptions.toolId = toolId;
      sessionManager.startMosaicSession();
      return;
    }
  }
  setLiquifyTool(toolId: LiquifyTool): void {
    getLiquifyManager(this.canvas, this.gl).setTool(toolId);
  }
  setMosaicMode(mode: MosaicMode): void {
    const mosaicManager = getMosaicManager(this.canvas, this.gl);
    mosaicManager.setMode(mode);
    mosaicManager.end();
  }
  setMosaicStrength(strength: number): void {
    getMosaicManager(this.canvas, this.gl).setStrength(strength);
  }
  commitSession() {
    getSessionManager(this.canvas, this.gl).commitSession();
  }
  discardSession() {
    getSessionManager(this.canvas, this.gl).discardSession();
  }
  getTool() {
    return this.tools[paintOptions.toolId];
  }
  start(pointer: Pointer) {
    this.getTool()?.start(pointer);
    this.lastPointer = pointer;
  }
  strokeTo(pointer: Pointer) {
    this.getTool()?.stroke(this.lastPointer, pointer);
    this.lastPointer = pointer;
  }
  apply(pointer: Pointer) {
    const tool = this.getTool() as ApplyTool;
    tool.apply(pointer);
  }
  end() {
    this.getTool()?.end();
  }
  cancel() {
    this.getTool()?.cancel();
  }
  createSelection(x, y, width, height) {
    let selectionManager = getSelectionManager(this.canvas, this.gl);
    selectionManager.select(x, y, width, height);
  }
  completeTransformSelection() {
    let selectionManager = getSelectionManager(this.canvas, this.gl);
    selectionManager.endSelection();
  }
  transformSelection(x, y, width, height, flipH = false, flipV = false) {
    let selectionManager = getSelectionManager(this.canvas, this.gl);
    selectionManager.moveSelection(x, y, width, height, flipH, flipV);
  }
  commitSelection() {
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
  deleteSelection() {
    paintOptions.showSelection = false;
    const renderingManager = getRenderingManager(this.canvas, this.gl);
    renderingManager.render();
  }
  uploadImage(imageBitmap: ImageBitmap) {
    return uploadImage(this.canvas, this.gl, imageBitmap);
  }
  uploadInitialImage(imageBitmap: ImageBitmap) {
    return uploadInitialImage(this.canvas, this.gl, imageBitmap);
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
    const sessionManager = getSessionManager(this.canvas, this.gl);
    if (sessionManager.hasActiveSession()) {
      return sessionManager.undo();
    }

    let historyManager = getHistoryManager(this.canvas, this.gl);
    return historyManager.undo();
  }
  redo() {
    const sessionManager = getSessionManager(this.canvas, this.gl);
    if (sessionManager.hasActiveSession()) {
      return sessionManager.redo();
    }

    let historyManager = getHistoryManager(this.canvas, this.gl);
    return historyManager.redo();
  }
  getHistoryCount() {
    const sessionHistoryCount = getSessionManager(
      this.canvas,
      this.gl,
    ).getHistoryCount();
    if (sessionHistoryCount) {
      return sessionHistoryCount;
    }

    let historyManager = getHistoryManager(this.canvas, this.gl);
    return historyManager.getHistoryCount();
  }
}
