import { makeAutoObservable } from "mobx";
import { getLayerWorker } from "./worker/workerPool";
import { toolManager } from "./draw";
import { paintState } from "./paintState";
import { selection } from "./selection";
import { position } from "./position";

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

export async function undo() {
  if (paintState.pointerdown) return;

  if (paintState.toolId == "resize") {
    toolManager.setBrushTool();
  }

  let worker = getLayerWorker();
  let historyResponse = await worker.undo();
  if (!historyResponse) return;
  let { tool, undoCount, redoCount } = historyResponse;
  historyState.setUndoCount(undoCount);
  historyState.setRedoCount(redoCount);

  // console.warn("change tool:", msg);
  if (tool == "select") {
    paintState.setToolId("select");
    const worker = getLayerWorker();
    worker.setTool("select", false);
  } else if (tool == "selection") {
    paintState.setToolId("selection");
    selection.setVisible(true);
    selection.setShowHint(true);
    selection.setShowHandle(true);
    selection.setFlip(false, false);
  } else if (tool == "brush") {
    paintState.setToolId("brush");
    paintState.setBrushId("brush");
    const worker = getLayerWorker();
    worker.setTool(paintState.brushId, false);
  } else if (tool == "liquify") {
    // 이때 liquify -> brush로 가면 liquify의 exit안해도 됌.

    paintState.setToolId("brush");
    paintState.setBrushId("liquify");
    const worker = getLayerWorker();
    worker.setTool(paintState.brushId, false);
  } else {
    console.warn("허용되지 않은 tool", tool);
  }

  if (historyResponse.position) {
    let { x, y, width, height } = historyResponse.position;
    let newY = position.screenHeight / position.scale - height - y;

    position.setX(x);
    position.setY(newY);
    position.setWidth(width);
    position.setHeight(height);
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
    let worker = getLayerWorker();

    if (show) {
      paintState.setToolId("selection");
      worker.setTool("selection");
    } else {
      paintState.setToolId("select");
      worker.setTool("select");
    }
  }
}

export async function redo() {
  if (paintState.pointerdown) return;

  if (paintState.toolId == "resize") {
    toolManager.setBrushTool();
  }
  let worker = getLayerWorker();
  let historyResponse = await worker.redo();
  if (!historyResponse) return;
  let { tool, undoCount, redoCount } = historyResponse;
  historyState.setUndoCount(undoCount);
  historyState.setRedoCount(redoCount);

  if (!tool) return;
  // console.warn("change tool:", msg);
  if (tool == "select") {
    paintState.setToolId("select");
    const worker = getLayerWorker();
    worker.setTool("select", false);
  } else if (tool == "selection") {
    paintState.setToolId("selection");
    selection.setVisible(true);
    selection.setShowHint(true);
    selection.setShowHandle(true);
    selection.setFlip(false, false);
  } else if (tool == "brush") {
    paintState.setToolId("brush");
    paintState.setBrushId("brush");
    const worker = getLayerWorker();
    worker.setTool(paintState.brushId, false);
  } else if (tool == "liquify") {
    paintState.setToolId("brush");
    paintState.setBrushId("liquify");
    const worker = getLayerWorker();
    worker.setTool(paintState.brushId, false);
  } else {
    console.warn("허용되지 않은 tool", tool);
  }

  if (historyResponse.position) {
    let { x, y, width, height } = position;
    let newY = position.screenHeight / position.scale - height - y;

    position.setX(x);
    position.setY(newY);
    position.setWidth(width);
    position.setHeight(height);
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
    let worker = getLayerWorker();

    if (show) {
      paintState.setToolId("selection");
      worker.setTool("selection");
    } else {
      paintState.setToolId("select");
      worker.setTool("select");
    }
  }
}
