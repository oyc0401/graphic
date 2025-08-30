import { getManager } from "../../../utils/cachedManager";
import { Rect } from "../../../utils/dirtyRect";
import { PixelStorage } from "./PixelStore";

export class HistoryObject {
  gl;
  id;

  constructor(gl, { undo, redo }) {
    this.gl = gl;
    this.undo = undo;
    this.redo = redo;
  }

  undo: () => Promise<string>;

  redo: () => Promise<string>;
}

// 드로우 1 -> 드로우 2 -> 드로우 3 -> 나가기
//       이미지 1 -> 이미지 2 ->  이미지 3
// 드로우2 를 하기 전, start단에서 이미지 1 때의 imageDirty를 보관한다.
// 그리고 드로우 2를 수행하고, 이미지1 에서 Rect2에 해당되는 부분을 텍스쳐화 한다.
// 히스토리에 imageDirty와 Rect2와 텍스쳐를 넣는다.

export interface Snapshot {
  layerId;
  pixelReader?: PixelStorage;
  rect: Rect;
  apply: () => Promise<void>;
  selectionRect?: Rect;
}

let undoStack: HistoryObject[] = [];
let redoStack: HistoryObject[] = [];

export function resetHisory() {
  undoStack = [];
  redoStack = [];
  // mainThread.historyCount(undoStack.length, redoStack.length);
}

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

  //const readPixelQueue = new PixelReadProcessor(gl);

  function addUndo(
    newHistory: HistoryObject,
    options: {
      resetRedo?: boolean;
    } = {}
  ) {
    const { resetRedo = true } = options;
    undoStack.push(newHistory);

    if (resetRedo && redoStack.length != 0) {
      // 이때 큐에 다 못들어간 히스토리가 남아있지 않게
      // 히스토리에 객체 먼저 넣고 readPixel 큐잉 하기
      // 객체 안에서 readPixel하게!
      redoStack = [];
    }

    // mainThread.historyCount(undoStack.length, redoStack.length);

    logCurrent();
  }

  function addRedo(newHistory: HistoryObject) {
    redoStack.push(newHistory);

    // mainThread.historyCount(undoStack.length, redoStack.length);
    logCurrent();
  }

  async function undo() {
    if (undoStack.length == 0) return;

    let history = undoStack[undoStack.length - 1];
    undoStack.pop();

    let response = await history.undo();
    addRedo(history);

    return {
      tool: response,
      undoCount: undoStack.length,
      redoCount: redoStack.length,
    };
  }

  async function redo() {
    if (redoStack.length == 0) return;

    let history = redoStack[redoStack.length - 1];
    redoStack.pop();

    let response = await history.redo();
    addUndo(history, { resetRedo: false });

    return {
      tool: response,
      undoCount: undoStack.length,
      redoCount: redoStack.length,
    };
  }

  function logCurrent() {
    console.warn(
      "undo:",
      undoStack.length,
      "redo:",
      redoStack.length
      // "\n",
      // "undoStack:",
      // undoStack,
      // "redoStack:",
      // redoStack,
    );
  }

  function getHistoryCount() {
    return {
      undoCount: undoStack.length,
      redoCount: redoStack.length,
    };
  }
  return {
    addUndo,
    undo,
    redo,
    getHistoryCount,
  };
}
