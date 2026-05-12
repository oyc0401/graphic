import type { CoreTool, CoreToolState } from "@/core/types";
import {
  BrushId,
  paintState,
  SessionToolId,
  ToolId,
  type SessionReturnToolId,
} from "./paintState";
import { getLayerWorker } from "./worker/workerPool";

export type WorkerToolTarget =
  | BrushId
  | SessionToolId.Liquify
  | ToolId.Select
  | ToolId.Selection;

function coreToolForWorkerTarget(target: WorkerToolTarget): CoreTool {
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

function coreToolForCurrentPaintState(): CoreTool {
  switch (paintState.selectedToolId) {
    case ToolId.Brush:
      return paintState.brushId;
    case ToolId.Session:
      return paintState.sessionToolId === SessionToolId.Liquify
        ? "liquify"
        : "brush";
    case ToolId.Select:
    case ToolId.Selection:
      return paintState.selectedToolId;
    case ToolId.Zoom:
    case ToolId.ColorPicker:
      return paintState.brushId;
  }
}

function applyCoreToolToPaintState(tool: CoreTool) {
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

export function applyWorkerToolTarget(
  target: WorkerToolTarget,
  options: { doExit?: boolean } = {},
) {
  const { doExit = true } = options;
  const tool = coreToolForWorkerTarget(target);
  applyCoreToolToPaintState(tool);
  return getLayerWorker().setTool(tool, doExit);
}

export function applyWorkerToolState(
  state: CoreToolState,
  options: { syncWorker?: boolean; doExit?: boolean } = {},
) {
  const { syncWorker = true, doExit = true } = options;
  applyCoreToolToPaintState(state.tool);

  if (syncWorker) {
    return getLayerWorker().setTool(state.tool, doExit);
  }

  return state;
}

export function syncWorkerToCurrentPaintTool(
  options: { doExit?: boolean } = {},
) {
  const { doExit = true } = options;
  return getLayerWorker().setTool(coreToolForCurrentPaintState(), doExit);
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
