import { getSourceTextureManager, paintOptions } from "../texture";
import { getManager } from "../utils/cachedManager";
import { DirtyRect } from "../utils/dirtyRect";
import { PixelReadProcessor, setDrawingFlag } from "./pixelReadProcessor";
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
  skipHistory: boolean;
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
    newHistory,
    options: {
      resetRedo?: boolean;
      skipHistory?: boolean;
    } = {}
  ) {
    const { resetRedo = true, skipHistory = false } = options;

    console.log("addUndo readPixels");
    newHistory.skipHistory = skipHistory;

    undoStack.push(newHistory);

    setDrawingFlag(false);
    readPixelQueue.push(newHistory.pixelReader);
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
    newHistory,
    options: {
      skipHistory?: boolean;
    } = {}
  ) {
    const { skipHistory = false } = options;

    console.log("addRedo readPixels", newHistory);

    newHistory.skipHistory = skipHistory;
    redoStack.push(newHistory);

    setDrawingFlag(false);
    readPixelQueue.push(newHistory.pixelReader);
    readPixelQueue.excute();

    mainThread.historyCount(undoStack.length, redoStack.length);
    console.log("undo:", undoStack.length, "redo:", redoStack.length);
  }

  function undo() {
    if (undoStack.length == 0) return;

    let history = undoStack[undoStack.length - 1];
    undoStack.pop();

    if (history.tool == "source") {
      let sourceManager = getSourceTextureManager(canvas, gl);
      let newHistory = sourceManager.applyHistory(history);
      addRedo(newHistory, { skipHistory: history.skipHistory });
    } else if (history.tool == "displace") {
      let sourceDisplaceMapManager = getSourceDisplaceMapManager(canvas, gl);
      let newHistory = sourceDisplaceMapManager.applyHistory(history);
      addRedo(newHistory, { skipHistory: history.skipHistory });
    }

    if (history.skipHistory) {
      undo();
    }
  }

  function redo() {
    if (redoStack.length == 0) return;

    let history = redoStack[redoStack.length - 1];
    redoStack.pop();

    if (history.tool == "source") {
      let sourceManager = getSourceTextureManager(canvas, gl);
      let newHistory = sourceManager.applyHistory(history);
      addUndo(newHistory, {
        resetRedo: false,
        skipHistory: history.skipHistory,
      });
    } else if (history.tool == "displace") {
      let sourceDisplaceMapManager = getSourceDisplaceMapManager(canvas, gl);
      let newHistory = sourceDisplaceMapManager.applyHistory(history);
      addUndo(newHistory, {
        resetRedo: false,
        skipHistory: history.skipHistory,
      });
    }

    if (history.skipHistory) {
      redo();
    }
  }

  function skip(callback) {
    callback();
  }
  return {
    addUndo,
    undo,
    redo,
    skip,
  };
}
