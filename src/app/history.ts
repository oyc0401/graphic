import { makeAutoObservable } from "mobx";
import { getLayerWorker } from "./worker/workerPool";
import { paintState } from "./paintState";
import { selection } from "./selection";
import { position } from "./position";
import { applyWorkerToolTarget } from "./coreToolAdapter";
import { MosaicModeId, ToolId } from "./paintState";

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
  const { undoCount, redoCount } = getLayerWorker().getHistoryCount();
  historyState.setUndoCount(undoCount);
  historyState.setRedoCount(redoCount);
}

function applyHistoryPosition({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  const appY = position.screenHeight / position.scale - height - y;

  position.setX(x);
  position.setY(appY);
  position.setWidth(width);
  position.setHeight(height);
}

export async function undo() {
  if (paintState.getPointerdown()) return;

  let worker = getLayerWorker();
  let historyResponse = await worker.undo();
  if (!historyResponse) return;
  let { undoCount, redoCount } = historyResponse;
  historyState.setUndoCount(undoCount);
  historyState.setRedoCount(redoCount);
  if (historyResponse.mosaicStrength !== undefined) {
    paintState.setBrushAlpha(historyResponse.mosaicStrength);
  }
  if (historyResponse.mosaicMode !== undefined) {
    paintState.setMosaicModeId(historyResponse.mosaicMode as MosaicModeId);
  }

  if (historyResponse.position) {
    applyHistoryPosition(historyResponse.position);
  }

  if (historyResponse.selection) {
    let { show, x, y, width, height, flipH = false, flipV = false } = historyResponse.selection;

    let realY = position.height - y - height;
    selection.setX(x);
    selection.setY(realY);
    selection.setWidth(width);
    selection.setHeight(height);
    selection.setShowHandle(show);
    selection.setShowHint(show);
    selection.setVisible(show);
    selection.setFlip(flipH, flipV);

    if (show) {
      applyWorkerToolTarget(ToolId.Selection);
    } else {
      applyWorkerToolTarget(ToolId.Select);
    }
  }
}

export async function redo() {
  if (paintState.getPointerdown()) return;
  let worker = getLayerWorker();
  let historyResponse = await worker.redo();
  if (!historyResponse) return;
  let { undoCount, redoCount } = historyResponse;
  historyState.setUndoCount(undoCount);
  historyState.setRedoCount(redoCount);
  if (historyResponse.mosaicStrength !== undefined) {
    paintState.setBrushAlpha(historyResponse.mosaicStrength);
  }
  if (historyResponse.mosaicMode !== undefined) {
    paintState.setMosaicModeId(historyResponse.mosaicMode as MosaicModeId);
  }

  if (historyResponse.position) {
    applyHistoryPosition(historyResponse.position);
  }

  if (historyResponse.selection) {
    let { show, x, y, width, height, flipH = false, flipV = false } = historyResponse.selection;

    let realY = position.height - y - height;
    selection.setX(x);
    selection.setY(realY);
    selection.setWidth(width);
    selection.setHeight(height);
    selection.setShowHandle(show);
    selection.setShowHint(show);
    selection.setVisible(show);
    selection.setFlip(flipH, flipV);

    if (show) {
      applyWorkerToolTarget(ToolId.Selection);
    } else {
      applyWorkerToolTarget(ToolId.Select);
    }
  }
}
