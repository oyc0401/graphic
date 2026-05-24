import {
  BrushId,
  InputMode,
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

export const toolManager = {
  async setBrushTool() {
    if (!canChangeTool()) return;
    if (selection.visible) {
      applySelection();
    }

    paintState.setBrushId(BrushId.Brush);
    paintState.setSelectedToolId(ToolId.Brush);
    paintState.setInputMode(InputMode.DEFAULT);
    paintState.setTemporaryToolId(null);
    getLayerWorker().setTool(BrushId.Brush);
    syncCoreState();
  },
  setEraserTool() {
    if (!canChangeTool()) return;
    if (selection.visible) {
      applySelection();
    }

    paintState.setBrushId(BrushId.Eraser);
    paintState.setSelectedToolId(ToolId.Brush);
    paintState.setInputMode(InputMode.DEFAULT);
    paintState.setTemporaryToolId(null);
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
      paintState.setInputMode(InputMode.DEFAULT);
      paintState.setTemporaryToolId(null);
      return;
    }

    if (selection.visible) {
      applySelection();
    }

    paintState.setSessionId(SessionId.Liquify);
    paintState.setLiquifyToolId(toolId);
    paintState.setInputMode(InputMode.DEFAULT);
    paintState.setTemporaryToolId(null);
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
      paintState.setInputMode(InputMode.DEFAULT);
      paintState.setTemporaryToolId(null);
      return;
    }

    if (selection.visible) {
      applySelection();
    }

    paintState.setSessionId(SessionId.Mosaic);
    paintState.setInputMode(InputMode.DEFAULT);
    paintState.setTemporaryToolId(null);
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
    if (selection.visible) {
      applySelection();
    }

    paintState.setSelectedToolId(ToolId.Select);
    paintState.setInputMode(InputMode.DEFAULT);
    paintState.setTemporaryToolId(null);
    getLayerWorker().setTool(paintState.getBrushId());
    syncCoreState();
  },
  setZoomTool() {
    if (!canChangeTool()) return;
    if (selection.visible) {
      applySelection();
    }

    paintState.setSelectedToolId(ToolId.Zoom);
    paintState.setInputMode(InputMode.DEFAULT);
    paintState.setTemporaryToolId(null);
    getLayerWorker().setTool(paintState.getBrushId());
    syncCoreState();
  },
  setColorPickerTool() {
    if (!canChangeTool()) return;
    if (selection.visible) {
      applySelection();
    }

    paintState.setSelectedToolId(ToolId.ColorPicker);
    paintState.setInputMode(InputMode.DEFAULT);
    paintState.setTemporaryToolId(null);
    getLayerWorker().setTool(paintState.getBrushId());
    syncCoreState();
  },
  setSelection() {
    if (!canChangeTool()) return;

    paintState.setSelectedToolId(ToolId.Selection);
    paintState.setInputMode(InputMode.DEFAULT);
    paintState.setTemporaryToolId(null);
    syncCoreState();
  },
  commitSession() {
    if (!canChangeTool() || !paintState.getSessionMode()) return;

    getLayerWorker().commitSession();
    syncCoreState();
    paintState.setSessionId(null);
    paintState.setInputMode(InputMode.DEFAULT);
    paintState.setTemporaryToolId(null);
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
    paintState.setInputMode(InputMode.DEFAULT);
    paintState.setTemporaryToolId(null);
    getLayerWorker().setTool(paintState.getBrushId());
    syncCoreState();
  },
};
