import {
  BrushId,
  InputMode,
  paintState,
  type SessionReturnToolId,
  SessionToolId,
  ToolId,
} from "./paintState";
import { applySelection, selection, selectionCancel } from "./selection";
import { dispatch } from "./events/pointerEvents";
import { syncCoreState } from "./history";
import { getLayerWorker } from "./worker/workerPool";

function confirmLiquifyApply() {
  if (paintState.sessionToolId !== SessionToolId.Liquify) return true;
  return window.confirm("픽셀유동화를 적용하시겠습니까?");
}

function canChangeTool() {
  return !paintState.pointerdown;
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
  paintState.sessionToolId = null;
}

function discardLiquifySession() {
  getLayerWorker().discardSession();
  syncCoreState();
  paintState.sessionToolId = null;
}

function leaveCurrentEditingState(options: { commitSelection: boolean }) {
  if (!confirmLiquifyApply()) return false;

  if (paintState.sessionToolId === SessionToolId.Liquify) {
    commitLiquifySession();
    return true;
  }

  if (options.commitSelection) {
    commitVisibleSelection();
  }

  return true;
}

function sessionReturnToolForCurrentSelection(): SessionReturnToolId {
  if (
    paintState.toolId === ToolId.Select ||
    paintState.toolId === ToolId.Selection
  ) {
    return ToolId.Select;
  }

  return ToolId.Brush;
}

function selectBrushLikeTool(brushId: BrushId) {
  paintState.sessionToolId = null;
  paintState.setSessionReturnTool(null);
  paintState.setBrushId(brushId);
  paintState.setSelectedToolId(ToolId.Brush);
  setDefaultInputMode();
  getLayerWorker().setTool(brushId);
  syncCoreState();
}

function selectAppOnlyTool(
  toolId: ToolId.Select | ToolId.Zoom | ToolId.ColorPicker,
) {
  paintState.sessionToolId = null;
  paintState.setSessionReturnTool(null);
  paintState.setSelectedToolId(toolId);
  setDefaultInputMode();
  getLayerWorker().setTool(paintState.brushId);
}

function returnFromSession() {
  const returnTool = paintState.sessionReturnTool ?? ToolId.Brush;
  paintState.sessionToolId = null;
  paintState.setSelectedToolId(returnTool);
  paintState.setSessionReturnTool(null);
  setDefaultInputMode();

  getLayerWorker().setTool(paintState.brushId);
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
    if (paintState.sessionToolId === SessionToolId.Liquify) {
      paintState.setSelectedToolId(ToolId.Session);
      setDefaultInputMode();
      return;
    }

    const returnTool = sessionReturnToolForCurrentSelection();
    if (!leaveCurrentEditingState({ commitSelection: true })) return;

    paintState.setSessionReturnTool(returnTool);
    paintState.sessionToolId = SessionToolId.Liquify;
    paintState.setSelectedToolId(ToolId.Session);
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

    paintState.sessionToolId = null;
    paintState.setSessionReturnTool(null);
    paintState.setSelectedToolId(ToolId.Selection);
    setDefaultInputMode();
    syncCoreState();
  },
  commitSession() {
    if (!canChangeTool() || paintState.sessionToolId !== SessionToolId.Liquify)
      return;

    commitLiquifySession();
    returnFromSession();
  },
  discardSession() {
    if (!canChangeTool() || paintState.sessionToolId !== SessionToolId.Liquify)
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

  if (paintState.toolId === ToolId.Selection) {
    selectionCancel();
    return;
  }

  dispatch(new PointerEvent("pointercancel"), "cancel");
}
