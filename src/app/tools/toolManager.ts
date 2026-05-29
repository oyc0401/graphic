import {
  BrushId,
  LiquifyToolId,
  MosaicToolId,
  paintState,
  ShapeId,
  SessionId,
  ToolId,
} from "../paintState";
import { historyState, syncCoreState } from "../history";
import { applySelection } from "../selection";
import { applyShape, shape } from "../shape";
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
  setBrushTool() {
    if (!canChangeMainTool()) return;
    exitCurrentTool();

    paintState.setBrushId(BrushId.Brush);
    paintState.setSelectedToolId(ToolId.Brush);
    getLayerWorker().setTool(BrushId.Brush);
    syncCoreState();
  },
  setPencilTool() {
    if (!canChangeMainTool()) return;
    exitCurrentTool();

    paintState.setBrushId(BrushId.Pencil);
    paintState.setSelectedToolId(ToolId.Brush);
    getLayerWorker().setTool(BrushId.Pencil);
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
  setSelectTool() {
    if (!canChangeMainTool()) return;
    exitCurrentTool();

    paintState.setSelectedToolId(ToolId.Select);
    getLayerWorker().setTool(paintState.getBrushId());
    syncCoreState();
  },
  setFreeformSelectTool() {
    if (!canChangeMainTool()) return;
    exitCurrentTool();

    paintState.setSelectedToolId(ToolId.FreeformSelect);
    getLayerWorker().setTool(paintState.getBrushId());
    syncCoreState();
  },
  setShapeTool(shapeId: ShapeId = paintState.getShapeId()) {
    if (!canChangeMainTool()) return;
    if (shape.visible && paintState.getShapeId() !== shapeId) {
      applyShape();
      syncCoreState();
    }
    applySelection();
    exitCurrentTool();

    paintState.setSelectedToolId(ToolId.Shape);
    paintState.setShapeId(shapeId);
    getLayerWorker().setTool(paintState.getBrushId());
    syncCoreState();
  },
  setFloodFillTool() {
    if (!canChangeMainTool()) return;
    exitCurrentTool();

    paintState.setSelectedToolId(ToolId.FloodFill);
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
  setLiquifyTool(toolId: LiquifyToolId = paintState.getLiquifyToolId()) {
    if (!canChangeTool()) return;
    const sessionId = paintState.getSessionId();
    if (sessionId === SessionId.Liquify) {
      paintState.setLiquifyToolId(toolId);
      getLayerWorker().setLiquifyTool(toolId);
      return;
    }
    if (sessionId !== null) return;

    exitCurrentTool();

    paintState.setSessionId(SessionId.Liquify);
    paintState.setLiquifyToolId(toolId);
    getLayerWorker().openSession("liquify");
    getLayerWorker().setLiquifyTool(toolId);
    syncCoreState();
  },
  setMosaicTool(toolId: MosaicToolId = paintState.getMosaicToolId()) {
    if (!canChangeTool()) return;
    const sessionId = paintState.getSessionId();
    if (sessionId === SessionId.Mosaic) {
      if (paintState.getMosaicToolId() === toolId) return;

      paintState.setMosaicToolId(toolId);
      getLayerWorker().setMosaicTool(toolId);
      syncCoreState();
      return;
    }
    if (sessionId !== null) return;

    exitCurrentTool();

    paintState.setSessionId(SessionId.Mosaic);
    paintState.setMosaicToolId(toolId);
    getLayerWorker().openSession("mosaic");
    getLayerWorker().setMosaicTool(toolId);
    getLayerWorker().setMosaicStrength(paintState.getBrushAlpha());
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
