import { paintState } from "./main";
import { applyKeyAction, updateCursor } from "./interface";
import { position } from "./position";
import { to_canvas_coord, to_screen_coord } from "./position";
import { getLayerWorker } from "./worker/workerPool";
import * as Comlink from "comlink";

export let toolManager = {
    setBrushTool() {
        if (paintState.toolId == "liquify") {
            worker.liquifyReset(layerId);
        }
        paintState.toolId = "brush";
        paintState.brushSize = 5;
        paintState.brushAlpha = 0.3;
    },
    setEraserTool() {
        if (paintState.toolId == "liquify") {
            worker.liquifyReset(layerId);
        }
        paintState.toolId = "eraser";
        paintState.brushSize = 10;
        paintState.brushAlpha = 1;
    },
    setLiquifyTool() {
        paintState.toolId = "liquify";
        paintState.brushSize = 100;
        paintState.brushAlpha = 1;
    },
};

/**
 * 원본 텍스쳐로 돌려놓기
 */
export function cancel() {
    const worker = getLayerWorker();

    if (paintState.toolId == "brush") {
        worker.cancel(layerId);
    } else if (paintState.toolId == "eraser") {
        worker.cancel(layerId);
    } else if (paintState.toolId == "liquify") {
        worker.liquifyCancel(layerId);
    }
}

/**
 * 현재 이미지를 원본 텍스쳐에 덮어쓰기
 */
export function endDrawing() {
    console.log("endDrawing!");
    pointerActive = false;

    const worker = getLayerWorker();
    if (paintState.toolId == "brush") {
        worker.drawEnd(layerId);
    } else if (paintState.toolId == "eraser") {
        worker.eraserEnd(layerId);
    } else if (paintState.toolId == "liquify") {
        worker.liquifyEnd(layerId);
    }
}

const layerId = "SingleLayer";

let pointerActive = false;

export async function initDraw() {
    const worker = getLayerWorker();
    let canvas = document.querySelector("#canvas");
    const offscreen = canvas.transferControlToOffscreen();

    worker.makeLayer(
        layerId,
        Comlink.transfer(offscreen, [offscreen]),
        position.width,
        position.height,
        0,
        position.bouncingRect.width,
        position.bouncingRect.height,
    );

 
    (function () {
        document
            .querySelector("#container")
            .addEventListener("pointerdown", (e) => {
                e.preventDefault();
                if (paintState.action != "BRUSH") return;
                to_screen_coord(e.clientX, e.clientY);
                console.log("brushStart!");

                pointerActive = true;
                let point = to_canvas_coord(e.clientX, e.clientY);
                const worker = getLayerWorker();

                if (paintState.toolId == "brush") {
                    worker.setStrokeColor(layerId, 10, 10, 0);
                    worker.setStrokeSize(layerId, paintState.brushSize);
                    worker.setAlpha(layerId, paintState.brushAlpha);

                    worker.drawStart(layerId, point);
                    worker.drawTo(layerId, point);
                } else if (paintState.toolId == "eraser") {
                    worker.setStrokeSize(layerId, paintState.brushSize);
                    worker.setAlpha(layerId, paintState.brushAlpha);

                    worker.eraserStart(layerId, point);
                    worker.eraserTo(layerId, point);
                } else if (paintState.toolId == "liquify") {
                    worker.setStrokeSize(layerId, paintState.brushSize);
                    worker.setAlpha(layerId, paintState.brushAlpha);

                    worker.liquifyStart(layerId, point);
                }
            });

        window.addEventListener("pointermove", (e) => {
            e.preventDefault();
            if (!paintState.pointerdown) return;
            if (paintState.action != "BRUSH") return;
            if (!pointerActive) return;

            let point = to_canvas_coord(e.clientX, e.clientY);

            // console.log("current point", point);
            const worker = getLayerWorker();

            if (paintState.toolId == "brush") {
                worker.drawTo(layerId, point);
            } else if (paintState.toolId == "eraser") {
                worker.eraserTo(layerId, point);
            } else if (paintState.toolId == "liquify") {
                worker.liquifyTo(layerId, point);
            }
        });

        window.addEventListener("pointerup", (e) => {
            e.preventDefault();
            if (paintState.action != "BRUSH") return;
            if (!pointerActive) return;

            let point = to_canvas_coord(e.clientX, e.clientY);
            const worker = getLayerWorker();
            if (paintState.toolId == "brush") {
                worker.drawTo(layerId, point);
            } else if (paintState.toolId == "eraser") {
                worker.eraserTo(layerId, point);
            } else if (paintState.toolId == "liquify") {
            }

            pointerActive = false;
            endDrawing();

            applyKeyAction();
            updateCursor();
        });
    })();
}
