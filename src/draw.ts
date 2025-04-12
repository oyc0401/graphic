import { paintState } from "./main";
import { els } from "./elements";
import { getPixelRatio, position } from "./position";
import { to_canvas_coord } from "./position";
import { getLayerWorker } from "./worker/workerPool";
import * as Comlink from "comlink";
import { applySelection, selectionCancel } from "./selection";

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

let pointerActive = false;

export async function tranferCanvas() {
    const worker = getLayerWorker();
    const offscreen = els.canvas.transferControlToOffscreen();

    let dpr = getPixelRatio();
    await worker.makeLayer(
        Comlink.transfer(offscreen, [offscreen]),
        position.bouncingRect.width * dpr,
        position.bouncingRect.height * dpr,
        dpr,
        position.width,
        position.height,
        position.x * dpr,
        position.y * dpr,
        position.scale,
    );

    // // 캔버스 렌더링
    // setCameraPosition();
    // resizeScreen();
    // resizeLayer();
    // render();
}

export function addDrawEvent() {
    let start = { x: 0, y: 0 };
    let end = { x: 0, y: 0 };

    (function () {
        els.container.addEventListener(
            "pointerdown",
            function (e: PointerEvent) {
                e.preventDefault();
                if (!paintState.pointerdown) return;
                if (paintState.action != "BRUSH") return;
                if (paintState.toolId != "brush") return;
                //  console.log("brushStart!");

                pointerActive = true;
                let point = to_canvas_coord(e.clientX, e.clientY);
                const worker = getLayerWorker();

                let brushSize = paintState.getBrushSize();
                let brushAlpha = paintState.getBrushAlpha();

                if (paintState.brushId == "brush") {
                    worker.setStrokeColor(
                        paintState.color.r,
                        paintState.color.g,
                        paintState.color.b,
                    );
                    worker.setStrokeSize(brushSize);
                    worker.setAlpha(brushAlpha);

                    worker.start(point);
                } else if (paintState.brushId == "eraser") {
                    worker.setStrokeSize(brushSize);
                    worker.setAlpha(brushAlpha);

                    worker.start(point);
                } else if (paintState.brushId == "liquify") {
                    worker.setStrokeSize(brushSize);
                    worker.setAlpha(brushAlpha);

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
            if (paintState.toolId != "brush") return;
            if (!pointerActive) return;

            let point = to_canvas_coord(e.clientX, e.clientY);

            const worker = getLayerWorker();
            let brushSize = paintState.getBrushSize();

            if (paintState.brushId == "brush") {
                worker.strokeTo(point);
            } else if (paintState.brushId == "eraser") {
                worker.strokeTo(point);
            } else if (paintState.brushId == "liquify") {
                end = point;

                let length = Math.hypot(end.x - start.x, end.y - start.y);
                if (length > brushSize / 25) {
                    worker.strokeTo(point);
                    start = end;
                }
            }

            paintState.setDrawdownAndMoved(true);
            paintState.setCursorPosition(e.clientX, e.clientY);
        });

        window.addEventListener("pointerup", (e) => {
            e.preventDefault();
            if (paintState.action != "BRUSH") return;
            if (paintState.toolId != "brush") return;
            if (!pointerActive) return;

            let point = to_canvas_coord(e.clientX, e.clientY);
            const worker = getLayerWorker();
            if (paintState.brushId == "brush") {
                worker.strokeTo(point);
            } else if (paintState.brushId == "eraser") {
                worker.strokeTo(point);
            } else if (paintState.brushId == "liquify") {
            }

            endDrawing();

            pointerActive = false;
        });
    })();
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
    if(paintState.toolId=='brush'){
          worker.cancel();
    }
  
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
