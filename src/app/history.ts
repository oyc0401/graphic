import { makeAutoObservable } from "mobx";
import { getLayerWorker } from "./worker/workerPool";
import { paintState } from "./paintState";
import { selection } from "./selection";
import { position } from "./position";
import { applyCoreToolState, toCoreToolState } from "./coreToolState";

class HistoryState {
  undoCount = 0;
  redoCount = 0;

  constructor() {
    makeAutoObservable(this);
  }
  getUndoCount() {
    return this.undoCount;
  }
  getRedoCount() {
    return this.redoCount;
  }

  setUndoCount(count) {
    this.undoCount = count;
  }
  setRedoCount(count) {
    this.redoCount = count;
  }
}

export const historyState = new HistoryState();

export function syncCoreState() {
  const coreState = getLayerWorker().getState();
  const { undoCount, redoCount } = coreState.history;
  paintState.setActiveSessionTool(coreState.activeSessionTool);
  historyState.setUndoCount(undoCount);
  historyState.setRedoCount(redoCount);
}

function applyHistoryPosition({
  x,
  y,
  width,
  height,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const appY = position.screenHeight / position.scale - height - y;

  position.setX(x);
  position.setY(appY);
  position.setWidth(width);
  position.setHeight(height);
}

export async function undo() {
  if (paintState.pointerdown) return;

  let worker = getLayerWorker();
  let historyResponse = await worker.undo();
  if (!historyResponse) return;
  let { toolState, undoCount, redoCount } = historyResponse;
  const tool = toolState.tool;
  historyState.setUndoCount(undoCount);
  historyState.setRedoCount(redoCount);

  applyCoreToolState(toolState, { doExit: false });

  if (tool == "selection") {
    selection.setVisible(true);
    selection.setShowHint(true);
    selection.setShowHandle(true);
    selection.setFlip(false, false);
  }

  if (historyResponse.position) {
    applyHistoryPosition(historyResponse.position);
  }

  if (historyResponse.selection) {
    let { show, x, y, width, height } = historyResponse.selection;

    let realY = position.height - y - height;
    selection.setX(x);
    selection.setY(realY);
    selection.setWidth(width);
    selection.setHeight(height);
    selection.setShowHandle(show);
    selection.setShowHint(show);
    selection.setVisible(show);

    if (show) {
      applyCoreToolState(toCoreToolState("selection"));
    } else {
      applyCoreToolState(toCoreToolState("select"));
    }
  }
}

export async function redo() {
  if (paintState.pointerdown) return;
  let worker = getLayerWorker();
  let historyResponse = await worker.redo();
  if (!historyResponse) return;
  let { toolState, undoCount, redoCount } = historyResponse;
  const tool = toolState.tool;
  historyState.setUndoCount(undoCount);
  historyState.setRedoCount(redoCount);

  if (!tool) return;
  applyCoreToolState(toolState, { doExit: false });

  if (tool == "selection") {
    selection.setVisible(true);
    selection.setShowHint(true);
    selection.setShowHandle(true);
    selection.setFlip(false, false);
  }

  if (historyResponse.position) {
    applyHistoryPosition(historyResponse.position);
  }

  if (historyResponse.selection) {
    let { show, x, y, width, height } = historyResponse.selection;

    let realY = position.height - y - height;
    selection.setX(x);
    selection.setY(realY);
    selection.setWidth(width);
    selection.setHeight(height);
    selection.setShowHandle(show);
    selection.setShowHint(show);
    selection.setVisible(show);

    if (show) {
      applyCoreToolState(toCoreToolState("selection"));
    } else {
      applyCoreToolState(toCoreToolState("select"));
    }
  }
}
