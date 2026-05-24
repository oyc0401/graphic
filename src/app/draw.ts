import {
  BrushId,
  InputMode,
  LiquifyToolId,
  MosaicToolId,
  paintState,
  SessionId,
  ToolId,
} from "./paintState";
import { applySelection, selection, selectionCancel } from "./selection";
import { dispatchPointer } from "./events/dispatchPointer";
import { historyState, syncCoreState } from "./history";
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
  if (historyState.getUndoCount() + historyState.getRedoCount() === 0) {
    return true;
  }
  return window.confirm("적용을 취소하시겠습니까?");
}

function canChangeTool() {
  return !paintState.getPointerdown();
}

function setDefaultInputMode() {
  paintState.setInputMode(InputMode.DEFAULT);
  paintState.setTemporaryToolId(null);
}

function commitVisibleSelection() {
  if (selection.visible) {
    applySelection();
  }
}

function commitEditingSession() {
  getLayerWorker().commitSession();
  syncCoreState();
  paintState.setSessionId(null);
}

function discardEditingSession() {
  getLayerWorker().discardSession();
  syncCoreState();
  paintState.setSessionId(null);
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

function selectAppOnlyTool(
  toolId: ToolId.Select | ToolId.Zoom | ToolId.ColorPicker,
) {
  paintState.setSessionId(null);
  paintState.setSelectedToolId(toolId);
  setDefaultInputMode();
  getLayerWorker().setTool(paintState.getBrushId());
}

function returnFromSession() {
  paintState.setSessionId(null);
  setDefaultInputMode();
  getLayerWorker().setTool(paintState.getBrushId());
  syncCoreState();
}

export const toolManager = {
  async setBrushTool() {
    if (!canChangeTool()) return;
    if (!leaveCurrentEditingState({ commitSelection: true })) return;

    paintState.setSessionId(null);
    paintState.setBrushId(BrushId.Brush);
    paintState.setSelectedToolId(ToolId.Brush);
    setDefaultInputMode();
    getLayerWorker().setTool(BrushId.Brush);
    syncCoreState();
  },
  setEraserTool() {
    if (!canChangeTool()) return;
    if (!leaveCurrentEditingState({ commitSelection: true })) return;

    paintState.setSessionId(null);
    paintState.setBrushId(BrushId.Eraser);
    paintState.setSelectedToolId(ToolId.Brush);
    setDefaultInputMode();
    getLayerWorker().setTool(BrushId.Eraser);
    syncCoreState();
  },
  setLiquifyTool(toolId: LiquifyToolId = paintState.getLiquifyToolId()) {
    if (!canChangeTool()) return;
    if (
      paintState.getSessionMode() &&
      paintState.getSessionId() === SessionId.Liquify
    ) {
      paintState.setLiquifyToolId(toolId);
      getLayerWorker().setLiquifyTool(toolId);
      setDefaultInputMode();
      return;
    }

    if (!leaveCurrentEditingState({ commitSelection: true })) return;

    paintState.setSessionId(SessionId.Liquify);
    paintState.setLiquifyToolId(toolId);
    setDefaultInputMode();
    getLayerWorker().openSession("liquify");
    getLayerWorker().setLiquifyTool(toolId);
    syncCoreState();
  },
  setMosaicTool() {
    if (!canChangeTool()) return;
    if (
      paintState.getSessionMode() &&
      paintState.getSessionId() === SessionId.Mosaic
    ) {
      setDefaultInputMode();
      return;
    }

    if (!leaveCurrentEditingState({ commitSelection: true })) return;

    paintState.setSessionId(SessionId.Mosaic);
    setDefaultInputMode();
    getLayerWorker().openSession("mosaic");
    getLayerWorker().setMosaicMode(paintState.getMosaicToolId());
    getLayerWorker().setMosaicStrength(paintState.getBrushAlpha());
    syncCoreState();
  },
  setMosaicMode(modeId: MosaicToolId) {
    if (!canChangeTool()) return;
    paintState.setMosaicToolId(modeId);
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

    paintState.setSessionId(null);
    paintState.setSelectedToolId(ToolId.Selection);
    setDefaultInputMode();
    syncCoreState();
  },
  commitSession() {
    if (!canChangeTool() || !paintState.getSessionMode()) return;

    commitEditingSession();
    returnFromSession();
  },
  discardSession() {
    if (!canChangeTool() || !paintState.getSessionMode()) return;

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

  dispatchPointer(new PointerEvent("pointercancel"), "cancel");
}
