import { makeAutoObservable } from "mobx";
import { getLayerWorker } from "./worker/workerPool";
import { paintState } from "./paintState";
import { selection } from "./selection";
import { position } from "./position";
import {
  applyWorkerToolState,
  applyWorkerToolTarget,
  isSelectionWorkerToolState,
} from "./coreToolAdapter";
import { ToolId } from "./paintState";

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
  paintState.setSessionToolId(coreState.activeSessionTool);
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
  historyState.setUndoCount(undoCount);
  historyState.setRedoCount(redoCount);

  applyWorkerToolState(toolState, { doExit: false });

  if (isSelectionWorkerToolState(toolState)) {
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
      applyWorkerToolTarget(ToolId.Selection);
    } else {
      applyWorkerToolTarget(ToolId.Select);
    }
  }
}

export async function redo() {
  if (paintState.pointerdown) return;
  let worker = getLayerWorker();
  let historyResponse = await worker.redo();
  if (!historyResponse) return;
  let { toolState, undoCount, redoCount } = historyResponse;
  historyState.setUndoCount(undoCount);
  historyState.setRedoCount(redoCount);

  if (!toolState.tool) return;
  applyWorkerToolState(toolState, { doExit: false });

  if (isSelectionWorkerToolState(toolState)) {
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
      applyWorkerToolTarget(ToolId.Selection);
    } else {
      applyWorkerToolTarget(ToolId.Select);
    }
  }
}
