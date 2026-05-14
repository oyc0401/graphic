import { InputMode, paintState } from "../paintState";
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

// 제스처 처리 흐름을 나타내는 상태값.
type GestureState =
  | "Ready"
  | "Draw"
  | "Pinch"
  | "PinchOver"
  | "PinchFinish"
  | "PinchFinish2"
  | "PinchFinish3";

// 제스처 계산에 필요한 포인터 정보만 따로 저장한다.
type TrackedPointer = {
  pointerId: number;
  index: number;
  clientX: number;
  clientY: number;
};

// 현재 추적 중인 포인터들을 pointerId 기준으로 저장한다.
const pointers = new Map<number, TrackedPointer>();

// Gesture에서는 추적하지만 draw/tool 쪽으로는 전달하지 않을 포인터 목록.
const blockedPointerIds = new Set<number>();

export function addGestureEvent() {
  // pointerId와 별개로, 실제로 몇 번째로 눌렸는지 기록하기 위한 카운터.
  let pointerIndexCounter = 0;

  // 현재 제스처 상태. 처음에는 아무 입력도 없는 Ready 상태다.
  let state: GestureState = "Ready";

  // 제스처 상태 전이를 한 곳에서 수행한다.
  function setState(nextState: GestureState) {
    state = nextState;
  }

  // 직전 pinch 프레임의 두 손가락 사이 거리.
  let lastPinchDistance = 0;

  // 직전 pinch 프레임의 두 손가락 중심점.
  let lastPinchCenterPos = { x: 0, y: 0 };

  // 탭/제스처 시간 판정에 쓰는 기준 시각.
  let pointerdownTime = 0;

  // 두 포인터의 가운데 지점을 구한다.
  function averageTouches(
    firstPointer: TrackedPointer,
    secondPointer: TrackedPointer,
  ) {
    return {
      x: (firstPointer.clientX + secondPointer.clientX) / 2,
      y: (firstPointer.clientY + secondPointer.clientY) / 2,
    };
  }

  // 해당 pointerId를 현재 추적 중인지 확인한다.
  function hasPointer(pointerId: number) {
    return pointers.has(pointerId);
  }

  // 입력된 순서대로 포인터를 정렬해서 반환한다.
  function getPointers() {
    return Array.from(pointers.values()).sort((a, b) => a.index - b.index);
  }

  // 새 pointerdown을 추적 목록에 등록한다.
  function addPointer(event: PointerEvent) {
    if (pointers.has(event.pointerId)) {
      alert("포인터 아이디가 이미 있는데 또 pointerdown? 버그임");
      return;
    }

    pointers.set(event.pointerId, {
      pointerId: event.pointerId,
      index: pointerIndexCounter,
      clientX: event.clientX,
      clientY: event.clientY,
    });
    pointerIndexCounter++;
  }

  // pointerup/cancel된 포인터를 추적 목록에서 제거한다.
  function endPointer(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return false;

    paintState.setPointerdown(false);
    paintState.setDrawing(false);
    pointers.delete(event.pointerId);
    return true;
  }

  // pointermove 때 최신 좌표로 갱신한다.
  function updatePointer(event: PointerEvent) {
    if (!hasPointer(event.pointerId)) {
      throw new Error(`추적하지 않는 포인터 업데이트: ${event.pointerId}`);
    }

    const pointer = pointers.get(event.pointerId);
    if (!pointer) {
      throw new Error(`추적하지 않는 포인터 업데이트: ${event.pointerId}`);
    }

    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
  }

  // draw 중 pinch로 전환될 때, 기존 draw 입력을 강제로 종료시키는 up 이벤트를 만든다.
  function dispatchUpForPointer(pointer: TrackedPointer, event: PointerEvent) {
    const upEvent = new PointerEvent("pointerup", {
      bubbles: event.bubbles,
      cancelable: event.cancelable,
      composed: event.composed,
      pointerId: pointer.pointerId,
      pointerType: event.pointerType,
      isPrimary: pointer.index === 0,
      clientX: pointer.clientX,
      clientY: pointer.clientY,
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

  // 두 포인터를 기준으로 pinch 제스처를 시작한다.
  function startPinch(
    firstPointer: TrackedPointer,
    secondPointer: TrackedPointer,
  ) {
    paintState.setPointerdown(false);
    paintState.setDrawing(false);
    paintState.setInputMode(InputMode.Pinch);

    blockedPointerIds.add(firstPointer.pointerId);
    blockedPointerIds.add(secondPointer.pointerId);

    lastPinchCenterPos = averageTouches(firstPointer, secondPointer);
    lastPinchDistance = Math.hypot(
      firstPointer.clientX - secondPointer.clientX,
      firstPointer.clientY - secondPointer.clientY,
    );
  }

  // pinch 중인 두 손가락의 이동/거리 변화로 pan과 zoom을 처리한다.
  function updatePinch(
    firstPointer: TrackedPointer,
    secondPointer: TrackedPointer,
  ) {
    const pinchCenterPos = averageTouches(firstPointer, secondPointer);
    const dx = lastPinchCenterPos.x - pinchCenterPos.x;
    const dy = lastPinchCenterPos.y - pinchCenterPos.y;

    // 화면 좌표 이동량을 캔버스 내부 좌표 이동량으로 바꾼다.
    // 현재 zoom 배율과 디바이스 픽셀 비율을 반영해야 손가락 이동과 화면 이동이 자연스럽다.
    const diffX = (dx / position.scale) * getPixelRatio();
    const diffY = (dy / position.scale) * getPixelRatio();

    position.setX(position.x - diffX);
    position.setY(position.y - diffY);
    lastPinchCenterPos = pinchCenterPos;

    const distance = Math.hypot(
      firstPointer.clientX - secondPointer.clientX,
      firstPointer.clientY - secondPointer.clientY,
    );

    // 두 손가락 사이 거리가 얼마나 변했는지로 zoom 비율을 계산한다.
    const scaleFactor = distance / lastPinchDistance;
    const newScale = position.scale * scaleFactor;
    const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));

    // pinch 중심점을 기준으로 확대/축소해야 손가락 사이 지점이 고정된 것처럼 보인다.
    setMagification(
      clampedScale,
      to_screen_coord(pinchCenterPos.x, pinchCenterPos.y),
    );
    lastPinchDistance = distance;

    renderChangedPosition();
  }

  // draw 중 두 번째 포인터가 들어오면 pinch 상태로 전환한다.
  function enterPinch(event: PointerEvent, now: number) {
    // pinch용 포인터는 제스처 계산에는 쓰지만, draw/tool 쪽에는 내려보내지 않는다.
    blockPointerEvent(event);
    addPointer(event);

    const points = getPointers();
    if (points.length < 2) return;

    pointerdownTime = now;
    startPinch(points[0], points[1]);
    setState("Pinch");
  }

  // 현재 이벤트를 막고, 새 pointerId면 이후 이벤트도 tool/root 쪽으로 내려가지 않게 등록한다.
  function blockPointerEvent(event: PointerEvent) {
    event.stopImmediatePropagation();
    if (!hasPointer(event.pointerId)) {
      blockedPointerIds.add(event.pointerId);
    }
  }

  // 현재 포인터가 tool/root 쪽으로 내려가면 안 되는 blocked 포인터인지 확인한다.
  function isBlockedPointerId(pointerId: number) {
    return blockedPointerIds.has(pointerId);
  }

  // 제스처 상태를 초기화한다.
  function finishGesture() {
    setState("Ready");
    pointerIndexCounter = 0;
    pointerdownTime = 0;

    if (pointers.size === 0 && paintState.getInputMode() === InputMode.Pinch) {
      paintState.setInputMode(InputMode.DEFAULT);
    }
  }

  window.addEventListener(
    "pointerdown",
    (event) => {
      // 이미 제스처가 가져간 포인터면 draw/tool 쪽으로 보내지 않는다.
      if (isBlockedPointerId(event.pointerId)) {
        blockPointerEvent(event);
        return;
      }

      const now = performance.now();

      switch (state) {
        case "Ready":
          // 첫 포인터는 draw 시작 후보로 등록한다.
          addPointer(event);

          paintState.setPointerdown(true);
          pointerdownTime = now;
          setState("Draw");
          return;

        case "Draw": {
          // draw 중 두 번째 포인터가 들어오면 pinch로 전환한다.
          const d = now - pointerdownTime;

          // 첫 포인터 직후면 draw를 취소하고, 시간이 지났다면 synthetic up으로 draw를 정상 종료한다.
          if (d <= 150) {
            cancel();
          } else {
            dispatchUpForPointer(getPointers()[0], event);
          }

          enterPinch(event, now);
          return;
        }

        case "Pinch": {
          // pinch 시작 직후 세 번째 포인터가 빠르게 들어오면 three-finger gesture 후보로 본다.
          const d = now - pointerdownTime;
          if (d > 150) {
            // 너무 늦게 들어온 추가 포인터는 제스처에 참여시키지 않고 이벤트만 차단한다.
            blockPointerEvent(event);
            return;
          }

          // 빠르게 들어온 세 번째 포인터는 redo 후보로 추적한다.
          blockPointerEvent(event);
          addPointer(event);

          pointerdownTime = now;
          setState("PinchOver");
          return;
        }

        case "PinchOver":
        case "PinchFinish":
        case "PinchFinish2":
        case "PinchFinish3":
          // 제스처 마무리 중 새로 들어온 포인터는 계산에 넣지 않고 이벤트만 차단한다.
          blockPointerEvent(event);
          return;
      }
    },
    true,
  );

  window.addEventListener(
    "pointermove",
    (event) => {
      // blocked 포인터도 pinch 계산에는 필요하므로 차단만 하고 처리는 계속한다.
      if (isBlockedPointerId(event.pointerId)) {
        blockPointerEvent(event);
      }
      if (!hasPointer(event.pointerId)) {
        // 일부 환경에서는 두 번째 pointerdown 없이 move가 먼저 들어올 수 있어 pinch로 복구한다.
        if (state === "Draw") {
          // 2026-05-11: 이거 진짜옴 ㅋㅋㅋㅋㅋ
          // alert("진짜오네");
          const now = performance.now();
          const d = now - pointerdownTime;

          // 첫 포인터 직후면 draw를 취소하고, 시간이 지났다면 synthetic up으로 draw를 정상 종료한다.
          if (d <= 150) {
            cancel();
          } else {
            dispatchUpForPointer(getPointers()[0], event);
          }

          enterPinch(event, now);
        }
        return;
      }

      updatePointer(event);

      if (state === "Pinch" || state === "PinchOver") {
        // pinch 계산에는 입력 순서상 첫 두 포인터만 사용한다.
        const points = getPointers();
        if (points.length < 2) return;

        updatePinch(points[0], points[1]);
      }
    },
    true,
  );

  window.addEventListener(
    "pointerup",
    (event) => {
      // blocked 포인터의 up도 tool 쪽으로 내려보내지 않고 차단 목록에서 제거한다.
      if (isBlockedPointerId(event.pointerId)) {
        blockPointerEvent(event);
      }
      blockedPointerIds.delete(event.pointerId);

      const now = performance.now();
      if (!endPointer(event)) return;

      switch (state) {
        case "Ready":
          return;

        case "Draw":
          // draw 중이던 첫 포인터가 끝났으므로 제스처도 종료한다.
          finishGesture();
          return;

        case "Pinch":
          // 두 포인터 중 하나가 먼저 끝나면 two-finger tap 후보 상태로 넘어간다.
          setState("PinchFinish");
          return;

        case "PinchFinish": {
          // 두 손가락이 짧은 시간 안에 모두 끝났다면 undo로 처리한다.
          const d = now - pointerdownTime;
          if (d <= 150) {
            undo();
          }
          finishGesture();
          return;
        }

        case "PinchOver":
          // 세 포인터 중 첫 번째가 끝난 상태.
          setState("PinchFinish2");
          return;

        case "PinchFinish2":
          // 세 포인터 중 두 번째가 끝난 상태.
          setState("PinchFinish3");
          return;

        case "PinchFinish3": {
          // 세 손가락이 짧은 시간 안에 모두 끝났다면 redo로 처리한다.
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
      // cancel도 up처럼 차단 해제와 추적 종료를 먼저 처리한다.
      if (isBlockedPointerId(event.pointerId)) {
        blockPointerEvent(event);
      }
      blockedPointerIds.delete(event.pointerId);
      if (!endPointer(event)) return;

      switch (state) {
        case "Ready":
          return;

        case "Draw":
        case "PinchFinish":
        case "PinchFinish3":
          // 더 이어갈 포인터 조합이 없으면 제스처를 초기화한다.
          finishGesture();
          return;

        case "Pinch":
          // 두 포인터 중 하나가 취소되면 two-finger 종료 후보로 본다.
          setState("PinchFinish");
          return;

        case "PinchOver":
          // 세 포인터 중 하나가 취소된 상태.
          setState("PinchFinish2");
          return;

        case "PinchFinish2":
          // 세 포인터 중 두 번째가 취소된 상태.
          setState("PinchFinish3");
          return;
      }
    },
    true,
  );
}
