import { paintState } from "./main";
import { applyKeyAction, elementStore, updateCursorShape } from "./interface";
import { position, to_pixel_canvas_coord } from "./position";
import { to_canvas_coord } from "./position";
import { getLayerWorker } from "./worker/workerPool";
import * as Comlink from "comlink";
import { applySelection, canvasSelect, selectionCancel } from "./selection";

export let toolManager = {
    setBrushTool() {
        paintState.toolId = "brush";
        paintState.brushSize = 5;
        paintState.brushAlpha = 0.4;

        const worker = getLayerWorker();
        applySelection();
        worker.setTool(paintState.toolId);

        console.log("brush");
    },
    setEraserTool() {
        paintState.toolId = "eraser";
        paintState.brushSize = 10;
        paintState.brushAlpha = 1;

        const worker = getLayerWorker();
        applySelection();
        worker.setTool(paintState.toolId);
    },
    setLiquifyTool() {
        paintState.toolId = "liquify";
        paintState.brushSize = 10;
        paintState.brushAlpha = 1;

        const worker = getLayerWorker();
        applySelection();
        worker.setTool(paintState.toolId);
    },
    setSelectTool() {
        applySelection();
        paintState.toolId = "select";
    },
};

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
                if (!paintState.pointerdown) return;
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

    (function () {
        let sx, sy;
        let ex, ey;
        let activeSelect = false;

        elementStore.container.addEventListener("pointerdown", (e) => {
            if (paintState.action != "BRUSH") return;
            if (paintState.toolId != "select") return;

            sx = e.clientX;
            sy = e.clientY;
            ex = e.clientX;
            ey = e.clientY;
            activeSelect = true;

            elementStore.zoomArea.style.visibility = "visible";
            console.log("자르기");
            elementStore.zoomArea.style.left = `${sx}px`;
            elementStore.zoomArea.style.top = `${sy}px`;
            elementStore.zoomArea.style.width = `0px`;
            elementStore.zoomArea.style.height = `0px`;
        });

        window.addEventListener("pointermove", (e) => {
            if (paintState.action != "BRUSH") return;
            if (paintState.toolId != "select") return;
            if (!paintState.pointerdown) return;
            if (!activeSelect) return;
            ex = e.clientX;
            ey = e.clientY;
            let startX = sx < ex ? sx : ex;
            let startY = sy < ey ? sy : ey;
            let zoomW = Math.abs(sx - ex);
            let zoomH = Math.abs(sy - ey);
            elementStore.zoomArea.style.left = `${startX}px`;
            elementStore.zoomArea.style.top = `${startY}px`;
            elementStore.zoomArea.style.width = `${zoomW}px`;
            elementStore.zoomArea.style.height = `${zoomH}px`;
        });

        window.addEventListener("pointerup", (e) => {
            if (paintState.action != "BRUSH") return;
            if (paintState.toolId != "select") return;
            if (!activeSelect) return;
            activeSelect = false;

            elementStore.zoomArea.style.visibility = "hidden";

            let pointer = to_pixel_canvas_coord(sx, sy);
            let pointer2 = to_pixel_canvas_coord(ex, ey);
            let startX = pointer.x < pointer2.x ? pointer.x : pointer2.x;
            let startY = pointer.y < pointer2.y ? pointer.y : pointer2.y;
            let zoomW = Math.abs(pointer.x - pointer2.x);
            let zoomH = Math.abs(pointer.y - pointer2.y);
            canvasSelect(startX, startY, zoomW, zoomH);

            applyKeyAction();
            updateCursorShape();
        });
    })();

    globalThis.drawLine = () => {
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

    if (paintState.toolId == "selection") {
        selectionCancel();
        return;
    }
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
