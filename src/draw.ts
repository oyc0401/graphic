import { paintState } from "./main";
import { applyKeyAction, elementStore, updateCursorShape } from "./interface";
import { position } from "./position";
import { to_canvas_coord, to_screen_coord } from "./position";
import { getLayerWorker } from "./worker/workerPool";
import * as Comlink from "comlink";

export let toolManager = {
    setBrushTool() {
        paintState.toolId = "brush";
        paintState.brushSize = 5;
        paintState.brushAlpha = 1;

        const worker = getLayerWorker();
        worker.applySelection();
        position.resizeScreen();
        worker.setTool(paintState.toolId);

        console.log("brush");
    },
    setEraserTool() {
        paintState.toolId = "eraser";
        paintState.brushSize = 10;
        paintState.brushAlpha = 1;

        const worker = getLayerWorker();
        worker.applySelection();
        position.resizeScreen();
        worker.setTool(paintState.toolId);
    },
    setLiquifyTool() {
        paintState.toolId = "liquify";
        paintState.brushSize = 10;
        paintState.brushAlpha = 1;

        const worker = getLayerWorker();
        worker.applySelection();
        position.resizeScreen();
        worker.setTool(paintState.toolId);
    },
};

document.querySelector("#selection-button")?.addEventListener("click", () => {
    let worker = getLayerWorker();
    worker.makeSelection();
    position.resizeScreen();
    paintState.toolId = "selection";
}); 

let pointerActive = false;

export async function initDraw() {
    const worker = getLayerWorker();
    const offscreen = elementStore.canvas.transferControlToOffscreen();

    await worker.makeLayer(
        Comlink.transfer(offscreen, [offscreen]),
        position.width,
        position.height,
        position.bouncingRect.width,
        position.bouncingRect.height,
        position.dpr,
    );
}

export function addDrawEvent() {
    let start = { x: 0, y: 0 };
    let end = { x: 0, y: 0 };

    (function () {
        elementStore.container.addEventListener(
            "pointerdown",
            function (e: PointerEvent) {
                e.preventDefault();
                if (paintState.action != "BRUSH") return;

                //  console.log("brushStart!");

                pointerActive = true;
                let point = to_canvas_coord(e.clientX, e.clientY);
                const worker = getLayerWorker();

                if (paintState.toolId == "brush") {
                    worker.setStrokeColor(0, 255, 255);
                    worker.setStrokeSize(paintState.brushSize);
                    worker.setAlpha(paintState.brushAlpha);

                    worker.start(point);
                } else if (paintState.toolId == "eraser") {
                    worker.setStrokeSize(paintState.brushSize);
                    worker.setAlpha(paintState.brushAlpha);

                    worker.start(point);
                } else if (paintState.toolId == "liquify") {
                    worker.setStrokeSize(paintState.brushSize);
                    worker.setAlpha(paintState.brushAlpha);

                    worker.start(point);
                    start = { x: e.clientX, y: e.clientY };
                    end = { x: e.clientX, y: e.clientY };
                }
            },
        );

        window.addEventListener("pointermove", (e) => {
            e.preventDefault();
            // console.log(to_canvas_coord(e.clientX, e.clientY))
            if (!paintState.pointerdown) return;
            if (paintState.action != "BRUSH") return;
            if (!pointerActive) return;

            let point = to_canvas_coord(e.clientX, e.clientY);

            // console.log("current point", point);
            const worker = getLayerWorker();

            if (paintState.toolId == "brush") {
                worker.strokeTo(point);
            } else if (paintState.toolId == "eraser") {
                worker.strokeTo(point);
            } else if (paintState.toolId == "liquify") {
                end = point;

                let length = Math.hypot(end.x - start.x, end.y - start.y);
                if (length > paintState.brushSize / 25) {
                    worker.strokeTo(point);
                    start = end;
                }
            }
        });

        window.addEventListener("pointerup", (e) => {
            e.preventDefault();
            if (paintState.action != "BRUSH") return;
            if (!pointerActive) return;

            let point = to_canvas_coord(e.clientX, e.clientY);
            const worker = getLayerWorker();
            if (paintState.toolId == "brush") {
                worker.strokeTo(point);
            } else if (paintState.toolId == "eraser") {
                worker.strokeTo(point);
            } else if (paintState.toolId == "liquify") {
            }

            pointerActive = false;
            endDrawing();

            applyKeyAction();
            updateCursorShape();
        });
    })();

    window.drawLine = () => {
        const worker = getLayerWorker();
        worker.setStrokeColor(10, 10, 0);
        worker.setStrokeSize(paintState.brushSize);
        worker.setAlpha(paintState.brushAlpha);

        worker.start({ x: 50, y: 50 });
        worker.strokeTo({ x: 630.2, y: 300 });
    };
}

/**
 * 원본 텍스쳐로 돌려놓기
 */
export function cancel() {
    console.log("cancel!");
    pointerActive = false;

    const worker = getLayerWorker();
    worker.cancel();
}

/**
 * 그리기 종료
 */
export function endDrawing() {
    console.log("end!");
    pointerActive = false;

    const worker = getLayerWorker();
    worker.end();
}
