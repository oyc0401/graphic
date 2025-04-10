import { paintState } from "./main";
import { cancel, endDrawing } from "./draw";
import { els } from "./elements";
import { getLayerWorker } from "./worker/workerPool";
import { makeAutoObservable } from "mobx";

const MIN_SCALE = 0.1;
let MAX_SCALE = 0;

export class PositionState {
  x = 10;
  y = 10;
  width = 10;
  height = 10;
  scale = 1;
  dpr = 1;
  bouncingRect = { x: 0, y: 0, width: 0, height: 0 };

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

  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  setScale(scale: number) {
    this.scale = scale;
  }
}

export const position = new PositionState();

export function updateBouncingRect() {
  console.log("updateBouncingRect");
  position.bouncingRect = els.container.getBoundingClientRect();
}

export async function resizeScreen() {
  const minW = -position.width;
  const maxW = position.bouncingRect.width / position.scale;
  const clampX = Math.min(maxW, Math.max(minW, position.x));

  const minH = -position.height;
  const maxH = position.bouncingRect.height / position.scale;
  const clampY = Math.min(maxH, Math.max(minH, position.y));

  position.setX(clampX);
  position.setY(clampY);

  const worker = getLayerWorker();
  const pxRatio = getPixelRatio();

  await worker.render(
    position.width,
    position.height,
    position.bouncingRect.width * pxRatio,
    position.bouncingRect.height * pxRatio,
    position.x * pxRatio,
    position.y * pxRatio,
    position.scale,
  );
}

export function setDefaultPosition() {
  updateBouncingRect();

  // 초기 위치 설정
  let percent = 2 / 3;
  let dpr = getPixelRatio();
  let scaledDpr = dpr * percent;
  let width, height;

  if (position.bouncingRect.width > position.bouncingRect.height) {
    // 가로가 김
    width = position.bouncingRect.height * scaledDpr * 1.414;
    height = position.bouncingRect.height * scaledDpr;
  } else {
    // 세로가 김
    width = position.bouncingRect.width * scaledDpr;
    height = position.bouncingRect.width * scaledDpr * 1.414;
  }
  position.dpr = dpr;
  MAX_SCALE = 120 * dpr;

  // 초기 위치 설정
  let x = (position.bouncingRect.width - width / dpr) / 2;
  let y = (position.bouncingRect.height - height / dpr) / 2;

  position.setScale(1);
  position.setWidth(Math.floor(width));
  position.setHeight(Math.floor(height));
  position.setX(Math.floor(x));
  position.setY(Math.floor(y));
}

export function addPositionEvent() {
  addWheelListener();

  addPinchListener();

  addPanningListener();

  addZoomListener();
}

function addWheelListener() {
  /**
   * 휠 스크롤 영역
   */
  (function () {
    window.addEventListener(
      "wheel",
      (event) => {
        // console.log("wheel", event);

        if (event.ctrlKey) {
          event.preventDefault();
          let new_mag;
          if (event.deltaY > 0) {
            new_mag = position.scale / 1.2;
          } else {
            new_mag = position.scale * 1.2;
          }
          const clamped_scale = Math.min(
            MAX_SCALE,
            Math.max(MIN_SCALE, new_mag),
          );
          setMagification(
            clamped_scale,
            to_screen_coord(event.clientX, event.clientY),
          );

          // updateCursorShape();
        } else {
          if (event.shiftKey) {
            let delta = event.deltaY;
            position.setX(position.x - delta / position.scale);
          } else {
            let delta = event.deltaY;
            position.setY(position.y - delta / position.scale);
          }
        }

        resizeScreen();
      },
      { passive: false },
    );
  })();
}
function addPinchListener() {
  function setPinchEvent() {
    paintState.setAction("PINCH");
  }

  function setLastTool() {
    paintState.setAction("BRUSH");
  }

  /**
   * 핀지줌 영역
   */
  (function () {
    let pointerIndex = 0;

    let lastPinchDistance;
    let lastPinchCenterPos;
    let firstPointerTime = 0;
    let lastDoubleTouchTime = 0;

    const twoFingerTapInterval = 75; // 이중클릭 범위
    const doubleTapInterval = 250; // 더블클릭 범위

    function averageTouches() {
      if (pointers.size < 2) throw new Error("포인터가 2개 미만"); // 포인터가 2개 미만이면 평균 계산 불가

      // 1. pointerId를 오름차순 정렬하여 가장 낮은 두 개 선택
      const sortedPointers = [...pointers.values()].sort(
        (a, b) => a.index - b.index,
      );
      const firstPoint = sortedPointers[0];
      const secondPoint = sortedPointers[1];

      // 3. 두 포인터의 평균 좌표 계산
      return {
        x: (firstPoint.clientX + secondPoint.clientX) / 2,
        y: (firstPoint.clientY + secondPoint.clientY) / 2,
      };
    }

    document.addEventListener("gesturestart", (event) => {
      event.preventDefault();
    });

    let pointers = new Map(); // pointerId -> {x, y} 저장

    els.container.addEventListener(
      "pointerdown",
      (event) => {
        event.preventDefault();
        //console.log("pointerdown - captured", event.pointerId);

        if (!pointers.has(event.pointerId)) {
          // console.log("포인터 추가", event.pointerId);
          pointers.set(event.pointerId, {
            index: pointerIndex,
            clientX: event.clientX,
            clientY: event.clientY,
          });
          pointerIndex++;
        } else {
          alert("포인터 아이디가 이미 있는데 또 pointerdown? 버그임");
        }

        // 핀치 줌
        if (pointers.size === 1) {
          firstPointerTime = performance.now();
        }

        if (pointers.size === 2) {
          const elapsed = performance.now() - firstPointerTime;
          if (elapsed <= twoFingerTapInterval) {
            cancel();
            let now = performance.now();
            if (now - lastDoubleTouchTime <= doubleTapInterval) {
              alert(`더블터치! ${now - lastDoubleTouchTime}`);
              lastDoubleTouchTime = 0;
            } else {
              lastDoubleTouchTime = now;
            }
          } else {
            endDrawing();
          }

          console.log("두 손가락 감지됨, 핀치 줌 시작");
          setPinchEvent();

          lastPinchCenterPos = averageTouches();
          const points = Array.from(pointers.values());
          lastPinchDistance = Math.hypot(
            points[0].clientX - points[1].clientX,
            points[0].clientY - points[1].clientY,
          );
        }
      },
      true,
    );

    let moveDistance = 0;

    window.addEventListener(
      "pointermove",
      (event) => {
        if (!pointers.has(event.pointerId)) return;
        if (pointers.size == 1) {
          let lastPointer = pointers.get(event.pointerId);
          let distance = Math.hypot(
            lastPointer.x - event.clientX,
            lastPointer.y - event.clientY,
          );
          moveDistance += distance;
        }
        Object.assign(pointers.get(event.pointerId), {
          clientX: event.clientX,
          clientY: event.clientY,
        });

        // 핀치 줌
        if (paintState.action !== "PINCH") return;
        if (pointers.size < 2) return; // 두 손가락이 없으면 무시

        const pinchCenterPos = averageTouches();
        const dx = lastPinchCenterPos.x - pinchCenterPos.x;
        const dy = lastPinchCenterPos.y - pinchCenterPos.y;

        position.setX(position.x - dx / position.scale);
        position.setY(position.y - dy / position.scale);
        lastPinchCenterPos = pinchCenterPos;

        const points = Array.from(pointers.values());
        const distance = Math.hypot(
          points[0].clientX - points[1].clientX,
          points[0].clientY - points[1].clientY,
        );

        const scaleFactor = distance / lastPinchDistance;
        let newScale = position.scale * scaleFactor;
        const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));

        setMagification(
          clampedScale,
          to_screen_coord(pinchCenterPos.x, pinchCenterPos.y),
        );
        lastPinchDistance = distance;

        resizeScreen();
      },
      true,
    );

    window.addEventListener(
      "pointerup",
      (event) => {
        if (pointers.has(event.pointerId)) {
          pointers.delete(event.pointerId);
          // console.log("포인터 제거!", event.pointerId);
        }

        // 핀치 줌
        if (paintState.action !== "PINCH") return;

        if (pointers.size == 0) {
          setLastTool();
        }
      },
      true,
    );

    window.addEventListener(
      "pointercancel",
      (event) => {
        if (pointers.has(event.pointerId)) {
          pointers.delete(event.pointerId);
          console.log("포인터 제거!", event.pointerId);
        }
      },
      true,
    );
  })();
}
function addPanningListener() {
  /**
   * 마우스 팬 영역
   */
  (function () {
    let lastClientX;
    let lastClientY;

    els.container.addEventListener("pointerdown", (e) => {
      if (paintState.action != "PAN") return;

      lastClientX = e.clientX;
      lastClientY = e.clientY;

      console.log("팬 시작!");
    });

    window.addEventListener("pointermove", (e) => {
      if (paintState.action != "PAN") return;
      if (!paintState.pointerdown) return;

      let dx = lastClientX - e.clientX;
      let dy = lastClientY - e.clientY;
      position.setX(position.x - dx / position.scale);
      position.setY(position.y - dy / position.scale);

      lastClientX = e.clientX;
      lastClientY = e.clientY;
      resizeScreen();
    });

    window.addEventListener("pointerup", (e) => {
      if (paintState.action != "PAN") return;
    });
  })();
}
function addZoomListener() {
  /**
   * 줌 영역
   */
  (function () {
    let sx, sy;
    let ex, ey;
    let activeZoom = false;

    els.container.addEventListener("pointerdown", (e) => {
      if (paintState.action != "ZOOM") return;
      if (activeZoom) return;
      sx = e.clientX;
      sy = e.clientY;
      ex = e.clientX;
      ey = e.clientY;
      activeZoom = true;

      els.zoomArea.style.visibility = "visible";
      console.log("확대");
      els.zoomArea.style.left = `${sx}px`;
      els.zoomArea.style.top = `${sy}px`;
      els.zoomArea.style.width = `0px`;
      els.zoomArea.style.height = `0px`;
    });

    window.addEventListener("pointermove", (e) => {
      if (paintState.action != "ZOOM") return;
      if (!paintState.pointerdown) return;
      if (!activeZoom) return;
      ex = e.clientX;
      ey = e.clientY;
      let startX = sx < ex ? sx : ex;
      let startY = sy < ey ? sy : ey;
      let zoomW = Math.abs(sx - ex);
      let zoomH = Math.abs(sy - ey);
      els.zoomArea.style.left = `${startX}px`;
      els.zoomArea.style.top = `${startY}px`;
      els.zoomArea.style.width = `${zoomW}px`;
      els.zoomArea.style.height = `${zoomH}px`;
    });

    window.addEventListener("pointerup", (e) => {
      if (paintState.action != "ZOOM") return;
      if (!activeZoom) return;

      els.zoomArea.style.visibility = "hidden";
      let cx = (sx + ex) / 2;
      let cy = (sy + ey) / 2;

      let zoomW = Math.abs(sx - ex);
      let zoomH = Math.abs(sy - ey);

      // 그냥 클릭 시
      if (zoomW < 10 || zoomH < 10) {
        let new_mag = position.scale;
        if (e.button === 0) {
          new_mag = position.scale * 1.5;
        } else if (e.button === 2) {
          new_mag = position.scale / 1.5;
        }
        const clamped_scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, new_mag));
        setMagification(clamped_scale, to_screen_coord(e.clientX, e.clientY));
      } else {
        let px = position.bouncingRect.width / zoomW;
        let py = position.bouncingRect.height / zoomH;
        let minScale = px < py ? px : py;

        let topMargin = position.bouncingRect.y;
        let centerX = position.bouncingRect.width / 2;
        let centerY = position.bouncingRect.height / 2;

        let dx = cx - centerX;
        let dy = cy - centerY - topMargin / minScale;
        position.setX(position.x - dx / position.scale);
        position.setY(position.y - dy / position.scale);

        let new_mag = position.scale * minScale;

        // if (e.button === 0) {
        //   new_mag = position.scale * minScale;
        // } else if (e.button === 2) {
        //   new_mag = position.scale / minScale;
        // }

        const clamped_scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, new_mag));

        setMagification(clamped_scale, to_screen_coord(centerX, centerY));
      }

      resizeScreen();

      activeZoom = false;
    });
  })();
}

function setMagification(new_scale, anchor_point) {
  // 확대 전 값을 따로 보관
  const old_scale = position.scale;
  const old_x = position.x;
  const old_y = position.y;

  // 배율만 미리 바꿔놓든, 나중에 바꾸든 상관없지만
  // old_scale를 반드시 먼저 따로 보관하고 써야 함
  position.setScale(new_scale);

  // 화면에서 anchor_point가 고정되려면,
  // (anchor + position)의 스크린 좌표가
  // old_scale 시절과 new_scale 시절이 같아야 함
  //
  // 즉,
  //   (anchor + oldPos) * old_scale  ==  (anchor + newPos) * new_scale
  //
  // 풀어서 새 newPos를 구하면 아래와 같은 공식이 됩니다.
  let newX =
    ((anchor_point.x + old_x) * old_scale) / new_scale - anchor_point.x;
  let newY =
    ((anchor_point.y + old_y) * old_scale) / new_scale - anchor_point.y;
  position.setX(newX);
  position.setY(newY);
}

// 캔버스 상의 좌표로 변환.
export function to_canvas_coord(x, y) {
  let p = to_screen_coord(x, y);
  let px = p.x * getPixelRatio();
  let py = p.y * getPixelRatio();

  return { x: px, y: py };
}

function to_world_coord(screenX, screenY) {
  let worldX =
    (screenX + position.x) * position.scale + position.bouncingRect.x;
  let worldY =
    (screenY + position.y) * position.scale + position.bouncingRect.y;
  return { x: worldX, y: worldY };
}
// 캔버스 픽셀 좌표 → 스크린 좌표로 역변환 함수
function canvas_coord_to_screen_coord(canvasX, canvasY) {
  let px = canvasX / getPixelRatio();
  let py = canvasY / getPixelRatio();
  return { x: px, y: py };
}

export function canvas_coord_to_css_coord({ x, y }) {
  const screen = canvas_coord_to_screen_coord(x, y);
  const world = to_world_coord(screen.x, screen.y);
  return world;
}

// 스크롤시의 좌표로 변환.
export function to_screen_coord(x, y) {
  let px = (x - position.bouncingRect.x) / position.scale - position.x;
  let py = (y - position.bouncingRect.y) / position.scale - position.y;
  return { x: px, y: py };
}

export function to_pixel_canvas_coord(x, y) {
  let point = to_canvas_coord(x, y);
  return {
    x: Math.floor(point.x),
    y: Math.floor(point.y),
  };
}
export function to_pixel_canvas_coord_round(x, y) {
  let point = to_canvas_coord(x, y);
  return {
    x: Math.round(point.x),
    y: Math.round(point.y),
  };
}

async function changeSize(number = 300) {
  let newWidth = number * 2;
  let newHeight = number;

  position.setWidth(newWidth);
  position.setHeight(newHeight);

  resizeScreen();
}

globalThis.changeSize = changeSize;

let dpr;
export function getPixelRatio() {
  if (!dpr) {
    dpr = window.devicePixelRatio;
  }
  return dpr;
}
