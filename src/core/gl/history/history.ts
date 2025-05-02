import { getSourceTextureManager, paintOptions } from "../texture";
import { getManager } from "../utils/cachedManager";
import { DirtyRect } from "../utils/dirtyRect";
import { PixelReadProcessor } from "./pixelReadProcessor";
import { PixelReader } from "./PixelReader";
import { mainThread } from "../../worker/mainPool";
import {
  getLiquifyManager,
  getSourceDisplaceMapManager,
} from "../tool/liquify";

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
    createHistoryManager(canvas, gl)
  );
  return manager;
}

function createHistoryManager(canvas, gl) {
  // 2. FBO 설정
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

  const readPixelQueue = new PixelReadProcessor(gl);
  function addUndo(
    historyType,
    historyTex,
    x,
    y,
    width,
    height,
    dataFormat,
    dataType,

    resetRedo = true
  ) {
    const { layerId } = paintOptions;

    console.log("addUndo readPixels", width, height);

    let pixelReader = new PixelReader(
      gl,
      width,
      height,
      historyTex,
      dataFormat,
      dataType
    );
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
    }

    mainThread.historyCount(undoStack.length, redoStack.length);

    console.log("undo:", undoStack.length, "redo:", redoStack.length);
  }

  function addRedo(
    historyType,
    historyTex,
    x,
    y,
    width,
    height,
    dataFormat,
    dataType
  ) {
    const { layerId } = paintOptions;

    console.log("addRedo readPixels", width, height);

    let pixelReader = new PixelReader(
      gl,
      width,
      height,
      historyTex,
      dataFormat,
      dataType
    );

    const newHistory = {
      layerId,
      tool: historyType,
      rect: DirtyRect.fromWidth(x, y, width, height),
      pixelReader,
    };
    redoStack.push(newHistory);

    readPixelQueue.push(pixelReader);
    readPixelQueue.excute();

    mainThread.historyCount(undoStack.length, redoStack.length);
    console.log("undo:", undoStack.length, "redo:", redoStack.length);
  }

  function undo() {
    if (undoStack.length == 0) return;

    let history = undoStack[undoStack.length - 1];
    let redoTex;
    if (history.tool == "source") {
      let sourceManager = getSourceTextureManager(canvas, gl);
      redoTex = sourceManager.applyHistory(history);
      let { x, y, width, height } = history.rect;
      addRedo(
        history.tool,
        redoTex,
        x,
        y,
        width,
        height,
        gl.RGBA,
        gl.UNSIGNED_BYTE
      );
    } else if (history.tool == "displace") {
      let sourceDisplaceMapManager = getSourceDisplaceMapManager(canvas, gl);
      redoTex = sourceDisplaceMapManager.applyHistory(history);
      let { x, y, width, height } = history.rect;
      addRedo(history.tool, redoTex, x, y, width, height, gl.RG, gl.HALF_FLOAT);
    }

    undoStack.pop();
  }

  function redo() {
    if (redoStack.length == 0) return;

    let history = redoStack[redoStack.length - 1];
    redoStack.pop();

    let undoTex;
    if (history.tool == "source") {
      let sourceManager = getSourceTextureManager(canvas, gl);
      undoTex = sourceManager.applyHistory(history);
      let { x, y, width, height } = history.rect;
      addUndo(
        history.tool,
        undoTex,
        x,
        y,
        width,
        height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        false
      );
    } else if (history.tool == "displace") {
      let sourceDisplaceMapManager = getSourceDisplaceMapManager(canvas, gl);
      undoTex = sourceDisplaceMapManager.applyHistory(history);
      let { x, y, width, height } = history.rect;
      addUndo(
        history.tool,
        undoTex,
        x,
        y,
        width,
        height,
        gl.RG,
        gl.HALF_FLOAT,
        false
      );
    }
  }
  return {
    addUndo,
    undo,
    redo,
  };
}
