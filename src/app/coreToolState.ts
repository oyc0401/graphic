import type { CoreTool, CoreToolState } from "@/core/types";
import { paintState, ToolId } from "./paintState";
import { getLayerWorker } from "./worker/workerPool";

function toolIdForCoreTool(tool: CoreTool) {
  switch (tool) {
    case "select":
      return ToolId.Select;
    case "selection":
      return ToolId.Selection;
    case "brush":
    case "eraser":
      return ToolId.Brush;
    case "liquify":
      return ToolId.Session;
  }
}

export function toCoreToolState(tool: CoreTool): CoreToolState {
  return { tool };
}

export function applyCoreToolState(
  coreState: CoreToolState,
  options: { syncWorker?: boolean; doExit?: boolean } = {},
) {
  const { syncWorker = true, doExit = true } = options;
  paintState.setCoreTool(coreState.tool);
  paintState.setSelectedToolId(toolIdForCoreTool(coreState.tool));

  if (syncWorker) {
    return getLayerWorker().setTool(coreState.tool, doExit);
  }

  return coreState;
}

export function setCoreTool(
  tool: CoreTool,
  options: { doExit?: boolean } = {},
) {
  return applyCoreToolState(toCoreToolState(tool), options);
}
