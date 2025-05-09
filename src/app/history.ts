import { makeAutoObservable } from "mobx";
import { getLayerWorker } from "./worker/workerPool";
import { toolManager } from "./draw";
import { paintState } from "./paintState";
import { selection } from "./selection";

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
  let msg = await worker.undo();
  if (!msg) return;
  console.warn("change tool:", msg);
  if (msg == "select") {
    paintState.setToolId("select");
    const worker = getLayerWorker();
    worker.setTool("select", false);
  } else if (msg == "selection") {
    paintState.setToolId("selection");
    selection.setVisible(true);
    selection.setShowHint(true);
    selection.setShowHandle(true);
  } else if (msg == "brush") {
    paintState.setToolId("brush");
    paintState.setBrushId("brush");
    const worker = getLayerWorker();
    worker.setTool(paintState.brushId, false);
  } else if (msg == "liquify") {
    // 이때 liquify -> brush로 가면 liquify의 exit안해도 됌.

    paintState.setToolId("brush");
    paintState.setBrushId("liquify");
    const worker = getLayerWorker();
    worker.setTool(paintState.brushId, false);
  } else {
    console.warn("허용되지 않은 tool", msg);
  }
}

export async function redo() {
  if (paintState.pointerdown) return;

  if (paintState.toolId == "resize") {
    toolManager.setBrushTool();
  }
  let worker = getLayerWorker();
  let msg = await worker.redo();
  if (!msg) return;
  console.warn("change tool:", msg);
  if (msg == "select") {
    paintState.setToolId("select");
    const worker = getLayerWorker();
    worker.setTool("select", false);
  } else if (msg == "selection") {
    paintState.setToolId("selection");
    selection.setVisible(true);
    selection.setShowHint(true);
    selection.setShowHandle(true);
  } else if (msg == "brush") {
    paintState.setToolId("brush");
    paintState.setBrushId("brush");
    const worker = getLayerWorker();
    worker.setTool(paintState.brushId, false);
  } else if (msg == "liquify") {
    paintState.setToolId("brush");
    paintState.setBrushId("liquify");
    const worker = getLayerWorker();
    worker.setTool(paintState.brushId, false);
  } else {
    console.warn("허용되지 않은 tool", msg);
  }
}
