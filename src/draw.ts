/** draw.ts */
import { paintState } from "./main";
import { els } from "./elements";
import { getPixelRatio, position } from "./position";
import { getLayerWorker } from "./worker/workerPool";
import * as Comlink from "comlink";
import { applySelection, selectionCancel } from "./selection";
import { toolRegistry } from "./tools";
import { dispatch } from "./pointerEvents";

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
};

/**
 * 원본 텍스쳐로 돌려놓기
 */
export function cancel(event) {
    console.log("cancel!");

    if (paintState.toolId == "selection") {
        selectionCancel();
        return;
    }
    
    dispatch(event, "cancel");
}


