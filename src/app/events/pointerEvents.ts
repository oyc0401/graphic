import { paintState } from "../paintState";
import { toolRegistry } from "../tools/toolRegistry";
import { panTool } from "../tools/PanTool";
import { resizeTool } from "../tools/resizeTool";
import { syncCoreState } from "../history";

type Phase = "down" | "move" | "up" | "cancel";

function syncCoreStateAfterPointerEnd(phase: Phase) {
  if (phase === "up" || phase === "cancel") {
    syncCoreState();
  }
}

export function dispatch(e: PointerEvent, phase: Phase) {
  if ((phase === "down" || phase === "move") && e.cancelable) {
    e.preventDefault();
  }

  // 1. 임시 PAN 모드는 현재 선택된 도구보다 우선한다.
  switch (paintState.inputMode) {
    case "PAN":
      panTool[phase]?.(e);
      syncCoreStateAfterPointerEnd(phase);
      return;
  }

  if (paintState.inputMode === "BRUSH") {
    if (phase === "down" && resizeTool.canStart(e)) {
      resizeTool.down(e);
      return;
    }
    if (resizeTool.isActive()) {
      resizeTool[phase]?.(e);
      syncCoreStateAfterPointerEnd(phase);
      return;
    }
    if (phase === "move" && !paintState.pointerdown) {
      resizeTool.move(e);
    }
  }

  // 2. 기본 도구 (BRUSH, SELECT, RESIZE 등)는 toolId 기준
  const tool = toolRegistry[paintState.activeToolId];
  tool?.[phase]?.(e);
  syncCoreStateAfterPointerEnd(phase);
}

// 프레임당 1회 move 디스패치 제어용 변수
let moveQueued = false;
//let lastMoveEvent: PointerEvent | null = null;

function throttledMove(e: PointerEvent) {
  // console.log('move')
  if (moveQueued) return;

  moveQueued = true;
  dispatch(e, "move");

  requestAnimationFrame(() => {
    moveQueued = false;
  });
}

export function attachPointerEvents(root: HTMLElement) {
  root.addEventListener("pointerdown", (e) => dispatch(e, "down"), {
    passive: false,
  });

  window.addEventListener("pointermove", throttledMove, {
    passive: false,
  });

  window.addEventListener("pointerup", (e) => dispatch(e, "up"), {
    passive: false,
  });

  window.addEventListener("pointercancel", (e) => dispatch(e, "up"), {
    passive: false,
  });
}
