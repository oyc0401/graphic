import { paintState } from "./main";
import { els } from "./elements";
import { changeCanvasSize, position, to_pixel_canvas_coord } from "./position";
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
  hideHint(val: boolean) {
    this.showHint = val;
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
  addMakeSelectionEventListener();
  addSelectionDragEventListener();
  addHandleEventListener();

  // 외부 클릭하면 선택창 취소
  (function () {
    let startTime;
    let selectionDown = false;
    els.container.addEventListener("pointerdown", function (e) {
      if (paintState.action != "BRUSH") return;
      if (paintState.toolId != "selection" && paintState.toolId != "resize")
        return;
      if (!paintState.pointerdown) return;

      const blockedElement = document.getElementById("selections")!; // A 엘리먼트
      if (blockedElement.contains(e.target as Node)) return; // A 또는 자식 위면 무시

      selectionDown = true;
      startTime = performance.now();
      console.log("selection pointerdown");

      if (paintState.toolId == "resize") {
        paintState.setToolId("brush");
      }
    });

    els.container.addEventListener("pointerup", function (e) {
      if (paintState.action != "BRUSH") return;
      if (paintState.toolId != "selection") return;
      if (!selectionDown) return;

      let now = performance.now();
      if (now - startTime < 150) {
        console.log("cancel Selection!");

        applySelection();
        paintState.setToolId("select");
      }

      selectionDown = false;
    });
  })();
}
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function addMakeSelectionEventListener() {
  (function () {
    let startPoint;
    let endPoint;

    let sp, ep;

    let activeSelect = false;

    els.container.addEventListener("pointerdown", (e) => {
      if (paintState.action != "BRUSH") return;
      if (paintState.toolId != "select") return;
      let point = to_pixel_canvas_coord(e.clientX, e.clientY);

      let px = clamp(point.x, 0, position.width);
      let py = clamp(point.y, 0, position.height);
      startPoint = { x: px, y: py };
      endPoint = { x: px, y: py };

      sp = {
        x: startPoint.x + (startPoint.x > endPoint.x ? 1 : 0),
        y: startPoint.y + (startPoint.y > endPoint.y ? 1 : 0),
      };

      ep = {
        x: endPoint.x + (startPoint.x <= endPoint.x ? 1 : 0),
        y: endPoint.y + (startPoint.y <= endPoint.y ? 1 : 0),
      };

      activeSelect = true;

      console.log("선택 시작");
    });

    window.addEventListener("pointermove", (e) => {
      if (paintState.action != "BRUSH") return;
      if (paintState.toolId != "select") return;
      if (!paintState.pointerdown) return;
      if (!activeSelect) return;

      selection.hideHint(true);

      let point = to_pixel_canvas_coord(e.clientX, e.clientY);

      let px = clamp(point.x, 0, position.width);
      let py = clamp(point.y, 0, position.height);
      endPoint = { x: px, y: py };

      sp = {
        x: startPoint.x + (startPoint.x > endPoint.x ? 1 : 0),
        y: startPoint.y + (startPoint.y > endPoint.y ? 1 : 0),
      };

      ep = {
        x: endPoint.x + (startPoint.x <= endPoint.x ? 1 : 0),
        y: endPoint.y + (startPoint.y <= endPoint.y ? 1 : 0),
      };

      let startX = Math.min(sp.x, ep.x);
      let startY = Math.min(sp.y, ep.y);
      let zoomW = Math.abs(sp.x - ep.x);
      let zoomH = Math.abs(sp.y - ep.y);

      selection.setX(startX);
      selection.setY(startY);
      selection.setWidth(zoomW);
      selection.setHeight(zoomH);
    });

    window.addEventListener("pointerup", (e) => {
      if (paintState.action != "BRUSH") return;
      if (paintState.toolId != "select") return;
      if (!activeSelect) return;
      activeSelect = false;

      els.selectionArea.style.visibility = "hidden";

      let startX = Math.min(sp.x, ep.x);
      let startY = Math.min(sp.y, ep.y);
      let zoomW = Math.abs(sp.x - ep.x);
      let zoomH = Math.abs(sp.y - ep.y);

      if (zoomH == 0 || zoomW == 0) {
        console.error("선택창이 0이 나올 수 없는데?");
        return;
      }
      if (zoomH == 1 && zoomH == 1) {
        console.log("1 x 1 선택창은 만들지 않습니다.");
        return;
      }

      selection.hideHint(false);
      canvasSelect(startX, startY, zoomW, zoomH);
    });
  })();
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

      selection.hideHint(true);
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
      selection.hideHint(false);
    });
  })();
}

let activeHandle: HTMLElement | null = null;

function addHandleEventListener() {
  let worker = getLayerWorker();

  // 드래그 시작 시점의 selection 상태
  let startLeft = 0; // selection.x
  let startTop = 0; // selection.y
  let startWidth = 0; // selection.width
  let startHeight = 0; // selection.height

  let startPoint;
  let endPoint;

  // 핸들 MOUSEDOWN 이벤트 핸들러
  function onMouseDown(e: MouseEvent, handle: HTMLElement) {
    e.preventDefault();
    if (!paintState.pointerdown) return;
    if (paintState.action != "BRUSH") return;

    activeHandle = handle;

    startPoint = { x: selection.x, y: selection.y };
    endPoint = {
      x: selection.x + selection.width - 1,
      y: selection.y + selection.height - 1,
    };

    // selection의 초기 상태 기록
    startLeft = selection.x;
    startTop = selection.y;
    startWidth = selection.width;
    startHeight = selection.height;

    beforeSelectionPos = {
      x: selection.x,
      y: selection.y,
      width: selection.width,
      height: selection.height,
    };
  }

  // 전역 MOUSEMOVE 이벤트 핸들러
  function onMouseMove(e: MouseEvent) {
    if (!paintState.pointerdown) return;
    if (paintState.action != "BRUSH") return;
    if (!activeHandle) return;

    let point = to_pixel_canvas_coord(e.clientX, e.clientY);

    // 시작과 끝을 보고, 어떤 핸들인 지 보고 최종 결과 계산.
    let newX = startLeft;
    let newY = startTop;
    let newWidth = startWidth;
    let newHeight = startHeight;

    if (activeHandle === els.handleRB) {
      newWidth = point.x - startPoint.x + 1;
      newHeight = point.y - startPoint.y + 1;
    }
    if (activeHandle === els.handleLT) {
      newX = startLeft - (startPoint.x - point.x);
      newY = startTop - (startPoint.y - point.y);
      newWidth = endPoint.x - point.x + 1;
      newHeight = endPoint.y - point.y + 1;
    }
    if (activeHandle === els.handleRT) {
      newY = startTop - (startPoint.y - point.y);
      newWidth = point.x - startPoint.x + 1;
      newHeight = endPoint.y - point.y + 1;
    }
    if (activeHandle === els.handleLB) {
      newX = startLeft - (startPoint.x - point.x);
      newWidth = endPoint.x - point.x + 1;
      newHeight = point.y - startPoint.y + 1;
    }
    if (activeHandle === els.handleL) {
      newX = startLeft - (startPoint.x - point.x);
      newWidth = endPoint.x - point.x + 1;
    }
    if (activeHandle === els.handleR) {
      newWidth = point.x - startPoint.x + 1;
    }
    if (activeHandle === els.handleT) {
      newY = startTop - (startPoint.y - point.y);
      newHeight = endPoint.y - point.y + 1;
    }
    if (activeHandle === els.handleB) {
      newHeight = point.y - startPoint.y + 1;
    }

    if (e.shiftKey) {
      const ratio = startWidth / startHeight;
      const currentRatio = newWidth / newHeight;

      if (activeHandle === els.handleL || activeHandle === els.handleR) {
        newHeight = Math.floor(newWidth / ratio);
      } else if (activeHandle === els.handleT || activeHandle === els.handleB) {
        newWidth = Math.floor(newHeight * ratio);
      } else {
        if (currentRatio < ratio) {
          newWidth = Math.floor(newHeight * ratio);
        } else {
          newHeight = Math.floor(newWidth / ratio);
        }
      }

      if (activeHandle === els.handleLT) {
        newX = startLeft + startWidth - newWidth;
        newY = startTop + startHeight - newHeight;
      }
      if (activeHandle === els.handleRT) {
        newY = startTop + startHeight - newHeight;
      }
      if (activeHandle === els.handleLB) {
        newX = startLeft + startWidth - newWidth;
      }
      if (activeHandle === els.handleL) {
        newX = startLeft + startWidth - newWidth;
      }
      if (activeHandle === els.handleT) {
        newY = startTop + startHeight - newHeight;
      }
    }

    const minSize = 1;
    const maxSize = 4096;

    selection.setX(
      clamp(
        newX,
        beforeSelectionPos.x + beforeSelectionPos.width - maxSize,
        beforeSelectionPos.x + beforeSelectionPos.width - minSize,
      ),
    );
    selection.setY(
      clamp(
        newY,
        beforeSelectionPos.y + beforeSelectionPos.height - maxSize,
        beforeSelectionPos.y + beforeSelectionPos.height - minSize,
      ),
    );
    selection.setWidth(clamp(newWidth, minSize, maxSize));
    selection.setHeight(clamp(newHeight, minSize, maxSize));

    if (paintState.toolId == "selection") {
      worker.moveSelection(
        selection.x,
        selection.y,
        selection.width,
        selection.height,
      );
    }

    if (paintState.toolId == "resize") {
    }
  }

  // 전역 MOUSEUP 이벤트 핸들러
  function onMouseUp() {
    if (paintState.action != "BRUSH") return;
    if (!activeHandle) return;

    console.log(endPoint);
    activeHandle = null;

    if (paintState.toolId == "resize") {
      position.setX(position.x + selection.x);
      position.setY(position.y + selection.y);

      let x = selection.x;
      let y = selection.y;
      selection.setX(0);
      selection.setY(0);
      console.log("resize!!!");
      changeCanvasSize(x, y, selection.width, selection.height);
    }

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

    selection.hideHint(false);
  } else {
    applySelection();
    paintState.setToolId("select");
  }
}
