import { syncCoreState } from "../history";
import { InputMode, paintState, TemporaryToolId } from "../paintState";
import { getCurrentTool } from "../tools/activeTool";
import { resizeTool } from "../tools/resizeTool";

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

  let tool = getCurrentTool();
  if (
    phase === "down" &&
    paintState.getInputMode() === InputMode.DEFAULT &&
    paintState.getTemporaryToolId() === null &&
    tool?.config.allowCanvasResizeHandle &&
    resizeTool.canStart(event)
  ) {
    paintState.setTemporaryToolId(TemporaryToolId.Resize);
    tool = getCurrentTool();
  }

  if (!tool) {
    syncCoreStateAfterPointerEnd(phase);
    return;
  }

  tool?.[phase]?.(event);
  syncCoreStateAfterPointerEnd(phase);
}
