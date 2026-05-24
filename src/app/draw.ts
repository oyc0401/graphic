import {
  BrushId,
  InputMode,
  LiquifyToolId,
  MosaicModeId,
  paintState,
  SessionId,
  ToolId,
} from "./paintState";
import { applySelection, selection, selectionCancel } from "./selection";
import { dispatch } from "./events/pointerEvents";
import { syncCoreState } from "./history";
import { getLayerWorker } from "./worker/workerPool";

function confirmSessionApply() {
  if (!paintState.getSessionMode()) {
    return true;
  }
  const sessionName =
    paintState.getSessionId() === SessionId.Mosaic ? "모자이크" : "픽셀유동화";
  return window.confirm(`${sessionName}를 적용하시겠습니까?`);
}

function confirmSessionDiscard() {
  return window.confirm("적용을 취소하시겠습니까?");
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

function commitEditingSession() {
  getLayerWorker().commitSession();
  syncCoreState();
  paintState.setSessionMode(false);
}

function discardEditingSession() {
  getLayerWorker().discardSession();
  syncCoreState();
  paintState.setSessionMode(false);
}

function leaveCurrentEditingState(options: { commitSelection: boolean }) {
  if (!confirmSessionApply()) return false;

  if (paintState.getSessionMode()) {
    commitEditingSession();
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
  setLiquifyTool(toolId: LiquifyToolId = paintState.getLiquifyToolId()) {
    if (!canChangeTool()) return;
    if (paintState.getSessionMode() && paintState.getSessionId() === SessionId.Liquify) {
      paintState.setLiquifyToolId(toolId);
      getLayerWorker().setLiquifyTool(toolId);
      setDefaultInputMode();
      return;
    }

    if (!leaveCurrentEditingState({ commitSelection: true })) return;

    paintState.setSessionId(SessionId.Liquify);
    paintState.setLiquifyToolId(toolId);
    paintState.setSessionMode(true);
    setDefaultInputMode();
    getLayerWorker().openSession("liquify");
    getLayerWorker().setLiquifyTool(toolId);
    syncCoreState();
  },
  setMosaicTool() {
    if (!canChangeTool()) return;
    if (paintState.getSessionMode() && paintState.getSessionId() === SessionId.Mosaic) {
      setDefaultInputMode();
      return;
    }

    if (!leaveCurrentEditingState({ commitSelection: true })) return;

    paintState.setSessionId(SessionId.Mosaic);
    paintState.setSessionMode(true);
    setDefaultInputMode();
    getLayerWorker().openSession("mosaic");
    getLayerWorker().setMosaicMode(paintState.getMosaicModeId());
    getLayerWorker().setMosaicStrength(paintState.getBrushAlpha());
    syncCoreState();
  },
  setMosaicMode(modeId: MosaicModeId) {
    if (!canChangeTool()) return;
    paintState.setMosaicModeId(modeId);
    getLayerWorker().setMosaicMode(modeId);
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
      !paintState.getSessionMode()
    )
      return;

    commitEditingSession();
    returnFromSession();
  },
  discardSession() {
    if (
      !canChangeTool() ||
      !paintState.getSessionMode()
    )
      return;

    if (!confirmSessionDiscard()) return;

    discardEditingSession();
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
