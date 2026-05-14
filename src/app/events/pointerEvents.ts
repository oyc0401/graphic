import { getActiveToolId } from "../coreToolAdapter";
import { InputMode, paintState } from "../paintState";
import { getToolMetadata, toolRegistry } from "../tools/toolRegistry";
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
  switch (paintState.getInputMode()) {
    case InputMode.Pan:
      panTool[phase]?.(e);
      syncCoreStateAfterPointerEnd(phase);
      return;
  }

  const toolId = getActiveToolId();
  const activeToolMetadata = getToolMetadata(toolId);

  if (
    paintState.getInputMode() === InputMode.DEFAULT &&
    activeToolMetadata.allowCanvasResizeHandle
  ) {
    if (phase === "down" && resizeTool.canStart(e)) {
      resizeTool.down(e);
      return;
    }
    if (resizeTool.isActive()) {
      resizeTool[phase]?.(e);
      syncCoreStateAfterPointerEnd(phase);
      return;
    }
    if (phase === "move" && !paintState.getPointerdown()) {
      resizeTool.move(e);
    }
  }

  // 2. 기본 도구 (BRUSH, SELECT, RESIZE 등)는 toolId 기준
  const tool = toolRegistry[toolId];
  tool?.[phase]?.(e);
  syncCoreStateAfterPointerEnd(phase);
}

export function attachPointerEvents(root: HTMLElement) {
  root.addEventListener("pointerdown", (e) => dispatch(e, "down"), {
    passive: false,
  });

  window.addEventListener(
    "pointermove",
    (e) => {
      dispatch(e, "move");
    },
    {
      passive: false,
    },
  );

  window.addEventListener("pointerup", (e) => dispatch(e, "up"), {
    passive: false,
  });

  window.addEventListener("pointercancel", (e) => dispatch(e, "up"), {
    passive: false,
  });
}
