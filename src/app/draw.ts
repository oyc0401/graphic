/** draw.ts */
import { paintState } from "./paintState";
import { applySelection, selection, selectionCancel } from "./selection";
import { dispatch } from "./events/pointerEvents";
import { position } from "./position";
import { setCoreTool } from "./coreToolState";

export const toolManager = {
  async setBrushTool() {
    if (paintState.pointerdown) return;

    applySelection();
    setCoreTool("brush");

    console.log("brush");
  },
  setEraserTool() {
    if (paintState.pointerdown) return;

    applySelection();
    setCoreTool("eraser");
  },
  setLiquifyTool() {
    if (paintState.pointerdown) return;

    applySelection();
    setCoreTool("liquify");
  },
  setSelectTool() {
    if (paintState.pointerdown) return;
    applySelection();
    setCoreTool("select");
  },
  setSelection() {
    if (paintState.pointerdown) return;
    setCoreTool("selection");
  },
  setResizeTool() {
    if (paintState.pointerdown) return;

    applySelection();
    selection.setWidth(position.width);
    selection.setHeight(position.height);
    selection.setX(0);
    selection.setY(0);
    selection.setShowHint(true);
    selection.setShowHandle(true);
    setCoreTool("resize");
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
