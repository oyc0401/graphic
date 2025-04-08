import { paintState } from "./main";
import { els } from "./elements";
import {  position, to_pixel_canvas_coord } from "./position";
import { getLayerWorker } from "./worker/workerPool";
import * as Comlink from "comlink";
import { makeAutoObservable } from "mobx";

export class SelectionState {
  x = 0;
  y = 0;
  width = 300;
  height = 200;
  visible = false;
  active = false;

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
}

export const selection = new SelectionState();

let beforeSelectionPos = {
  x: 0,
  y: 0,
  width: 50,
  height: 50,
};

export function addSelectionEvent() {
  addSelectionDragEventListener();
  addHandleEventListener();
}

function addSelectionDragEventListener() {
  let selectionDragPointer = { x: 0, y: 0 };
  (function () {
    els.selectionArea.addEventListener(
      "pointerdown",
      function (e: PointerEvent) {
        e.preventDefault();
        if (!paintState.pointerdown) return;
        if (paintState.action != "BRUSH") return;
        if (paintState.toolId != "selection") return;
        let point = to_pixel_canvas_coord(e.clientX, e.clientY);

        console.log("선택창 이동 시작!");
        selection.active = true;

        selectionDragPointer = {
          x: point.x - selection.x,
          y: point.y - selection.y,
        };
      },
    );

    window.addEventListener("pointermove", (e) => {
      e.preventDefault();
      // console.log(to_canvas_coord(e.clientX, e.clientY))
      if (!paintState.pointerdown) return;
      if (paintState.action != "BRUSH") return;
      if (!selection.active) return;

      let point = to_pixel_canvas_coord(e.clientX, e.clientY);

      const worker = getLayerWorker();

      let newSelectionX = point.x - selectionDragPointer.x;
      let newSelectionY = point.y - selectionDragPointer.y;

      selection.setPosition(newSelectionX, newSelectionY);
      worker.moveSelection(
        selection.x,
        selection.y,
        selection.width,
        selection.height,
      );
    });

    window.addEventListener("pointerup", (e) => {
      e.preventDefault();
      if (paintState.action != "BRUSH") return;
      if (!selection.active) return;

      beforeSelectionPos = {
        x: selection.x,
        y: selection.y,
        width: selection.width,
        height: selection.height,
      };

      selection.active = false;
    });
  })();
}

let activeHandle: HTMLElement | null = null;

function addHandleEventListener() {
  let worker = getLayerWorker();

  // 드래그 시작 시점의 마우스 위치
  let startX = 0;
  let startY = 0;

  // 드래그 시작 시점의 selection 상태
  let startLeft = 0; // selection.x
  let startTop = 0; // selection.y
  let startWidth = 0; // selection.width
  let startHeight = 0; // selection.height

  // 핸들 MOUSEDOWN 이벤트 핸들러
  function onMouseDown(e: MouseEvent, handle: HTMLElement) {
    e.preventDefault();
    if (!paintState.pointerdown) return;
    if (paintState.action != "BRUSH") return;

    activeHandle = handle;

    let point = to_pixel_canvas_coord(e.clientX, e.clientY);
    // 마우스 시작 좌표 기록
    startX = point.x;
    startY = point.y;

    // selection의 초기 상태 기록
    startLeft = selection.x;
    startTop = selection.y;
    startWidth = selection.width;
    startHeight = selection.height;
  }

  // 전역 MOUSEMOVE 이벤트 핸들러
  function onMouseMove(e: MouseEvent) {
    if (!paintState.pointerdown) return;
    if (paintState.action != "BRUSH") return;
    if (!activeHandle) return;

    let point = to_pixel_canvas_coord(e.clientX, e.clientY);

    // 마우스가 얼마나 이동했는지
    const dx = point.x - startX;
    const dy = point.y - startY;

    // TODO: 나중에 정리하자~~

    // 어떤 핸들을 드래그 중인지에 따라 selection 갱신
    if (activeHandle === els.handleR) {
      // 오른쪽 중앙: 폭만 늘어남
      selection.setWidth(Math.max(0, startWidth + dx));
    } else if (activeHandle === els.handleL) {
      // 왼쪽 중앙: x와 width가 반대 방향으로 조정
      selection.setX(Math.min(startLeft + startWidth, startLeft + dx));
      selection.setWidth(Math.max(0, startWidth - dx));
    } else if (activeHandle === els.handleT) {
      // 위 중앙: y와 height
      selection.setY(Math.min(startTop + startHeight, startTop + dy));
      selection.setHeight(Math.max(0, startHeight - dy));
    } else if (activeHandle === els.handleB) {
      // 아래 중앙: 높이만 늘어남
      selection.setHeight(Math.max(0, startHeight + dy));
    } else if (activeHandle === els.handleLT) {
      // 왼쪽 위 모서리: x, width, y, height 모두 영향
      selection.setX(Math.min(startLeft + startWidth, startLeft + dx));
      selection.setWidth(Math.max(0, startWidth - dx));
      selection.setY(Math.min(startTop + startHeight, startTop + dy));
      selection.setHeight(Math.max(0, startHeight - dy));

      // SHIFT + 비율 고정
      if (e.shiftKey && startWidth !== 0 && startHeight !== 0) {
        const ratio = startWidth / startHeight;
        // 현재 비율과 비교 후 보정
        const currentRatio = selection.width / selection.height;
        if (currentRatio < ratio) {
          selection.setWidth(selection.height * ratio);
        } else {
          selection.setHeight(selection.width / ratio);
        }
        // '오른쪽 아래' 모서리를 고정하려면:
        selection.setX(startLeft + startWidth - selection.width);
        selection.setY(startTop + startHeight - selection.height);
      }
    } else if (activeHandle === els.handleRT) {
      // 오른쪽 위 모서리: width, y, height
      selection.setWidth(Math.max(0, startWidth + dx));
      selection.setY(Math.min(startTop + startHeight, startTop + dy));
      selection.setHeight(Math.max(0, startHeight - dy));

      if (e.shiftKey && startWidth !== 0 && startHeight !== 0) {
        const ratio = startWidth / startHeight;
        const currentRatio = selection.width / selection.height;
        if (currentRatio < ratio) {
          selection.setWidth(selection.height * ratio);
        } else {
          selection.setHeight(selection.width / ratio);
        }
        // '왼쪽 아래' 모서리를 고정
        selection.setX(startLeft);
        selection.setY(startTop + startHeight - selection.height);
      }
    } else if (activeHandle === els.handleRB) {
      // 오른쪽 아래 모서리: width, height
      selection.setWidth(Math.max(0, startWidth + dx));
      selection.setHeight(Math.max(0, startHeight + dy));

      if (e.shiftKey && startWidth !== 0 && startHeight !== 0) {
        const ratio = startWidth / startHeight;
        const currentRatio = selection.width / selection.height;
        if (currentRatio < ratio) {
          selection.setWidth(selection.height * ratio);
        } else {
          selection.setHeight(selection.width / ratio);
        }
        // '왼쪽 위' 모서리 고정
        selection.setX(startLeft);
        selection.setY(startTop);
      }
    } else if (activeHandle === els.handleLB) {
      // 왼쪽 아래 모서리: x, width, height
      selection.setX(Math.min(startLeft + startWidth, startLeft + dx));
      selection.setWidth(Math.max(0, startWidth - dx));
      selection.setHeight(Math.max(0, startHeight + dy));

      if (e.shiftKey && startWidth !== 0 && startHeight !== 0) {
        const ratio = startWidth / startHeight;
        const currentRatio = selection.width / selection.height;
        if (currentRatio < ratio) {
          selection.setWidth(selection.height * ratio);
        } else {
          selection.setHeight(selection.width / ratio);
        }
        // '오른쪽 위' 모서리를 고정
        selection.setX(startLeft + startWidth - selection.width);
        selection.setY(startTop);
      }
    }

    // 쉬프트 시 비율 고정
    if (activeHandle === els.handleT || activeHandle === els.handleB) {
      if (e.shiftKey && startWidth !== 0 && startHeight !== 0) {
        const ratio = startWidth / startHeight;
        selection.setWidth(selection.height * ratio);
      } else {
        selection.setWidth(startWidth);
      }
    }

    if (activeHandle === els.handleL || activeHandle === els.handleR) {
      if (e.shiftKey && startWidth !== 0 && startHeight !== 0) {
        const ratio = startWidth / startHeight;
        selection.setHeight(selection.width / ratio);
      } else {
        selection.setHeight(startHeight);
      }
    }

    worker.moveSelection(
      selection.x,
      selection.y,
      selection.width,
      selection.height,
    );
  }

  // 전역 MOUSEUP 이벤트 핸들러
  function onMouseUp() {
    if (paintState.action != "BRUSH") return;
    if (!activeHandle) return;

    activeHandle = null;

    beforeSelectionPos = {
      x: selection.x,
      y: selection.y,
      width: selection.width,
      height: selection.height,
    };
  }

  // 각 핸들에 mousedown 이벤트 등록
  const handles = [
    els.handleLT,
    els.handleT,
    els.handleRT,
    els.handleR,
    els.handleRB,
    els.handleB,
    els.handleLB,
    els.handleL,
  ];
  for (const handle of handles) {
    handle.addEventListener("pointerdown", (e) => onMouseDown(e, handle));
  }

  // 전역에 mousemove, mouseup 이벤트 등록 (드래그 추적)
  document.addEventListener("pointermove", onMouseMove);
  document.addEventListener("pointerup", onMouseUp);
}

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
  worker.applySelection();
}

// 자르기 한 이후에
export function cutSelection() {
  paintState.setToolId("select");
  selection.setVisible(false);
}

// 선택창 캔슬
export function selectionCancel() {
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
}
