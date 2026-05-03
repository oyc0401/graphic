/** draw.ts */
import { paintState } from "./paintState";
import { applySelection, selectionCancel } from "./selection";
import { dispatch } from "./events/pointerEvents";
import { setCoreTool } from "./coreToolState";
import { syncHistoryCount } from "./history";
import type { CoreTool } from "@/core/types";
import { getLayerWorker } from "./worker/workerPool";

function confirmLiquifyApply() {
  if (paintState.coreTool !== "liquify") return true;
  return window.confirm("픽셀유동화를 적용하시겠습니까?");
}

function setToolWithLiquifyConfirm(
  tool: CoreTool,
  options: { applyCurrentSelection?: boolean } = {},
) {
  const { applyCurrentSelection = true } = options;
  if (paintState.pointerdown) return false;
  if (paintState.coreTool === tool) return false;

  if (!confirmLiquifyApply()) return false;

  if (paintState.coreTool === "liquify") {
    getLayerWorker().applyLiquify();
  } else if (applyCurrentSelection) {
    applySelection();
  }

  setCoreTool(tool);
  syncHistoryCount();
  return true;
}

export const toolManager = {
  async setBrushTool() {
    if (setToolWithLiquifyConfirm("brush")) {
      console.log("brush");
    }
  },
  setEraserTool() {
    setToolWithLiquifyConfirm("eraser");
  },
  setLiquifyTool() {
    if (paintState.pointerdown) return;
    if (paintState.coreTool === "liquify") return;

    applySelection();
    setCoreTool("liquify");
    syncHistoryCount();
  },
  setSelectTool() {
    setToolWithLiquifyConfirm("select");
  },
  setSelection() {
    setToolWithLiquifyConfirm("selection", { applyCurrentSelection: false });
  },
  applyLiquify() {
    if (paintState.pointerdown || paintState.coreTool !== "liquify") return;

    getLayerWorker().applyLiquify();
    setCoreTool("brush");
    syncHistoryCount();
  },
  cancelLiquify() {
    if (paintState.pointerdown || paintState.coreTool !== "liquify") return;

    getLayerWorker().cancelLiquify();
    setCoreTool("brush");
    syncHistoryCount();
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
