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

function requestToolChange(
  tool: CoreTool,
  options: { applyCurrentSelection?: boolean } = {},
) {
  const { applyCurrentSelection = true } = options;
  if (paintState.pointerdown) return false;
  if (paintState.coreTool === tool) return false;

  if (!confirmLiquifyApply()) return false;

  if (paintState.activeSessionTool === "liquify") {
    getLayerWorker().applyActiveSession();
    syncCoreState();
  } else if (applyCurrentSelection) {
    applySelection();
  }

  setCoreTool(tool);
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
    requestToolChange("liquify");
  },
  setSelectTool() {
    requestToolChange("select");
  },
  setSelection() {
    requestToolChange("selection", { applyCurrentSelection: false });
  },
  applyActiveSession() {
    if (paintState.pointerdown || paintState.activeSessionTool !== "liquify")
      return;

    getLayerWorker().applyActiveSession();
    syncCoreState();
    setCoreTool("brush");
    syncCoreState();
  },
  discardActiveSession() {
    if (paintState.pointerdown || paintState.activeSessionTool !== "liquify")
      return;

    getLayerWorker().discardActiveSession();
    syncCoreState();
    setCoreTool("brush");
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
