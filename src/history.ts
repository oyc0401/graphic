import { makeAutoObservable } from "mobx";
import { getLayerWorker } from "./core/worker/workerPool";

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

export function undo() {
  let worker = getLayerWorker();
  worker.undo();
}

export function redo() {
  let worker = getLayerWorker();
  worker.redo();
}
