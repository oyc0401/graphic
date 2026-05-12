/** draw.ts */
import {
  paintState,
  SessionToolId,
  ToolId,
  type SessionReturnToolId,
} from "./paintState";
import { applySelection, selectionCancel } from "./selection";
import { dispatch } from "./events/pointerEvents";
import { setCoreTool } from "./coreToolState";
import { syncCoreState } from "./history";
import type { CoreTool } from "@/core/types";
import { getLayerWorker } from "./worker/workerPool";

function confirmLiquifyApply() {
  if (paintState.sessionToolId !== SessionToolId.Liquify) return true;
  return window.confirm("픽셀유동화를 적용하시겠습니까?");
}

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

function sessionReturnToolForCurrentTool(): SessionReturnToolId {
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

function restoreSessionReturnTool() {
  const returnTool = paintState.sessionReturnTool ?? ToolId.Brush;
  paintState.setSelectedToolId(returnTool);
  setCoreTool(paintState.coreTool);
  paintState.setSessionReturnTool(null);
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

  if (paintState.sessionToolId === SessionToolId.Liquify) {
    getLayerWorker().applyActiveSession();
    syncCoreState();
    paintState.setSessionReturnTool(null);
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
    if (paintState.pointerdown) return;
    if (requestToolChange("brush")) {
      console.log("brush");
    }
  },
  setEraserTool() {
    if (paintState.pointerdown) return;
    requestToolChange("eraser");
  },
  setLiquifyTool() {
    if (paintState.pointerdown) return;
    const returnTool = sessionReturnToolForCurrentTool();
    if (requestToolChange("liquify")) {
      paintState.setSessionReturnTool(returnTool);
    }
  },
  setSelectTool() {
    if (paintState.pointerdown) return;
    requestToolChange("select");
  },
  setZoomTool() {
    if (paintState.pointerdown) return;
    paintState.setSelectedToolId(ToolId.Zoom);
  },
  setColorPickerTool() {
    if (paintState.pointerdown) return;
    if (!confirmLiquifyApply()) return;

    if (paintState.sessionToolId === SessionToolId.Liquify) {
      getLayerWorker().applyActiveSession();
      syncCoreState();
      restoreSessionReturnTool();
      syncCoreState();
    } else {
      const shouldReturnToSelect =
        paintState.coreTool === "selection" ||
        paintState.toolId === ToolId.Selection;
      applySelection();
      if (shouldReturnToSelect) {
        setCoreTool("select");
        paintState.setSelectedToolId(ToolId.Select);
        syncCoreState();
      }
    }

    paintState.setSelectedToolId(ToolId.ColorPicker);
  },
  setSelection() {
    requestToolChange("selection", { applyCurrentSelection: false });
  },
  applyActiveSession() {
    if (
      paintState.pointerdown ||
      paintState.sessionToolId !== SessionToolId.Liquify
    )
      return;

    getLayerWorker().applyActiveSession();
    syncCoreState();
    restoreSessionReturnTool();
    syncCoreState();
  },
  discardActiveSession() {
    if (
      paintState.pointerdown ||
      paintState.sessionToolId !== SessionToolId.Liquify
    )
      return;

    getLayerWorker().discardActiveSession();
    syncCoreState();
    restoreSessionReturnTool();
    syncCoreState();
  },
};

/**
 * 원본 텍스쳐로 돌려놓기
 */
export function cancel() {
  console.log("cancel!");

  if (paintState.toolId === ToolId.Selection) {
    selectionCancel();
    return;
  }

  dispatch(new PointerEvent("pointercancel"), "cancel");
}
