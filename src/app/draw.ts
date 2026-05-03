/** draw.ts */
import { paintState } from "./paintState";
import { applySelection, selectionCancel } from "./selection";
import { dispatch } from "./events/pointerEvents";
import { setCoreTool } from "./coreToolState";
import { historyState } from "./history";
import { getLayerWorker } from "./worker/workerPool";

function syncHistoryCount() {
  let { undoCount, redoCount } = getLayerWorker().getHistoryCount();
  historyState.setUndoCount(undoCount);
  historyState.setRedoCount(redoCount);
}

export const toolManager = {
  async setBrushTool() {
    if (paintState.pointerdown) return;

    applySelection();
    setCoreTool("brush");
    syncHistoryCount();

    console.log("brush");
  },
  setEraserTool() {
    if (paintState.pointerdown) return;

    applySelection();
    setCoreTool("eraser");
    syncHistoryCount();
  },
  setLiquifyTool() {
    if (paintState.pointerdown) return;

    applySelection();
    setCoreTool("liquify");
    syncHistoryCount();
  },
  setSelectTool() {
    if (paintState.pointerdown) return;
    applySelection();
    setCoreTool("select");
    syncHistoryCount();
  },
  setSelection() {
    if (paintState.pointerdown) return;
    setCoreTool("selection");
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
