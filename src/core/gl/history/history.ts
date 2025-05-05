import { getSourceTextureManager, paintOptions } from "../texture";
import { getManager } from "../utils/cachedManager";
import { DirtyRect, Rect } from "../utils/dirtyRect";
import { PixelReadProcessor, setDrawingFlag } from "./pixelReadProcessor";
import { PixelReader } from "./PixelReader";
import { mainThread } from "../../worker/mainPool";
import { HistoryObject } from "../tool/liquify";

export interface HistoryItem {
  group?: string;
  layerId: number;
  tool: string;
  rect?: DirtyRect;
  pixelReader?: PixelReader;
  skipHistory: boolean;
  applyHistory(HistoryItem): HistoryItem;
  showSelection?: boolean;
  selectionRect?: Rect;
}
let undoStack: HistoryObject[] = [];
let redoStack: HistoryObject[] = [];

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

  //const readPixelQueue = new PixelReadProcessor(gl);

  function addUndo(
    newHistory: HistoryObject,
    options: {
      resetRedo?: boolean;
    } = {},
  ) {
    const { resetRedo = true } = options;

    //console.log("addUndo:", newHistory.tool);

    undoStack.push(newHistory);

    if (resetRedo && redoStack.length != 0) {
      // 이때 큐에 다 못들어간 히스토리가 남아있지 않게
      // 히스토리에 객체 먼저 넣고 readPixel 큐잉 하기
      // 객체 안에서 readPixel하게!
      redoStack = [];
    }

    mainThread.historyCount(undoStack.length, redoStack.length);

    logCurrent();
  }

  function addRedo(newHistory: HistoryObject) {
    //console.log("addRedo:", newHistory.tool);

    redoStack.push(newHistory);

    mainThread.historyCount(undoStack.length, redoStack.length);
    logCurrent();
  }

  function undo() {
    if (undoStack.length == 0) return;

    let history = undoStack[undoStack.length - 1];
    undoStack.pop();

    let response = history.undo();
    addRedo(history);

    return response;
  }

  function redo() {
    if (redoStack.length == 0) return;

    let history = redoStack[redoStack.length - 1];
    redoStack.pop();

    let response = history.redo();
    addUndo(history, { resetRedo: false });

    return response;
  }

  function logCurrent() {
    console.log(
      "undo:",
      undoStack.length,
      "redo:",
      redoStack.length,
      // "\n",
      // "undoStack:",
      // undoStack,
      // "redoStack:",
      // redoStack,
    );
  }
  return {
    addUndo,
    undo,
    redo,
  };
}
