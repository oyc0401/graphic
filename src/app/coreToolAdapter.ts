import type { CoreSessionTool, CoreTool } from "@/core/types";
import { BrushId, paintState, SessionToolId, ToolId, type SessionReturnToolId } from "./paintState";
import { getLayerWorker } from "./worker/workerPool";

export type WorkerToolTarget = BrushId | SessionToolId.Liquify | ToolId.Select | ToolId.Selection;

function coreToolForWorkerTarget(target: WorkerToolTarget): CoreTool | CoreSessionTool | null {
  switch (target) {
    case BrushId.Brush:
      return "brush";
    case BrushId.Eraser:
      return "eraser";
    case SessionToolId.Liquify:
      return "liquify";
    case ToolId.Select:
    case ToolId.Selection:
      return null;
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
      return paintState.brushId;
    case ToolId.Zoom:
    case ToolId.ColorPicker:
      return paintState.brushId;
  }
}

function applyCoreToolToPaintState(tool: CoreTool | CoreSessionTool | null, fallbackTarget?: WorkerToolTarget) {
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
    case null:
      if (fallbackTarget === ToolId.Select || fallbackTarget === ToolId.Selection) {
        paintState.setSelectedToolId(fallbackTarget);
      }
      return;
  }
}

export function selectPaintToolForWorkerTarget(target: WorkerToolTarget) {
  applyCoreToolToPaintState(coreToolForWorkerTarget(target), target);
}

export function isCurrentWorkerToolTarget(target: WorkerToolTarget) {
  if (target === ToolId.Select || target === ToolId.Selection) {
    return paintState.selectedToolId === target;
  }
  return coreToolForCurrentPaintState() === coreToolForWorkerTarget(target);
}

export function applyWorkerToolTarget(target: WorkerToolTarget) {
  const tool = coreToolForWorkerTarget(target);
  applyCoreToolToPaintState(tool, target);
  if (tool === null) {
    return { tool: paintState.brushId };
  }
  if (tool === "liquify") {
    return getLayerWorker().openSession(tool);
  }
  return getLayerWorker().setTool(tool);
}

export function syncWorkerToCurrentPaintTool() {
  const tool = coreToolForCurrentPaintState();
  if (tool === "liquify") {
    return getLayerWorker().openSession(tool);
  }
  return getLayerWorker().setTool(tool);
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
