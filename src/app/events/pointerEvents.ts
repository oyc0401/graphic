import { paintState } from "../paintState";
import { toolRegistry } from "../tools/toolRegistry";
import { panTool } from "../tools/PanTool";
import { zoomTool } from "../tools/ZoomTool";
import { resizeTool } from "../tools/resizeTool";
import { syncHistoryCount } from "../history";

type Phase = "down" | "move" | "up" | "cancel";

function syncHistoryCountAfterPointerEnd(phase: Phase) {
  if (phase === "up" || phase === "cancel") {
    syncHistoryCount();
  }
}

export function dispatch(e: PointerEvent, phase: Phase) {
  if ((phase === "down" || phase === "move") && e.cancelable) {
    e.preventDefault();
  }

  // 1. 모드(inputMode)가 PAN, ZOOM이면 우선 분기
  switch (paintState.inputMode) {
    case "PAN":
      panTool[phase]?.(e);
      syncHistoryCountAfterPointerEnd(phase);
      return;
    case "ZOOM":
      zoomTool[phase]?.(e);
      syncHistoryCountAfterPointerEnd(phase);
      return;
  }

  if (paintState.inputMode === "BRUSH") {
    if (phase === "down" && resizeTool.canStart(e)) {
      resizeTool.down(e);
      return;
    }
    if (resizeTool.isActive()) {
      resizeTool[phase]?.(e);
      syncHistoryCountAfterPointerEnd(phase);
      return;
    }
    if (phase === "move" && !paintState.pointerdown) {
      resizeTool.move(e);
    }
  }

  // 2. 기본 도구 (BRUSH, SELECT, RESIZE 등)는 toolId 기준
  const tool = toolRegistry[paintState.toolId];
  tool?.[phase]?.(e);
  syncHistoryCountAfterPointerEnd(phase);
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
