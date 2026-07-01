import { makeAutoObservable } from "mobx";
import { getLayerWorker } from "./worker/workerPool";
import { paintState } from "./paintState";
import { selection, setBefore } from "./selection";
import { beforeShapePos, shape } from "./shape";
import { position } from "./position";
import { MosaicToolId, ShapeId } from "./paintState";

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

// undo/redo는 실제로 비동기(리사이즈 undo 등)라, 연타 시 겹쳐 실행되면
// paintOptions/텍스처를 동시 변경해 캔버스가 손상된다. 재진입을 막는다.
let isHistoryBusy = false;

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
  if (isHistoryBusy) return;
  isHistoryBusy = true;
  try {
    await runUndo();
  } finally {
    isHistoryBusy = false;
  }
}

async function runUndo() {
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
    paintState.setMosaicToolId(historyResponse.mosaicMode as MosaicToolId);
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

    // shape 분기의 beforeShapePos와 동일하게, 취소(selectionCancel) 복원용
    // 기준 위치도 갱신해야 stale 사각형으로 튀지 않는다.
    setBefore({ x, y: realY, width, height });
  }

  if (historyResponse.shape) {
    let { show, kind, x, y, width, height } = historyResponse.shape;

    let realY = position.height - y - height;
    shape.setKind(kind as ShapeId | null);
    shape.setX(x);
    shape.setY(realY);
    shape.setWidth(width);
    shape.setHeight(height);
    shape.setShowHandle(show);
    shape.setShowHint(show);
    shape.setVisible(show);
    beforeShapePos.x = x;
    beforeShapePos.y = realY;
    beforeShapePos.width = width;
    beforeShapePos.height = height;
  }
}

export async function redo() {
  if (paintState.getPointerdown()) return;
  if (isHistoryBusy) return;
  isHistoryBusy = true;
  try {
    await runRedo();
  } finally {
    isHistoryBusy = false;
  }
}

async function runRedo() {
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
    paintState.setMosaicToolId(historyResponse.mosaicMode as MosaicToolId);
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

    // shape 분기의 beforeShapePos와 동일하게, 취소(selectionCancel) 복원용
    // 기준 위치도 갱신해야 stale 사각형으로 튀지 않는다.
    setBefore({ x, y: realY, width, height });
  }

  if (historyResponse.shape) {
    let { show, kind, x, y, width, height } = historyResponse.shape;

    let realY = position.height - y - height;
    shape.setKind(kind as ShapeId | null);
    shape.setX(x);
    shape.setY(realY);
    shape.setWidth(width);
    shape.setHeight(height);
    shape.setShowHandle(show);
    shape.setShowHint(show);
    shape.setVisible(show);
    beforeShapePos.x = x;
    beforeShapePos.y = realY;
    beforeShapePos.width = width;
    beforeShapePos.height = height;
  }
}
