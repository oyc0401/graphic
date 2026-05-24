import { getActiveToolId } from "../coreToolAdapter";
import { syncCoreState } from "../history";
import { InputMode, paintState } from "../paintState";
import { panTool } from "../tools/PanTool";
import { resizeTool } from "../tools/resizeTool";
import { sessionTool } from "../tools/SessionTool";
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

  // 임시도구 설정
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

  // 세션 도구 적용
  if (paintState.getSessionMode()) {
    sessionTool[phase]?.(event);
    syncCoreStateAfterPointerEnd(phase);
    return;
  }

  const toolId = getActiveToolId();
  const activeToolConfig = toolRegistry[toolId].config; // 이게 각자 툴의 리사이즈 사용여부구나

  // 리사이즈 하기
  if (
    paintState.getInputMode() === InputMode.DEFAULT &&
    activeToolConfig.allowCanvasResizeHandle
  ) {
    // canStart는 해당 위치가 리사이즈 핸들 영역인지 여부임
    if (phase === "down" && resizeTool.canStart(event)) {
      resizeTool.down(event);
      return;
    }
    // 이건 뭐지? 무브는 아래에 있을텐데? 업이랑 캔슬인가?
    if (resizeTool.isActive()) {
      resizeTool[phase]?.(event);
      syncCoreStateAfterPointerEnd(phase);
      return;
    }
    if (phase === "move" && !paintState.getPointerdown()) {
      resizeTool.move(event);
    }
  }

  // 일반도구 적용
  const tool = toolRegistry[toolId];
  tool?.[phase]?.(event);
  syncCoreStateAfterPointerEnd(phase);
}
