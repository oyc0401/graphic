import {
  BrushId,
  LiquifyToolId,
  MosaicToolId,
  paintState,
  SessionId,
  ToolId,
} from "../paintState";
import { applySelection, selection } from "../selection";
import { historyState, syncCoreState } from "../history";
import { getLayerWorker } from "../worker/workerPool";

function canChangeTool() {
  return !paintState.getPointerdown();
}

function canChangeMainTool() {
  return canChangeTool() && !paintState.getSessionMode();
}

export const toolManager = {
  async setBrushTool() {
    if (!canChangeMainTool()) return;
    if (selection.visible) {
      applySelection();
    }

    paintState.setBrushId(BrushId.Brush);
    paintState.setSelectedToolId(ToolId.Brush);
    getLayerWorker().setTool(BrushId.Brush);
    syncCoreState();
  },
  setEraserTool() {
    if (!canChangeMainTool()) return;
    if (selection.visible) {
      applySelection();
    }

    paintState.setBrushId(BrushId.Eraser);
    paintState.setSelectedToolId(ToolId.Brush);
    getLayerWorker().setTool(BrushId.Eraser);
    syncCoreState();
  },
  setLiquifyTool(toolId: LiquifyToolId = paintState.getLiquifyToolId()) {
    if (!canChangeTool()) return;
    if (paintState.getSessionMode()) {
      if (paintState.getSessionId() === SessionId.Liquify) {
        paintState.setLiquifyToolId(toolId);
        getLayerWorker().setLiquifyTool(toolId);
      }
      return;
    }

    if (selection.visible) {
      applySelection();
    }

    paintState.setSessionId(SessionId.Liquify);
    paintState.setLiquifyToolId(toolId);
    getLayerWorker().openSession("liquify");
    getLayerWorker().setLiquifyTool(toolId);
    syncCoreState();
  },
  setMosaicTool() {
    if (!canChangeTool()) return;
    if (paintState.getSessionMode()) {
      return;
    }

    if (selection.visible) {
      applySelection();
    }

    paintState.setSessionId(SessionId.Mosaic);
    getLayerWorker().openSession("mosaic");
    getLayerWorker().setMosaicMode(paintState.getMosaicToolId());
    getLayerWorker().setMosaicStrength(paintState.getBrushAlpha());
    syncCoreState();
  },
  setMosaicMode(modeId: MosaicToolId) {
    if (!canChangeTool()) return;
    if (paintState.getSessionId() !== SessionId.Mosaic) return;

    paintState.setMosaicToolId(modeId);
    getLayerWorker().setMosaicMode(modeId);
    syncCoreState();
  },
  setSelectTool() {
    if (!canChangeMainTool()) return;
    if (selection.visible) {
      applySelection();
    }

    paintState.setSelectedToolId(ToolId.Select);
    getLayerWorker().setTool(paintState.getBrushId());
    syncCoreState();
  },
  setZoomTool() {
    if (!canChangeMainTool()) return;
    if (selection.visible) {
      applySelection();
    }

    paintState.setSelectedToolId(ToolId.Zoom);
    getLayerWorker().setTool(paintState.getBrushId());
    syncCoreState();
  },
  setColorPickerTool() {
    if (!canChangeMainTool()) return;
    if (selection.visible) {
      applySelection();
    }

    paintState.setSelectedToolId(ToolId.ColorPicker);
    getLayerWorker().setTool(paintState.getBrushId());
    syncCoreState();
  },
  setSelection() {
    if (!canChangeMainTool()) return;

    paintState.setSelectedToolId(ToolId.Selection);
    syncCoreState();
  },
  commitSession() {
    if (!canChangeTool() || !paintState.getSessionMode()) return;

    getLayerWorker().commitSession();
    syncCoreState();
    paintState.setSessionId(null);
    getLayerWorker().setTool(paintState.getBrushId());
    syncCoreState();
  },
  discardSession() {
    if (!canChangeTool() || !paintState.getSessionMode()) return;

    if (
      historyState.getUndoCount() + historyState.getRedoCount() > 0 &&
      !window.confirm("적용을 취소하시겠습니까?")
    ) {
      return;
    }

    getLayerWorker().discardSession();
    syncCoreState();
    paintState.setSessionId(null);
    getLayerWorker().setTool(paintState.getBrushId());
    syncCoreState();
  },
};
