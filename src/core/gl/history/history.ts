import { getSourceTextureManager, paintOptions } from "../texture";
import { getManager } from "../utils/cachedManager";
import { DirtyRect } from "../utils/dirtyRect";
import { PixelReadProcessor } from "./pixelReadProcessor";
import { PixelReader } from "./PixelReader";

export interface HistoryItem {
  layerId: number;
  tool: string;
  rect: DirtyRect;
  pixelReader: PixelReader;
}
let undoStack: HistoryItem[] = [];
let redoStack: HistoryItem[] = [];

export function getHistoryManager(canvas, gl) {
  const manager = getManager(gl, "history", () =>
    createHistoryManager(canvas, gl),
  );
  return manager;
}

function createHistoryManager(canvas, gl) {
  // 2. FBO 설정
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

  const readPixelQueue = new PixelReadProcessor(gl);
  async function addUndo(
    historyType,
    historyTex,
    x,
    y,
    width,
    height,
    resetRedo = true,
  ) {
    const { layerId } = paintOptions;

    let pixelReader = new PixelReader(gl, width, height, historyTex);
    const newHistory = {
      layerId,
      tool: historyType,
      rect: DirtyRect.fromWidth(x, y, width, height),
      pixelReader,
    };
    undoStack.push(newHistory);

    readPixelQueue.push(pixelReader);
    readPixelQueue.excute();

    if (resetRedo && redoStack.length != 0) {
      // 이때 큐에 다 못들어간 히스토리가 남아있지 않게
      // 히스토리에 객체 먼저 넣고 readPixel 큐잉 하기
      // 객체 안에서 readPixel하게!
      redoStack = [];
      console.log("undo:", undoStack.length, "redo:", redoStack.length);
    }
  }

  async function addRedo(historyType, historyTex, x, y, width, height) {
    const { layerId } = paintOptions;

    console.log("addRedo readPixels", width, height);

    let pixelReader = new PixelReader(gl, width, height, historyTex);

    const newHistory = {
      layerId,
      tool: historyType,
      rect: DirtyRect.fromWidth(x, y, width, height),
      pixelReader,
    };
    redoStack.push(newHistory);

    readPixelQueue.push(pixelReader);
    readPixelQueue.excute();
  }

  function undo() {
    if (undoStack.length == 0) return;

    let history = undoStack[undoStack.length - 1];
    let redoTex;
    if (history.tool == "source") {
      let sourceManager = getSourceTextureManager(canvas, gl);
      redoTex = sourceManager.applyHistory(history);
    }

    undoStack.pop();

    let { x, y, width, height } = history.rect;
    addRedo(history.tool, redoTex, x, y, width, height);

    console.log("undo:", undoStack.length, "redo:", redoStack.length);
  }

  function redo() {
    if (redoStack.length == 0) return;

    let history = redoStack[redoStack.length - 1];
    let undoTex;
    if (history.tool == "source") {
      let sourceManager = getSourceTextureManager(canvas, gl);
      undoTex = sourceManager.applyHistory(history);
    }

    redoStack.pop();
    let { x, y, width, height } = history.rect;
    addUndo(history.tool, undoTex, x, y, width, height, false);

    console.log("undo:", undoStack.length, "redo:", redoStack.length);
  }
  return {
    addUndo,
    undo,
    redo,
  };
}
