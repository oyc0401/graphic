/** selection.ts */
import { paintState } from "./paintState";
import { position } from "./position";
import { getLayerWorker } from "./worker/workerPool";
import * as Comlink from "comlink";
import { makeAutoObservable } from "mobx";

interface SelectionPoint {
  x: number;
  y: number;
}

export class SelectionState {
  x = 0;
  y = 0;
  width = 300;
  height = 200;
  visible = false;
  showHint = false;
  showHandle = false;
  active = false; // 작동중인지 확인. 작동중이면 캔슬할 때 돌아감
  hover = "";
  flipH = false; // 수평 flip
  flipV = false; // 수직 flip
  freeformPreviewVisible = false;
  freeformPreviewPoints: SelectionPoint[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  setX(x: number) {
    this.x = x;
  }

  setY(y: number) {
    this.y = y;
  }

  setWidth(width: number) {
    this.width = width;
  }

  setHeight(height: number) {
    this.height = height;
  }

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  setVisible(visible: boolean) {
    this.visible = visible;
  }

  setShowHint(val: boolean) {
    this.showHint = val;
  }

  setShowHandle(val: boolean) {
    this.showHandle = val;
  }

  setHover(pos) {
    this.hover = pos;
  }

  setFlip(flipH: boolean, flipV: boolean) {
    this.flipH = flipH;
    this.flipV = flipV;
  }

  startFreeformPreview(point: SelectionPoint) {
    this.freeformPreviewVisible = true;
    this.freeformPreviewPoints = [point];
  }

  addFreeformPreviewPoint(point: SelectionPoint) {
    this.freeformPreviewPoints.push(point);
  }

  clearFreeformPreview() {
    this.freeformPreviewVisible = false;
    this.freeformPreviewPoints = [];
  }
}

export const selection = new SelectionState();

export let beforeSelectionPos = {
  x: 0,
  y: 0,
  width: 50,
  height: 50,
};

export function setBefore(ele) {
  beforeSelectionPos = ele;
}

// 비트맵으로 선택창 만들기
export function makeSelectionFromBitmap(bitmap: ImageBitmap) {
  if (paintState.getSessionId() !== null) return;

  applySelection();

  let worker = getLayerWorker();

  let newWidth = bitmap.width;
  let newHeight = bitmap.height;

  // 선택 영역 설정
  selection.setPosition(
    Math.ceil(Math.max(0, -position.x)),
    Math.ceil(Math.max(0, -position.y)),
  );
  selection.setSize(newWidth, newHeight);
  selection.setFlip(false, false);

  beforeSelectionPos = {
    x: selection.x,
    y: selection.y,
    width: selection.width,
    height: selection.height,
  };

  // 워커에 붙여넣기 지시
  worker.paste(
    selection.x,
    selection.y,
    selection.width,
    selection.height,
    bitmap,
    //Comlink.transfer(bitmap, [bitmap]),
  );

  selection.setVisible(true);
  selection.setShowHint(true);
  selection.setShowHandle(true);
}

// 해당 구역 선택
export function canvasSelect(x, y, width, height) {
  if (paintState.getSessionId() !== null) return;

  let worker = getLayerWorker();

  selection.setPosition(x, y);
  selection.setSize(width, height);
  selection.setFlip(false, false);

  worker.createSelection(
    selection.x,
    selection.y,
    selection.width,
    selection.height,
  );

  beforeSelectionPos = {
    x: selection.x,
    y: selection.y,
    width: selection.width,
    height: selection.height,
  };

  console.log("선택:", x, y, width, height);
  selection.setVisible(true);
  selection.setShowHandle(true);
  selection.setShowHint(true);
}

export function canvasFreeformSelect(points: SelectionPoint[]) {
  if (paintState.getSessionId() !== null) return;
  if (points.length < 3) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  const x = Math.max(0, Math.floor(minX));
  const y = Math.max(0, Math.floor(minY));
  const width = Math.min(position.width - x, Math.ceil(maxX) - x + 1);
  const height = Math.min(position.height - y, Math.ceil(maxY) - y + 1);

  if (width <= 1 || height <= 1) return;

  let worker = getLayerWorker();

  selection.setPosition(x, y);
  selection.setSize(width, height);
  selection.setFlip(false, false);

  worker.createFreeformSelection(points);

  beforeSelectionPos = {
    x: selection.x,
    y: selection.y,
    width: selection.width,
    height: selection.height,
  };

  selection.setVisible(true);
  selection.setShowHandle(true);
  selection.setShowHint(true);
}

// 선택창 적용
export function applySelection() {
  if (selection.visible) {
    let worker = getLayerWorker();
    worker.commitSelection();
  }

  selection.setVisible(false);
  selection.setShowHint(false);
  selection.setShowHandle(false);
  selection.setFlip(false, false);
}

// 자르기 한 이후에
export function cutSelection() {
  selection.setVisible(false);
  selection.setShowHint(false);
  selection.setShowHandle(false);
  selection.setFlip(false, false);
}

export function selectionDelete() {
  selection.setVisible(false);
  selection.setShowHint(false);
  selection.setShowHandle(false);
  selection.setFlip(false, false);

  let worker = getLayerWorker();
  worker.deleteSelection();
}

// 선택창 캔슬
export function selectionCancel() {
  // 핀치줌으로 인한 캔슬이면 선택창 안 끄기
  if (paintState.getPointerdown()) {
    if (selection.active) {
      selection.setX(beforeSelectionPos.x);
      selection.setY(beforeSelectionPos.y);
      selection.setWidth(beforeSelectionPos.width);
      selection.setHeight(beforeSelectionPos.height);

      const worker = getLayerWorker();

      worker.transformSelection(
        selection.x,
        selection.y,
        selection.width,
        selection.height,
        selection.flipH,
        selection.flipV,
      );
    }
    selection.active = false;
  } else {
    applySelection();
  }
}
