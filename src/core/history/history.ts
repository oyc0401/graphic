import { getUndoByte, paintConfig } from "@/paint.config";
import type { MosaicMode, ShapeKind } from "@/core/types";
import { getManager } from "../utils/cachedManager";

export class HistoryObject {
  id;
  byteSize: number;

  constructor({
    undo,
    redo,
    byteSize = 0,
  }: {
    undo: () => Promise<HistoryCommand>;
    redo: () => Promise<HistoryCommand>;
    byteSize?: number;
  }) {
    this.undo = undo;
    this.redo = redo;
    this.byteSize = byteSize;
  }

  undo: () => Promise<HistoryCommand>;

  redo: () => Promise<HistoryCommand>;
}

interface HistoryCommand {
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
    flipH?: boolean;
    flipV?: boolean;
  };
  shape?: {
    show: boolean;
    kind: ShapeKind | null;
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface HistoryResponse {
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
    flipH?: boolean;
    flipV?: boolean;
  };
  shape?: {
    show: boolean;
    kind: ShapeKind | null;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  mosaicStrength?: number;
  mosaicMode?: MosaicMode;
  undoCount: number;
  redoCount: number;
}

// 드로우 1 -> 드로우 2 -> 드로우 3 -> 나가기
//       이미지 1 -> 이미지 2 ->  이미지 3
// 드로우2 를 하기 전, start단에서 이미지 1 때의 imageDirty를 보관한다.
// 그리고 드로우 2를 수행하고, 이미지1 에서 Rect2에 해당되는 부분을 텍스쳐화 한다.
// 히스토리에 imageDirty와 Rect2와 텍스쳐를 넣는다.

// 4096 * 4096 이미지 일정분의 ㄷ바이트 크기를 최대 제한으로 설정
const MAX_TOTAL_BYTES = getUndoByte(); // RGBA, 10개

function getTotalStackBytes(stack: HistoryObject[]): number {
  return stack.reduce((total, history) => total + history.byteSize, 0);
}

function trimStackByBytes(stack: HistoryObject[], maxBytes: number): void {
  while (stack.length > 0 && getTotalStackBytes(stack) > maxBytes) {
    stack.shift(); // 가장 오래된 항목 제거
  }
}

function trimStackByCount(stack: HistoryObject[], maxCount: number): void {
  while (stack.length > maxCount) {
    stack.shift(); // 가장 오래된 항목 제거
  }
}

function trimStack(stack: HistoryObject[]): void {
  trimStackByBytes(stack, MAX_TOTAL_BYTES);
  trimStackByCount(stack, paintConfig.maxHistoryItems);
}

export interface HistoryCount {
  undoCount: number;
  redoCount: number;
}

export class HistoryStack {
  private undoStack: HistoryObject[] = [];
  private redoStack: HistoryObject[] = [];

  constructor(private label = "history") {}

  addUndo(
    newHistory: HistoryObject,
    options: {
      resetRedo?: boolean;
    } = {},
  ) {
    const { resetRedo = true } = options;
    this.undoStack.push(newHistory);

    trimStack(this.undoStack);

    if (resetRedo && this.redoStack.length != 0) {
      this.redoStack = [];
    }

    this.logCurrent();
  }

  private addRedo(newHistory: HistoryObject) {
    this.redoStack.push(newHistory);
    trimStack(this.redoStack);
    this.logCurrent();
  }

  async undo(): Promise<HistoryResponse | null> {
    if (this.undoStack.length == 0) return null;

    let history = this.undoStack[this.undoStack.length - 1];
    this.undoStack.pop();

    let response = await history.undo();
    this.addRedo(history);

    return {
      selection: response.selection,
      shape: response.shape,
      position: response.position,
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
    };
  }

  async redo(): Promise<HistoryResponse | null> {
    if (this.redoStack.length == 0) return null;

    let history = this.redoStack[this.redoStack.length - 1];
    this.redoStack.pop();

    let response = await history.redo();
    this.addUndo(history, { resetRedo: false });

    return {
      selection: response.selection,
      shape: response.shape,
      position: response.position,
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
    };
  }

  getHistoryCount(): HistoryCount {
    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
    };
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }

  private logCurrent() {
    const undoBytes = getTotalStackBytes(this.undoStack);
    const redoBytes = getTotalStackBytes(this.redoStack);
    const undoMB = (undoBytes / (1024 * 1024)).toFixed(2);
    const redoMB = (redoBytes / (1024 * 1024)).toFixed(2);

    console.warn(
      `${this.label} undo: ${this.undoStack.length}/${paintConfig.maxHistoryItems} (${undoMB} MB)`,
      `redo: ${this.redoStack.length}/${paintConfig.maxHistoryItems} (${redoMB} MB)`,
    );
  }
}

const globalHistoryStack = new HistoryStack();

export function resetHisory() {
  globalHistoryStack.clear();
}

export function getHistoryManager(canvas, gl) {
  const manager = getManager(gl, "history", () => createHistoryManager());
  return manager;
}

function createHistoryManager() {
  return {
    addUndo: globalHistoryStack.addUndo.bind(globalHistoryStack),
    undo: globalHistoryStack.undo.bind(globalHistoryStack),
    redo: globalHistoryStack.redo.bind(globalHistoryStack),
    getHistoryCount: globalHistoryStack.getHistoryCount.bind(globalHistoryStack),
  };
}
