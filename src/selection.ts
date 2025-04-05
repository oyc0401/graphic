import { paintState } from "./main";
import { applyKeyAction, elementStore, updateCursorShape } from "./interface";
import { getPixelRatio, position, to_pixel_canvas_coord } from "./position";
import { getLayerWorker } from "./worker/workerPool";
import * as Comlink from "comlink";

export let selection = {
  x: 0,
  y: 0,
  width: 300,
  height: 200,
  visiable: false,
  active: false,
};

let beforeSelectionPos = {
  x: 0,
  y: 0,
  width: 50,
  height: 50,
};

export function addSelectionEvent() {
  let selectionDragPointer = { x: 0, y: 0 };
  (function () {
    elementStore.selectionArea.addEventListener(
      "pointerdown",
      function (e: PointerEvent) {
        e.preventDefault();
        if (!paintState.pointerdown) return;
        if (paintState.action != "BRUSH") return;

        let point = to_pixel_canvas_coord(e.clientX, e.clientY);
        const worker = getLayerWorker();

        if (paintState.toolId == "selection") {
          console.log("선택창 시작!");
          selection.active = true;

          selectionDragPointer = {
            x: point.x - selection.x,
            y: point.y - selection.y,
          };
        }
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

      if (paintState.toolId == "selection") {
        let newSelectionX = point.x - selectionDragPointer.x;
        let newSelectionY = point.y - selectionDragPointer.y;

        selection.x = newSelectionX;
        selection.y = newSelectionY;
        worker.moveSelection(
          selection.x,
          selection.y,
          selection.width,
          selection.height,
        );

        setSelectionPosition();
      }
    });

    window.addEventListener("pointerup", (e) => {
      e.preventDefault();
      if (paintState.action != "BRUSH") return;
      if (!selection.active) return;

      let point = to_pixel_canvas_coord(e.clientX, e.clientY);
      const worker = getLayerWorker();
      if (paintState.toolId == "selection") {
        beforeSelectionPos = {
          x: selection.x,
          y: selection.y,
          width: selection.width,
          height: selection.height,
        };
      }

      selection.active = false;
      applyKeyAction();
      updateCursorShape();
    });
  })();

  addHandleEvent();
}

/**
 * 붙여넣기: 클립보드에서 ImageBitmap 얻어서, 워커로 전달
 */
export async function paste() {
  applySelection();

  let worker = getLayerWorker();
  let bitmap = await getClipboardImageBitmap();
  if (!bitmap) {
    console.warn("클립보드에 복사 된 이미지가 없습니다.");
    return;
  }

  // 실제 붙여넣기 로직
  handleImageBitmap(bitmap);
  console.log("붙여넣기!");
}

/**
 * 실제로 ImageBitmap을 받아서 selection에 그리기
 */
function handleImageBitmap(bitmap: ImageBitmap) {
  let worker = getLayerWorker();

  let newWidth = bitmap.width;
  let newHeight = bitmap.height;

  // 선택 영역 설정
  selection.x = 0;
  selection.y = 0;
  selection.width = newWidth;
  selection.height = newHeight;

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
    Comlink.transfer(bitmap, [bitmap])
  );

  paintState.toolId = "selection";
  selection.visiable = true;
  setSelectionPosition();
}

/**
 * 브라우저 클립보드에서 ImageBitmap 얻기
 * (브라우저 권한/환경에 따라 Windows 탐색기에서 복사된 파일은
 * 인식이 안 될 수도 있음)
 */
async function getClipboardImageBitmap(): Promise<ImageBitmap | null> {
  try {
    const items = await navigator.clipboard.read(); // 권한 필요

    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith("image/")) {
          const blob = await item.getType(type);
          const bitmap = await createImageBitmap(blob, {
            imageOrientation: "flipY",
          });
          return bitmap;
        }
      }
    }

    console.warn("No image found in clipboard.");
    return null;
  } catch (err) {
    console.error("Clipboard access failed:", err);
    return null;
  }
}

/**
 * 드래그 앤 드롭 기능을 초기화하는 함수
 * @param dropAreaSelector 드래그 앤 드롭 받을 영역의 셀렉터 (예: '#dropArea')
 */
 function setupDragAndDrop(dropAreaSelector: string) {
  const dropArea = document.querySelector(dropAreaSelector);
  if (!dropArea) {
    console.error("드롭 영역을 찾을 수 없습니다:", dropAreaSelector);
    return;
  }

  // 드래그가 영역 위로 올라왔을 때 기본 이벤트 방지
  dropArea.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  // 실제 드롭이 발생했을 때
  dropArea.addEventListener("drop", async (e) => {
    e.preventDefault();
    const dt = e.dataTransfer;
    if (!dt || !dt.files.length) return;

    // 여러 파일을 드롭할 수도 있으므로 루프
    for (const file of dt.files) {
      // 이미지 파일인지 확인
      if (file.type.startsWith("image/")) {
        try {
          // 파일을 ImageBitmap으로 변환
          const bitmap = await createImageBitmap(file, {
            imageOrientation: "flipY",
          });
          console.log("드래그 앤 드롭으로 가져온 이미지:", file.name);

          // 붙여넣기 로직 호출
          applySelection();
          handleImageBitmap(bitmap);
        } catch (err) {
          console.error("드롭된 이미지를 처리 중 에러:", err);
        }
      } else {
        console.warn("이미지 형식이 아닌 파일은 무시합니다:", file.type);
      }
    }
  });
}

setupDragAndDrop('#container');



export async function copy(){
  let worker = getLayerWorker();
  worker.copy();
}












export function canvasSelect(x, y, width, height) {
  let worker = getLayerWorker();

  selection.x = x;
  selection.y = y;
  selection.width = width;
  selection.height = height;

  worker.cut(
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

  // position.resizeScreen();
  paintState.toolId = "selection";

  console.log("자르기!");
  selection.visiable = true;
  setSelectionPosition();
}

export function applySelection() {
  let worker = getLayerWorker();

  selection.visiable = false;
  worker.applySelection();
  setSelectionPosition();
}

export function setSelectionPosition() {
  elementStore.selectionArea.style.visibility = selection.visiable
    ? "visible"
    : "hidden";

  elementStore.selectionArea.style.left = `${(selection.x / getPixelRatio() + position.x) * position.scale}px`;
  elementStore.selectionArea.style.top = `${(selection.y / getPixelRatio() + position.y) * position.scale}px`;
  elementStore.selectionArea.style.width = `${(selection.width * position.scale) / getPixelRatio()}px`;
  elementStore.selectionArea.style.height = `${(selection.height * position.scale) / getPixelRatio()}px`;

  setHandlePosition();
}

let handleLT = document.getElementById("handle-lt")!;
let handleT = document.getElementById("handle-t")!;
let handleRT = document.getElementById("handle-rt")!;
let handleR = document.getElementById("handle-r")!;
let handleRB = document.getElementById("handle-rb")!;
let handleB = document.getElementById("handle-b")!;
let handleLB = document.getElementById("handle-lb")!;
let handleL = document.getElementById("handle-l")!;

let activeHandle: HTMLElement | null = null;

function addHandleEvent() {
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
    if (activeHandle === handleR) {
      // 오른쪽 중앙: 폭만 늘어남
      selection.width = Math.max(0, startWidth + dx);
    } else if (activeHandle === handleL) {
      // 왼쪽 중앙: x와 width가 반대 방향으로 조정
      selection.x = Math.min(startLeft + startWidth, startLeft + dx);
      selection.width = Math.max(0, startWidth - dx);
    } else if (activeHandle === handleT) {
      // 위 중앙: y와 height
      selection.y = Math.min(startTop + startHeight, startTop + dy);
      selection.height = Math.max(0, startHeight - dy);
    } else if (activeHandle === handleB) {
      // 아래 중앙: 높이만 늘어남
      selection.height = Math.max(0, startHeight + dy);
    } else if (activeHandle === handleLT) {
      // 왼쪽 위 모서리: x, width, y, height 모두 영향
      selection.x = Math.min(startLeft + startWidth, startLeft + dx);
      selection.width = Math.max(0, startWidth - dx);
      selection.y = Math.min(startTop + startHeight, startTop + dy);
      selection.height = Math.max(0, startHeight - dy);

      // SHIFT + 비율 고정
      if (e.shiftKey && startWidth !== 0 && startHeight !== 0) {
        const ratio = startWidth / startHeight;
        // 현재 비율과 비교 후 보정
        const currentRatio = selection.width / selection.height;
        if (currentRatio < ratio) {
          selection.width = selection.height * ratio;
        } else {
          selection.height = selection.width / ratio;
        }
        // '오른쪽 아래' 모서리를 고정하려면:
        selection.x = startLeft + startWidth - selection.width;
        selection.y = startTop + startHeight - selection.height;
      }
    } else if (activeHandle === handleRT) {
      // 오른쪽 위 모서리: width, y, height
      selection.width = Math.max(0, startWidth + dx);
      selection.y = Math.min(startTop + startHeight, startTop + dy);
      selection.height = Math.max(0, startHeight - dy);

      if (e.shiftKey && startWidth !== 0 && startHeight !== 0) {
        const ratio = startWidth / startHeight;
        const currentRatio = selection.width / selection.height;
        if (currentRatio < ratio) {
          selection.width = selection.height * ratio;
        } else {
          selection.height = selection.width / ratio;
        }
        // '왼쪽 아래' 모서리를 고정
        selection.x = startLeft;
        selection.y = startTop + startHeight - selection.height;
      }
    } else if (activeHandle === handleRB) {
      // 오른쪽 아래 모서리: width, height
      selection.width = Math.max(0, startWidth + dx);
      selection.height = Math.max(0, startHeight + dy);

      if (e.shiftKey && startWidth !== 0 && startHeight !== 0) {
        const ratio = startWidth / startHeight;
        const currentRatio = selection.width / selection.height;
        if (currentRatio < ratio) {
          selection.width = selection.height * ratio;
        } else {
          selection.height = selection.width / ratio;
        }
        // '왼쪽 위' 모서리 고정
        selection.x = startLeft;
        selection.y = startTop;
      }
    } else if (activeHandle === handleLB) {
      // 왼쪽 아래 모서리: x, width, height
      selection.x = Math.min(startLeft + startWidth, startLeft + dx);
      selection.width = Math.max(0, startWidth - dx);
      selection.height = Math.max(0, startHeight + dy);

      if (e.shiftKey && startWidth !== 0 && startHeight !== 0) {
        const ratio = startWidth / startHeight;
        const currentRatio = selection.width / selection.height;
        if (currentRatio < ratio) {
          selection.width = selection.height * ratio;
        } else {
          selection.height = selection.width / ratio;
        }
        // '오른쪽 위' 모서리를 고정
        selection.x = startLeft + startWidth - selection.width;
        selection.y = startTop;
      }
    }

    // 쉬프트 시 비율 고정
    if (activeHandle === handleT || activeHandle === handleB) {
      if (e.shiftKey && startWidth !== 0 && startHeight !== 0) {
        const ratio = startWidth / startHeight;
        selection.width = selection.height * ratio;
      } else {
        selection.width = startWidth;
      }
    }

    if (activeHandle === handleL || activeHandle === handleR) {
      if (e.shiftKey && startWidth !== 0 && startHeight !== 0) {
        const ratio = startWidth / startHeight;
        selection.height = selection.width / ratio;
      } else {
        selection.height = startHeight;
      }
    }

    worker.moveSelection(
      selection.x,
      selection.y,
      selection.width,
      selection.height,
    );

    setSelectionPosition();
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
    handleLT,
    handleT,
    handleRT,
    handleR,
    handleRB,
    handleB,
    handleLB,
    handleL,
  ];
  for (const handle of handles) {
    handle.addEventListener("pointerdown", (e) => onMouseDown(e, handle));
  }

  // 전역에 mousemove, mouseup 이벤트 등록 (드래그 추적)
  document.addEventListener("pointermove", onMouseMove);
  document.addEventListener("pointerup", onMouseUp);
}

function visiableOrHideHandle() {
  const handles = [
    handleLT,
    handleT,
    handleRT,
    handleR,
    handleRB,
    handleB,
    handleLB,
    handleL,
  ];

  for (const handle of handles) {
    handle.style.visibility = selection.visiable ? "visible" : "hidden";
  }
}

function setHandlePosition() {
  // selectionArea의 절대 위치 및 크기 계산
  const areaLeft =
    (selection.x / getPixelRatio() + position.x) * position.scale;
  const areaTop = (selection.y / getPixelRatio() + position.y) * position.scale;
  const areaWidth = (selection.width * position.scale) / getPixelRatio();
  const areaHeight = (selection.height * position.scale) / getPixelRatio();
  const offset = 22; // 핸들 크기 44px 기준 중심 정렬 보정값

  visiableOrHideHandle();

  // 각 핸들의 위치 설정
  const setPos = (handle: HTMLElement, left: number, top: number) => {
    handle.style.left = `${left - offset}px`;
    handle.style.top = `${top - offset}px`;
  };

  setPos(handleLT, areaLeft, areaTop);
  setPos(handleT, areaLeft + areaWidth / 2, areaTop);
  setPos(handleRT, areaLeft + areaWidth, areaTop);
  setPos(handleR, areaLeft + areaWidth, areaTop + areaHeight / 2);
  setPos(handleRB, areaLeft + areaWidth, areaTop + areaHeight);
  setPos(handleB, areaLeft + areaWidth / 2, areaTop + areaHeight);
  setPos(handleLB, areaLeft, areaTop + areaHeight);
  setPos(handleL, areaLeft, areaTop + areaHeight / 2);
}

export function selectionCancel() {
  selection.active = false;

  console.log(beforeSelectionPos);
  selection.x = beforeSelectionPos.x;
  selection.y = beforeSelectionPos.y;
  selection.width = beforeSelectionPos.width;
  selection.height = beforeSelectionPos.height;

  const worker = getLayerWorker();

  worker.moveSelection(
    selection.x,
    selection.y,
    selection.width,
    selection.height,
  );

  setSelectionPosition();

  activeHandle = null;
}
