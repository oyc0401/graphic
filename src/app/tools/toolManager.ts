import {
  BrushId,
  LiquifyToolId,
  MosaicToolId,
  paintState,
  SessionId,
  ToolId,
} from "../paintState";
import { historyState, syncCoreState } from "../history";
import { getLayerWorker } from "../worker/workerPool";
import { getCurrentTool } from "./activeTool";

function canChangeTool() {
  return !paintState.getPointerdown();
}

function canChangeMainTool() {
  return canChangeTool() && paintState.getSessionId() === null;
}

function exitCurrentTool() {
  getCurrentTool()?.exit();
}

export const toolManager = {
  async setBrushTool() {
    if (!canChangeMainTool()) return;
    exitCurrentTool();

    paintState.setBrushId(BrushId.Brush);
    paintState.setSelectedToolId(ToolId.Brush);
    getLayerWorker().setTool(BrushId.Brush);
    syncCoreState();
  },
  setEraserTool() {
    if (!canChangeMainTool()) return;
    exitCurrentTool();

    paintState.setBrushId(BrushId.Eraser);
    paintState.setSelectedToolId(ToolId.Brush);
    getLayerWorker().setTool(BrushId.Eraser);
    syncCoreState();
  },
  setLiquifyTool(toolId: LiquifyToolId = paintState.getLiquifyToolId()) {
    if (!canChangeTool()) return;
    const sessionId = paintState.getSessionId();
    if (sessionId !== null) {
      if (sessionId === SessionId.Liquify) {
        paintState.setLiquifyToolId(toolId);
        getLayerWorker().setLiquifyTool(toolId);
      }
      return;
    }

    exitCurrentTool();

    paintState.setSessionId(SessionId.Liquify);
    paintState.setLiquifyToolId(toolId);
    getLayerWorker().openSession("liquify");
    getLayerWorker().setLiquifyTool(toolId);
    syncCoreState();
  },
  setMosaicTool() {
    if (!canChangeTool()) return;
    if (paintState.getSessionId() !== null) {
      return;
    }

    exitCurrentTool();

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
    exitCurrentTool();

    paintState.setSelectedToolId(ToolId.Select);
    getLayerWorker().setTool(paintState.getBrushId());
    syncCoreState();
  },
  setZoomTool() {
    if (!canChangeMainTool()) return;
    exitCurrentTool();

    paintState.setSelectedToolId(ToolId.Zoom);
    getLayerWorker().setTool(paintState.getBrushId());
    syncCoreState();
  },
  setColorPickerTool() {
    if (!canChangeMainTool()) return;
    exitCurrentTool();

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
    if (!canChangeTool() || paintState.getSessionId() === null) return;

    getLayerWorker().commitSession();
    syncCoreState();
    paintState.setSessionId(null);
    getLayerWorker().setTool(paintState.getBrushId());
    syncCoreState();
  },
  discardSession() {
    if (!canChangeTool() || paintState.getSessionId() === null) return;

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
