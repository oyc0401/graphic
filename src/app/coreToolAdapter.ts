import type { CoreSessionTool, CoreTool, CoreToolState } from "@/core/types";
import { BrushId, paintState, SessionToolId, ToolId, type SessionReturnToolId } from "./paintState";
import { getLayerWorker } from "./worker/workerPool";

export type WorkerToolTarget = BrushId | SessionToolId.Liquify | ToolId.Select | ToolId.Selection;

function coreToolForWorkerTarget(target: WorkerToolTarget): CoreTool | CoreSessionTool {
  switch (target) {
    case BrushId.Brush:
      return "brush";
    case BrushId.Eraser:
      return "eraser";
    case SessionToolId.Liquify:
      return "liquify";
    case ToolId.Select:
      return "select";
    case ToolId.Selection:
      return "selection";
  }
}

function coreToolForCurrentPaintState(): CoreTool | CoreSessionTool {
  switch (paintState.selectedToolId) {
    case ToolId.Brush:
      return paintState.brushId;
    case ToolId.Session:
      return paintState.sessionToolId === SessionToolId.Liquify ? "liquify" : "brush";
    case ToolId.Select:
    case ToolId.Selection:
      return paintState.selectedToolId;
    case ToolId.Zoom:
    case ToolId.ColorPicker:
      return paintState.brushId;
  }
}

function applyCoreToolToPaintState(tool: CoreTool | CoreSessionTool) {
  switch (tool) {
    case "brush":
      paintState.setBrushId(BrushId.Brush);
      paintState.setSelectedToolId(ToolId.Brush);
      return;
    case "eraser":
      paintState.setBrushId(BrushId.Eraser);
      paintState.setSelectedToolId(ToolId.Brush);
      return;
    case "liquify":
      paintState.setSessionToolId(SessionToolId.Liquify);
      return;
    case "select":
      paintState.setSelectedToolId(ToolId.Select);
      return;
    case "selection":
      paintState.setSelectedToolId(ToolId.Selection);
      return;
  }
}

export function selectPaintToolForWorkerTarget(target: WorkerToolTarget) {
  applyCoreToolToPaintState(coreToolForWorkerTarget(target));
}

export function isCurrentWorkerToolTarget(target: WorkerToolTarget) {
  return coreToolForCurrentPaintState() === coreToolForWorkerTarget(target);
}

export function applyWorkerToolTarget(target: WorkerToolTarget) {
  const tool = coreToolForWorkerTarget(target);
  applyCoreToolToPaintState(tool);
  if (tool === "liquify") {
    return getLayerWorker().openSession(tool);
  }
  return getLayerWorker().setTool(tool);
}

export function applyWorkerToolState(state: CoreToolState, options: { syncWorker?: boolean } = {}) {
  const { syncWorker = true } = options;
  applyCoreToolToPaintState(state.tool);

  if (syncWorker) {
    if (state.tool === "liquify") {
      return getLayerWorker().openSession(state.tool);
    }
    return getLayerWorker().setTool(state.tool);
  }

  return state;
}

export function syncWorkerToCurrentPaintTool() {
  const tool = coreToolForCurrentPaintState();
  if (tool === "liquify") {
    return getLayerWorker().openSession(tool);
  }
  return getLayerWorker().setTool(tool);
}

export function isSelectionWorkerToolState(state: CoreToolState) {
  return state.tool === "selection";
}

export function sessionReturnToolForCurrentTool(): SessionReturnToolId {
  switch (paintState.toolId) {
    case ToolId.Select:
    case ToolId.Selection:
      return ToolId.Select;
    case ToolId.Brush:
      return ToolId.Brush;
    case ToolId.Zoom:
    case ToolId.ColorPicker:
    case ToolId.Session:
      return ToolId.Brush;
  }
}
