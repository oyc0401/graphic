import { paintState } from "../paintState";
import { cancel } from "../draw";
import { dispatch } from "./pointerEvents";
import {
  getPixelRatio,
  position,
  renderChangedPosition,
  setMagification,
  to_screen_coord,
} from "../position";
import { redo, undo } from "../history";

const MIN_SCALE = 0.125;
const MAX_SCALE = 120;

type GestureState =
  | "Ready"
  | "Draw"
  | "Pinch"
  | "PinchOver"
  | "PinchFinish"
  | "PinchFinish2"
  | "PinchFinish3";

type TrackedPointer = {
  pointerId: number;
  index: number;
  clientX: number;
  clientY: number;
};

const pointers = new Map<number, TrackedPointer>();
// Gesture에서는 계속 추적하지만 pointerEvents/tool 레이어로는 내려보내지 않을 pointerId 목록.
const blockedPointerIds = new Set<number>();

export function addGestureEvent() {
  // 추적 포인터의 입력 순서를 보존하기 위한 auto-increment counter.
  let pointerIndexCounter = 0;

  // 현재 gesture state-machine 상태.
  let state: GestureState = "Ready";

  // 직전 pinch 프레임의 두 포인터 거리.
  let lastPinchDistance = 0;

  // 직전 pinch 프레임의 두 포인터 중심점.
  let lastPinchCenterPos = { x: 0, y: 0 };

  // 마지막으로 pointerdown이 발생한 시간.
  let pointerdownTime = 0;

  // 추적 중인 첫 두 포인터의 화면 좌표 평균을 구한다.
  function averageTouches() {
    if (pointers.size < 2) throw new Error("포인터가 2개 미만");

    const sortedPointers = Array.from(pointers.values()).sort(
      (a, b) => a.index - b.index,
    );
    const firstPoint = sortedPointers[0];
    const secondPoint = sortedPointers[1];

    return {
      x: (firstPoint.clientX + secondPoint.clientX) / 2,
      y: (firstPoint.clientY + secondPoint.clientY) / 2,
    };
  }

  // 새 pointerdown을 gesture 추적 목록에 등록한다.
  function addPointer(event: PointerEvent) {
    if (pointers.has(event.pointerId)) {
      alert(
        "포인터 아이디가 이미 있는데 또 pointerdown? 버그임 근데 이문제 자꾸 나는데 꼭 해결해야함",
      );
      return false;
    }

    pointers.set(event.pointerId, {
      pointerId: event.pointerId,
      index: pointerIndexCounter,
      clientX: event.clientX,
      clientY: event.clientY,
    });
    pointerIndexCounter++;
    return true;
  }

  // 추적 중인 포인터의 최신 화면 좌표를 갱신한다.
  function updatePointer(event: PointerEvent) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return false;

    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
    return true;
  }

  // gesture에 처음 들어온 순서 기준으로 첫 두 포인터를 반환한다.
  function firstTwoPointers() {
    return Array.from(pointers.values())
      .sort((a, b) => a.index - b.index)
      .slice(0, 2);
  }

  // draw를 끝내기 위해 첫 번째 포인터 위치에서 synthetic up을 보낸다.
  function dispatchUpForFirstPointer(event: PointerEvent) {
    const firstPointer = firstTwoPointers()[0];
    const upEvent = new PointerEvent(event.type, {
      bubbles: event.bubbles,
      cancelable: event.cancelable,
      composed: event.composed,
      pointerId: firstPointer.pointerId,
      pointerType: event.pointerType,
      isPrimary: firstPointer.index === 0,
      clientX: firstPointer.clientX,
      clientY: firstPointer.clientY,
      button: event.button,
      buttons: event.buttons,
      pressure: event.pressure,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
    });

    dispatch(upEvent, "up");
  }

  // 현재 첫 두 포인터로 pinch 상태를 초기화한다.
  function startPinch() {
    paintState.setPointerdown(false);
    paintState.setDrawing(false);
    paintState.setInputMode("PINCH");

    const points = firstTwoPointers();
    blockedPointerIds.add(points[0].pointerId);
    blockedPointerIds.add(points[1].pointerId);

    lastPinchCenterPos = averageTouches();
    lastPinchDistance = Math.hypot(
      points[0].clientX - points[1].clientX,
      points[0].clientY - points[1].clientY,
    );
  }

  // pinch 중 두 포인터의 이동/거리 변화로 화면 위치와 배율을 갱신한다.
  function updatePinch() {
    if (pointers.size < 2) return;

    const pinchCenterPos = averageTouches();
    const dx = lastPinchCenterPos.x - pinchCenterPos.x;
    const dy = lastPinchCenterPos.y - pinchCenterPos.y;

    const diffX = (dx / position.scale) * getPixelRatio();
    const diffY = (dy / position.scale) * getPixelRatio();

    position.setX(position.x - diffX);
    position.setY(position.y - diffY);
    lastPinchCenterPos = pinchCenterPos;

    const points = firstTwoPointers();
    const distance = Math.hypot(
      points[0].clientX - points[1].clientX,
      points[0].clientY - points[1].clientY,
    );

    const scaleFactor = distance / lastPinchDistance;
    const newScale = position.scale * scaleFactor;
    const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));

    setMagification(
      clampedScale,
      to_screen_coord(pinchCenterPos.x, pinchCenterPos.y),
    );
    lastPinchDistance = distance;

    renderChangedPosition();
  }

  // gesture 상태와 시간 기준값을 초기 상태로 되돌린다.
  function finishGesture() {
    state = "Ready";
    pointerIndexCounter = 0;
    pointerdownTime = 0;

    if (pointers.size === 0 && paintState.inputMode === "PINCH") {
      paintState.restoreSelectedToolMode();
    }
  }

  // pointerup/cancel된 포인터를 추적 목록에서 제거한다.
  function endPointer(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return false;

    paintState.setPointerdown(false);
    paintState.setDrawing(false);
    pointers.delete(event.pointerId);
    return true;
  }

  // 현재 이벤트가 tool/root 리스너로 더 내려가지 않게 막는다.
  function blockPointerEvent(event: PointerEvent) {
    event.stopImmediatePropagation();
  }

  // 이 포인터를 gesture 소유로 표시하고 현재 이벤트를 차단한다.
  function claimForGesture(event: PointerEvent) {
    blockedPointerIds.add(event.pointerId);
    blockPointerEvent(event);
  }

  // 아직 추적하지 않는 새 포인터만 gesture 소유로 표시한다.
  function claimNewPointerForGesture(event: PointerEvent) {
    if (pointers.has(event.pointerId)) {
      blockPointerEvent(event);
      return;
    }

    claimForGesture(event);
  }

  // 새 포인터를 추적 목록과 gesture 소유 목록에 함께 등록한다.
  function addPointerForGesture(event: PointerEvent) {
    blockPointerEvent(event);

    if (!addPointer(event)) {
      return false;
    }

    blockedPointerIds.add(event.pointerId);
    return true;
  }

  // gesture 소유 포인터의 이벤트면 tool/root 리스너로 내려가지 않게 막는다.
  function blockIfGestureOwned(event: PointerEvent) {
    if (!blockedPointerIds.has(event.pointerId)) return false;

    blockPointerEvent(event);
    return true;
  }

  // 두 번째 포인터를 기준으로 draw를 종료하고 pinch 상태로 전환한다.
  function enterPinch(event: PointerEvent, now: number) {
    const d = now - pointerdownTime;
    if (!addPointerForGesture(event)) return false;

    if (d <= 150) {
      cancel();
    } else {
      dispatchUpForFirstPointer(event);
    }

    pointerdownTime = now;
    startPinch();
    state = "Pinch";
    return true;
  }

  window.addEventListener(
    "pointerdown",
    (event) => {
      if (blockIfGestureOwned(event)) return;

      const now = performance.now();

      switch (state) {
        case "Ready":
          if (!addPointer(event)) return;

          paintState.setPointerdown(true);
          pointerdownTime = now;
          state = "Draw";
          return;

        case "Draw": {
          enterPinch(event, now);
          return;
        }

        case "Pinch": {
          const d = now - pointerdownTime;
          if (d > 150) {
            claimNewPointerForGesture(event);
            return;
          }

          if (!addPointerForGesture(event)) return;

          pointerdownTime = now;
          state = "PinchOver";
          return;
        }

        case "PinchOver":
        case "PinchFinish":
        case "PinchFinish2":
        case "PinchFinish3":
          claimNewPointerForGesture(event);
          return;
      }
    },
    true,
  );

  window.addEventListener(
    "pointermove",
    (event) => {
      blockIfGestureOwned(event);
      if (!updatePointer(event)) {
        if (state === "Draw") {
          enterPinch(event, performance.now());
        }
        return;
      }

      if (state === "Pinch" || state === "PinchOver") {
        updatePinch();
      }
    },
    true,
  );

  window.addEventListener(
    "pointerup",
    (event) => {
      blockIfGestureOwned(event);
      blockedPointerIds.delete(event.pointerId);

      const now = performance.now();
      if (!endPointer(event)) return;

      switch (state) {
        case "Ready":
          return;

        case "Draw":
          finishGesture();
          return;

        case "Pinch":
          state = "PinchFinish";
          return;

        case "PinchFinish": {
          const d = now - pointerdownTime;
          if (d <= 150) {
            undo();
          }
          finishGesture();
          return;
        }

        case "PinchOver":
          state = "PinchFinish2";
          return;

        case "PinchFinish2":
          state = "PinchFinish3";
          return;

        case "PinchFinish3": {
          const d = now - pointerdownTime;
          if (d <= 200) {
            redo();
          }
          finishGesture();
          return;
        }
      }
    },
    true,
  );

  window.addEventListener(
    "pointercancel",
    (event) => {
      blockIfGestureOwned(event);
      blockedPointerIds.delete(event.pointerId);
      if (!endPointer(event)) return;

      switch (state) {
        case "Ready":
          return;

        case "Draw":
        case "PinchFinish":
        case "PinchFinish3":
          finishGesture();
          return;

        case "Pinch":
          state = "PinchFinish";
          return;

        case "PinchOver":
          state = "PinchFinish2";
          return;

        case "PinchFinish2":
          state = "PinchFinish3";
          return;
      }
    },
    true,
  );
}
