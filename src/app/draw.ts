import {
  BrushId,
  InputMode,
  paintState,
  SessionId,
  ToolId,
} from "./paintState";
import { applySelection, selection, selectionCancel } from "./selection";
import { dispatch } from "./events/pointerEvents";
import { syncCoreState } from "./history";
import { getLayerWorker } from "./worker/workerPool";

function confirmLiquifyApply() {
  if (!paintState.getSessionMode() || paintState.getSessionId() !== SessionId.Liquify) {
    return true;
  }
  return window.confirm("픽셀유동화를 적용하시겠습니까?");
}

function canChangeTool() {
  return !paintState.getPointerdown();
}

function setDefaultInputMode() {
  paintState.setInputMode(InputMode.DEFAULT);
}

function commitVisibleSelection() {
  if (selection.visible) {
    applySelection();
  }
}

function commitLiquifySession() {
  getLayerWorker().commitSession();
  syncCoreState();
  paintState.setSessionMode(false);
}

function discardLiquifySession() {
  getLayerWorker().discardSession();
  syncCoreState();
  paintState.setSessionMode(false);
}

function leaveCurrentEditingState(options: { commitSelection: boolean }) {
  if (!confirmLiquifyApply()) return false;

  if (paintState.getSessionMode() && paintState.getSessionId() === SessionId.Liquify) {
    commitLiquifySession();
    return true;
  }

  if (options.commitSelection) {
    commitVisibleSelection();
  }

  return true;
}

function selectBrushLikeTool(brushId: BrushId) {
  paintState.setSessionMode(false);
  paintState.setBrushId(brushId);
  paintState.setSelectedToolId(ToolId.Brush);
  setDefaultInputMode();
  getLayerWorker().setTool(brushId);
  syncCoreState();
}

function selectAppOnlyTool(
  toolId: ToolId.Select | ToolId.Zoom | ToolId.ColorPicker,
) {
  paintState.setSessionMode(false);
  paintState.setSelectedToolId(toolId);
  setDefaultInputMode();
  getLayerWorker().setTool(paintState.getBrushId());
}

function returnFromSession() {
  paintState.setSessionMode(false);
  setDefaultInputMode();
  getLayerWorker().setTool(paintState.getBrushId());
  syncCoreState();
}

export const toolManager = {
  async setBrushTool() {
    if (!canChangeTool()) return;
    if (!leaveCurrentEditingState({ commitSelection: true })) return;

    selectBrushLikeTool(BrushId.Brush);
  },
  setEraserTool() {
    if (!canChangeTool()) return;
    if (!leaveCurrentEditingState({ commitSelection: true })) return;

    selectBrushLikeTool(BrushId.Eraser);
  },
  setLiquifyTool() {
    if (!canChangeTool()) return;
    if (paintState.getSessionMode() && paintState.getSessionId() === SessionId.Liquify) {
      setDefaultInputMode();
      return;
    }

    if (!leaveCurrentEditingState({ commitSelection: true })) return;

    paintState.setSessionId(SessionId.Liquify);
    paintState.setSessionMode(true);
    setDefaultInputMode();
    getLayerWorker().openSession("liquify");
    syncCoreState();
  },
  setSelectTool() {
    if (!canChangeTool()) return;
    if (!leaveCurrentEditingState({ commitSelection: true })) return;

    selectAppOnlyTool(ToolId.Select);
    syncCoreState();
  },
  setZoomTool() {
    if (!canChangeTool()) return;
    if (!leaveCurrentEditingState({ commitSelection: true })) return;

    selectAppOnlyTool(ToolId.Zoom);
    syncCoreState();
  },
  setColorPickerTool() {
    if (!canChangeTool()) return;
    if (!leaveCurrentEditingState({ commitSelection: true })) return;

    selectAppOnlyTool(ToolId.ColorPicker);
    syncCoreState();
  },
  setSelection() {
    if (!canChangeTool()) return;
    if (!leaveCurrentEditingState({ commitSelection: false })) return;

    paintState.setSessionMode(false);
    paintState.setSelectedToolId(ToolId.Selection);
    setDefaultInputMode();
    syncCoreState();
  },
  commitSession() {
    if (
      !canChangeTool() ||
      !paintState.getSessionMode() ||
      paintState.getSessionId() !== SessionId.Liquify
    )
      return;

    commitLiquifySession();
    returnFromSession();
  },
  discardSession() {
    if (
      !canChangeTool() ||
      !paintState.getSessionMode() ||
      paintState.getSessionId() !== SessionId.Liquify
    )
      return;

    discardLiquifySession();
    returnFromSession();
  },
};

/**
 * 원본 텍스쳐로 돌려놓기
 */
export function cancel() {
  console.log("cancel!");

  if (paintState.getToolId() === ToolId.Selection) {
    selectionCancel();
    return;
  }

  dispatch(new PointerEvent("pointercancel"), "cancel");
}
