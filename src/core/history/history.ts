import { getManager } from "../utils/cachedManager";
import { PixelStore } from "./PixelStore";
import { Rect } from "@/core/utils/rect";

export class HistoryObject {
  id;

  constructor({
    undo,
    redo,
  }: {
    undo: () => Promise<HistoryCommand>;
    redo: () => Promise<HistoryCommand>;
  }) {
    this.undo = undo;
    this.redo = redo;
  }

  undo: () => Promise<HistoryCommand>;

  redo: () => Promise<HistoryCommand>;
}

interface HistoryCommand {
  tool: string;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  selection?: {
    show: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface HistoryResponse {
  tool: string;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  selection?: {
    show: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  undoCount: number;
  redoCount: number;
}

// 드로우 1 -> 드로우 2 -> 드로우 3 -> 나가기
//       이미지 1 -> 이미지 2 ->  이미지 3
// 드로우2 를 하기 전, start단에서 이미지 1 때의 imageDirty를 보관한다.
// 그리고 드로우 2를 수행하고, 이미지1 에서 Rect2에 해당되는 부분을 텍스쳐화 한다.
// 히스토리에 imageDirty와 Rect2와 텍스쳐를 넣는다.

export interface Snapshot {
  layerId;
  pixelReader?: PixelStore<any>;
  rect: Rect;
  apply: () => Promise<void>;
  selectionRect?: Rect;
}

const MAX_UNDO_SIZE = 5;
const MAX_REDO_SIZE = 5;

let undoStack: HistoryObject[] = [];
let redoStack: HistoryObject[] = [];

export function resetHisory() {
  undoStack = [];
  redoStack = [];
}

export function getHistoryManager(canvas, gl) {
  const manager = getManager(gl, "history", () => createHistoryManager());
  return manager;
}

function createHistoryManager() {
  function addUndo(
    newHistory: HistoryObject,
    options: {
      resetRedo?: boolean;
      overflow?: boolean;
    } = {},
  ) {
    const { resetRedo = true, overflow = false } = options;
    undoStack.push(newHistory);

    // 최대 제한 (overflow가 true가 아닌 경우)
    if (!overflow && undoStack.length > MAX_UNDO_SIZE) {
      undoStack.shift(); // 가장 오래된 항목 제거
    }

    if (resetRedo && redoStack.length != 0) {
      // 이때 큐에 다 못들어간 히스토리가 남아있지 않게
      // 히스토리에 객체 먼저 넣고 readPixel 큐잉 하기
      // 객체 안에서 readPixel하게!
      redoStack = [];
    }

    logCurrent();
  }

  function addRedo(newHistory: HistoryObject, overflow: boolean = false) {
    redoStack.push(newHistory);

    // 최대 제한 (overflow가 true가 아닌 경우)
    if (!overflow && redoStack.length > MAX_REDO_SIZE) {
      redoStack.shift(); // 가장 오래된 항목 제거
    }

    logCurrent();
  }

  async function undo(): Promise<HistoryResponse | null> {
    if (undoStack.length == 0) return null;

    let history = undoStack[undoStack.length - 1];
    undoStack.pop();

    let response = await history.undo();
    addRedo(history);

    return {
      tool: response.tool,
      selection: response.selection,
      position: response.position,
      undoCount: undoStack.length,
      redoCount: redoStack.length,
    };
  }

  async function redo(): Promise<HistoryResponse | null> {
    if (redoStack.length == 0) return null;

    let history = redoStack[redoStack.length - 1];
    redoStack.pop();

    let response = await history.redo();
    addUndo(history, { resetRedo: false });

    return {
      tool: response.tool,
      selection: response.selection,
      position: response.position,
      undoCount: undoStack.length,
      redoCount: redoStack.length,
    };
  }

  function logCurrent() {
    console.warn(
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
