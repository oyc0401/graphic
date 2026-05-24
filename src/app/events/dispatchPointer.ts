import { getActiveToolId } from "../coreToolAdapter";
import { syncCoreState } from "../history";
import { InputMode, paintState } from "../paintState";
import { panTool } from "../tools/PanTool";
import { resizeTool } from "../tools/resizeTool";
import { toolRegistry } from "../tools/toolRegistry";
import { zoomTool } from "../tools/ZoomTool";

export type PointerPhase = "down" | "move" | "up" | "cancel";

function syncCoreStateAfterPointerEnd(phase: PointerPhase) {
  if (phase === "up" || phase === "cancel") {
    syncCoreState();
  }
}

export function dispatchPointer(event: PointerEvent, phase: PointerPhase) {
  if ((phase === "down" || phase === "move") && event.cancelable) {
    event.preventDefault();
  }

  switch (paintState.getInputMode()) {
    case InputMode.Pan:
      panTool[phase]?.(event);
      syncCoreStateAfterPointerEnd(phase);
      return;
    case InputMode.Zoom:
      zoomTool[phase]?.(event);
      syncCoreStateAfterPointerEnd(phase);
      return;
  }

  const toolId = getActiveToolId();
  const activeToolConfig = toolRegistry[toolId].config;

  if (
    paintState.getInputMode() === InputMode.DEFAULT &&
    activeToolConfig.allowCanvasResizeHandle
  ) {
    if (phase === "down" && resizeTool.canStart(event)) {
      resizeTool.down(event);
      return;
    }
    if (resizeTool.isActive()) {
      resizeTool[phase]?.(event);
      syncCoreStateAfterPointerEnd(phase);
      return;
    }
    if (phase === "move" && !paintState.getPointerdown()) {
      resizeTool.move(event);
    }
  }

  const tool = toolRegistry[toolId];
  tool?.[phase]?.(event);
  syncCoreStateAfterPointerEnd(phase);
}
