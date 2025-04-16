/** draw.ts */
import { paintState } from "./main";
import { getLayerWorker } from "./worker/workerPool";
import { applySelection, selection, selectionCancel } from "./selection";
import { dispatch } from "./events/pointerEvents";
import { position } from "./position";

export const toolManager = {
    setBrushTool() {
        paintState.setToolId("brush");
        paintState.setBrushId("brush");

        const worker = getLayerWorker();
        applySelection();
        worker.setTool(paintState.brushId);

        console.log("brush");
    },
    setEraserTool() {
        paintState.setToolId("brush");
        paintState.setBrushId("eraser");

        const worker = getLayerWorker();
        applySelection();
        worker.setTool(paintState.brushId);
    },
    setLiquifyTool() {
        paintState.setToolId("brush");
        paintState.setBrushId("liquify");

        const worker = getLayerWorker();
        applySelection();
        worker.setTool(paintState.brushId);
    },
    setSelectTool() {
        applySelection();
        paintState.setToolId("select");

        const worker = getLayerWorker();
        worker.setTool(paintState.brushId);
    },
    setResizeTool() {
        applySelection();
        selection.setWidth(position.width);
        selection.setHeight(position.height);
        selection.setX(0);
        selection.setY(0);
        selection.setShowHint(true);
        selection.setShowHandle(true);
        paintState.setToolId("resize");
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

    dispatch(undefined, "cancel");
}
