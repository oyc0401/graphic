/** position.ts */
import { paintState } from "../main";
import { cancel } from "../draw";
import { dispatch } from "./pointerEvents";
import {
  position,
  renderChangedPosition,
  setMagification,
  to_screen_coord,
} from "../position";
const MIN_SCALE = 0.125;
const MAX_SCALE = 120;
const twoFingerTapInterval = 75; // 이중클릭 범위
const doubleTapInterval = 250; // 더블클릭 범위

export const pointers = new Map(); // pointerId -> {x, y} 저장

export function addGestureEvent() {
  let pointerIndex = 0;

  let lastPinchDistance;
  let lastPinchCenterPos;
  let firstPointerTime = 0;
  let lastDoubleTouchTime = 0;
  let moveDistance = 0;
  

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

  window.addEventListener(
    "pointerdown",
    (event) => {
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
        paintState.setPointerdown(true);
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
          dispatch(event, "up");
        }
        paintState.setPointerdown(false);
        paintState.setDrawing(false);

        console.log("두 손가락 감지됨, 핀치 줌 시작");
        paintState.setAction("PINCH");

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

      renderChangedPosition();
    },
    true,
  );

  window.addEventListener(
    "pointerup",
    (event) => {
      paintState.setPointerdown(false);
      paintState.setDrawing(false);

      if (pointers.has(event.pointerId)) {
        pointers.delete(event.pointerId);
        // console.log("포인터 제거!", event.pointerId);
      }

      // 핀치 줌
      if (paintState.action !== "PINCH") return;

      if (pointers.size == 0) {
        paintState.setAction("BRUSH");
      }
    },
    true,
  );

  window.addEventListener(
    "pointercancel",
    (event) => {
      paintState.setPointerdown(false);
      paintState.setDrawing(false);

      if (pointers.has(event.pointerId)) {
        pointers.delete(event.pointerId);
        console.log("포인터 제거!", event.pointerId);
      }
    },
    true,
  );
}
