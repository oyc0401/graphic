/** selection.ts */
import { paintState } from "./main";
import { position } from "./position";
import { getLayerWorker } from "./worker/workerPool";
import * as Comlink from "comlink";
import { makeAutoObservable } from "mobx";

export class SelectionState {
  x = 0;
  y = 0;
  width = 300;
  height = 200;
  visible = false;
  showHint = false;
  showHandle = false;
  active = false;
  hover = "";

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
let activeHandle: HTMLElement | null = null;

// 비트맵으로 선택창 만들기
export function makeSelectionFromBitmap(bitmap: ImageBitmap) {
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
    Comlink.transfer(bitmap, [bitmap]),
  );

  paintState.setToolId("selection");
  selection.setVisible(true);
}

// 해당 구역 선택
export function canvasSelect(x, y, width, height) {
  let worker = getLayerWorker();

  selection.setPosition(x, y);
  selection.setSize(width, height);

  worker.select(selection.x, selection.y, selection.width, selection.height);

  beforeSelectionPos = {
    x: selection.x,
    y: selection.y,
    width: selection.width,
    height: selection.height,
  };

  paintState.setToolId("selection");

  console.log("선택:", x, y, width, height);
  selection.setVisible(true);
}

// 선택창 적용
export function applySelection() {
  let worker = getLayerWorker();

  selection.setVisible(false);
  selection.setShowHint(false);
  selection.setShowHandle(false);
  worker.applySelection();
  paintState.changed = true;
}

// 자르기 한 이후에
export function cutSelection() {
  paintState.setToolId("select");
  selection.setVisible(false);
}

export function selectionDelete() {
  paintState.setToolId("select");
  selection.setVisible(false);

  let worker = getLayerWorker();
  worker.selectionDelete();
}

// 선택창 캔슬
export function selectionCancel() {
  if (paintState.pointerdown) {
    selection.active = false;

    selection.setX(beforeSelectionPos.x);
    selection.setY(beforeSelectionPos.y);
    selection.setWidth(beforeSelectionPos.width);
    selection.setHeight(beforeSelectionPos.height);

    const worker = getLayerWorker();

    worker.moveSelection(
      selection.x,
      selection.y,
      selection.width,
      selection.height,
    );

    activeHandle = null;

    selection.setShowHint(false);
  } else {
    applySelection();
    paintState.setToolId("select");
  }
}
