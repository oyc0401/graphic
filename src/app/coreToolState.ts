import type { CoreTool, CoreToolState } from "@/core/types";
import { paintState } from "./paintState";
import { getLayerWorker } from "./worker/workerPool";

export function toCoreToolState(tool: CoreTool): CoreToolState {
  return { tool };
}

export function applyCoreToolState(
  coreState: CoreToolState,
  options: { syncWorker?: boolean; doExit?: boolean } = {},
) {
  const { syncWorker = true, doExit = true } = options;

  switch (coreState.tool) {
    case "brush":
    case "eraser":
    case "liquify":
      paintState.setToolId("brush");
      paintState.setBrushId(coreState.tool);
      break;
    case "select":
    case "selection":
      paintState.setToolId(coreState.tool);
      break;
  }

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
