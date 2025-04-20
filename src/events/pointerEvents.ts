import { paintState } from "../main";
import { toolRegistry } from "../tools/toolRegistry";
import { panTool } from "../tools/PanTool";
import { zoomTool } from "../tools/ZoomTool";

type Phase = "down" | "move" | "up" | "cancel";

export function dispatch(e: PointerEvent, phase: Phase) {
  // 1. 모드(action)가 PAN, ZOOM이면 우선 분기
  switch (paintState.action) {
    case "PAN":
      panTool[phase]?.(e);
      return;
    case "ZOOM":
      zoomTool[phase]?.(e);
      return;
  }

  // 2. 기본 도구 (BRUSH, SELECT, RESIZE 등)는 toolId 기준
  const tool = toolRegistry[paintState.toolId];
  tool?.[phase]?.(e);
}

// 프레임당 1회 move 디스패치 제어용 변수
let moveQueued = false;
//let lastMoveEvent: PointerEvent | null = null;

function throttledMove(e: PointerEvent) {
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
}
