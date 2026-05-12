/** draw.ts */
import {
  applyWorkerToolTarget,
  isCurrentWorkerToolTarget,
  selectPaintToolForWorkerTarget,
  sessionReturnToolForCurrentTool,
  syncWorkerToCurrentPaintTool,
  type WorkerToolTarget,
} from "./coreToolAdapter";
import { BrushId, paintState, SessionToolId, ToolId } from "./paintState";
import { applySelection, selectionCancel } from "./selection";
import { dispatch } from "./events/pointerEvents";
import { syncCoreState } from "./history";
import { getLayerWorker } from "./worker/workerPool";

function confirmLiquifyApply() {
  if (paintState.sessionToolId !== SessionToolId.Liquify) return true;
  return window.confirm("픽셀유동화를 적용하시겠습니까?");
}

function restoreSessionReturnTool() {
  const returnTool = paintState.sessionReturnTool ?? ToolId.Brush;
  paintState.setSessionToolId(null);
  paintState.setSelectedToolId(returnTool);
  syncWorkerToCurrentPaintTool();
  paintState.setSessionReturnTool(null);
}

function requestToolChange(tool: WorkerToolTarget, options: { applyCurrentSelection?: boolean } = {}) {
  const { applyCurrentSelection = true } = options;
  if (paintState.pointerdown) return false;
  if (isCurrentWorkerToolTarget(tool)) {
    selectPaintToolForWorkerTarget(tool);
    return false;
  }

  if (!confirmLiquifyApply()) return false;

  if (paintState.sessionToolId === SessionToolId.Liquify) {
    getLayerWorker().commitSession();
    syncCoreState();
    paintState.setSessionToolId(null);
    paintState.setSessionReturnTool(null);
  } else if (applyCurrentSelection) {
    applySelection();
  }

  applyWorkerToolTarget(tool);
  syncCoreState();
  return true;
}

export const toolManager = {
  async setBrushTool() {
    if (paintState.pointerdown) return;
    if (requestToolChange(BrushId.Brush)) {
      console.log("brush");
    }
  },
  setEraserTool() {
    if (paintState.pointerdown) return;
    requestToolChange(BrushId.Eraser);
  },
  setLiquifyTool() {
    if (paintState.pointerdown) return;
    const returnTool = sessionReturnToolForCurrentTool();
    if (requestToolChange(SessionToolId.Liquify)) {
      paintState.setSessionReturnTool(returnTool);
    }
  },
  setSelectTool() {
    if (paintState.pointerdown) return;
    requestToolChange(ToolId.Select);
  },
  setZoomTool() {
    if (paintState.pointerdown) return;
    paintState.setSelectedToolId(ToolId.Zoom);
  },
  setColorPickerTool() {
    if (paintState.pointerdown) return;
    if (!confirmLiquifyApply()) return;

    if (paintState.sessionToolId === SessionToolId.Liquify) {
      getLayerWorker().commitSession();
      syncCoreState();
      restoreSessionReturnTool();
      syncCoreState();
    } else {
      const shouldReturnToSelect =
        paintState.toolId === ToolId.Selection || isCurrentWorkerToolTarget(ToolId.Selection);
      applySelection();
      if (shouldReturnToSelect) {
        applyWorkerToolTarget(ToolId.Select);
        syncCoreState();
      }
    }

    paintState.setSelectedToolId(ToolId.ColorPicker);
  },
  setSelection() {
    requestToolChange(ToolId.Selection, { applyCurrentSelection: false });
  },
  commitSession() {
    if (paintState.pointerdown || paintState.sessionToolId !== SessionToolId.Liquify) return;

    getLayerWorker().commitSession();
    syncCoreState();
    restoreSessionReturnTool();
    syncCoreState();
  },
  discardSession() {
    if (paintState.pointerdown || paintState.sessionToolId !== SessionToolId.Liquify) return;

    getLayerWorker().discardSession();
    syncCoreState();
    restoreSessionReturnTool();
    syncCoreState();
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
