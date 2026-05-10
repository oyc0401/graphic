/** draw.ts */
import { paintState } from "./paintState";
import { applySelection, selectionCancel } from "./selection";
import { dispatch } from "./events/pointerEvents";
import { setCoreTool } from "./coreToolState";
import { syncCoreState } from "./history";
import type { CoreTool } from "@/core/types";
import { getLayerWorker } from "./worker/workerPool";

function confirmLiquifyApply() {
  if (paintState.activeSessionTool !== "liquify") return true;
  return window.confirm("픽셀유동화를 적용하시겠습니까?");
}

function toolIdForCoreTool(tool: CoreTool) {
  switch (tool) {
    case "select":
    case "selection":
      return tool;
    case "brush":
    case "eraser":
    case "liquify":
      return "brush";
  }
}

function requestToolChange(
  tool: CoreTool,
  options: { applyCurrentSelection?: boolean } = {},
) {
  const { applyCurrentSelection = true } = options;
  if (paintState.pointerdown) return false;
  if (paintState.coreTool === tool) {
    paintState.setSelectedToolId(toolIdForCoreTool(tool));
    return false;
  }

  if (!confirmLiquifyApply()) return false;

  if (paintState.activeSessionTool === "liquify") {
    getLayerWorker().applyActiveSession();
    syncCoreState();
  } else if (applyCurrentSelection) {
    applySelection();
  }

  setCoreTool(tool);
  paintState.setSelectedToolId(toolIdForCoreTool(tool));
  syncCoreState();
  return true;
}

export const toolManager = {
  async setBrushTool() {
    if (requestToolChange("brush")) {
      console.log("brush");
    }
  },
  setEraserTool() {
    requestToolChange("eraser");
  },
  setLiquifyTool() {
    const returnTool =
      paintState.coreTool === "selection" ? "select" : paintState.coreTool;
    if (requestToolChange("liquify")) {
      paintState.setSessionReturnTool(returnTool);
    }
  },
  setSelectTool() {
    requestToolChange("select");
  },
  setZoomTool() {
    if (paintState.pointerdown) return;
    paintState.setSelectedToolId("zoom");
  },
  setColorPickerTool() {
    if (paintState.pointerdown) return;
    if (!confirmLiquifyApply()) return;

    if (paintState.activeSessionTool === "liquify") {
      getLayerWorker().applyActiveSession();
      syncCoreState();
    } else {
      applySelection();
    }

    setCoreTool("brush");
    syncCoreState();
    paintState.setSelectedToolId("colorPicker");
  },
  setSelection() {
    requestToolChange("selection", { applyCurrentSelection: false });
  },
  applyActiveSession() {
    if (paintState.pointerdown || paintState.activeSessionTool !== "liquify")
      return;

    const returnTool = paintState.sessionReturnTool ?? "brush";
    const nextTool = returnTool === "liquify" ? "brush" : returnTool;
    getLayerWorker().applyActiveSession();
    syncCoreState();
    setCoreTool(nextTool);
    paintState.setSelectedToolId(toolIdForCoreTool(nextTool));
    paintState.setSessionReturnTool(null);
    syncCoreState();
  },
  discardActiveSession() {
    if (paintState.pointerdown || paintState.activeSessionTool !== "liquify")
      return;

    const returnTool = paintState.sessionReturnTool ?? "brush";
    const nextTool = returnTool === "liquify" ? "brush" : returnTool;
    getLayerWorker().discardActiveSession();
    syncCoreState();
    setCoreTool(nextTool);
    paintState.setSelectedToolId(toolIdForCoreTool(nextTool));
    paintState.setSessionReturnTool(null);
    syncCoreState();
  },
};

/**
 * 원본 텍스쳐로 돌려놓기
 */
export function cancel() {
  console.log("cancel!");

  if (paintState.toolId == "selection") {
    selectionCancel();
    return;
  }

  dispatch(new PointerEvent("pointercancel"), "cancel");
}
