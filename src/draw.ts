import { paintState } from "./main";
import { els } from "./elements";
import {
    canvas_coord_to_css_coord,
    position,
    to_pixel_canvas_coord,
} from "./position";
import { to_canvas_coord } from "./position";
import { getLayerWorker } from "./worker/workerPool";
import * as Comlink from "comlink";
import { applySelection, canvasSelect, selectionCancel } from "./selection";

export const toolManager = {
    setBrushTool() {
        paintState.setToolId("brush");

        const worker = getLayerWorker();
        applySelection();
        worker.setTool(paintState.toolId);

        console.log("brush");
    },
    setEraserTool() {
        paintState.setToolId("eraser");

        const worker = getLayerWorker();
        applySelection();
        worker.setTool(paintState.toolId);
    },
    setLiquifyTool() {
        paintState.setToolId("liquify");

        const worker = getLayerWorker();
        applySelection();
        worker.setTool(paintState.toolId);
    },
    setSelectTool() {
        applySelection();
        paintState.setToolId("select");

        const worker = getLayerWorker();
        worker.setTool(paintState.toolId);
    },
};

let pointerActive = false;

export async function tranferCanvas() {
    const worker = getLayerWorker();
    const offscreen = els.canvas.transferControlToOffscreen();

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
        els.container.addEventListener(
            "pointerdown",
            function (e: PointerEvent) {
                e.preventDefault();
                if (!paintState.pointerdown) return;
                if (paintState.action != "BRUSH") return;

                //  console.log("brushStart!");

                pointerActive = true;
                let point = to_canvas_coord(e.clientX, e.clientY);
                const worker = getLayerWorker();

                let brushSize = paintState.getBrushSize();
                let brushAlpha = paintState.getBrushAlpha();

                if (paintState.toolId == "brush") {
                    worker.setStrokeColor(
                        paintState.color.r,
                        paintState.color.g,
                        paintState.color.b,
                    );
                    worker.setStrokeSize(brushSize);
                    worker.setAlpha(brushAlpha);

                    worker.start(point);
                } else if (paintState.toolId == "eraser") {
                    worker.setStrokeSize(brushSize);
                    worker.setAlpha(brushAlpha);

                    worker.start(point);
                } else if (paintState.toolId == "liquify") {
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
            if (!pointerActive) return;

            let point = to_canvas_coord(e.clientX, e.clientY);

            const worker = getLayerWorker();
            let brushSize = paintState.getBrushSize();

            if (paintState.toolId == "brush") {
                worker.strokeTo(point);
            } else if (paintState.toolId == "eraser") {
                worker.strokeTo(point);
            } else if (paintState.toolId == "liquify") {
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
        });
    })();

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    (function () {
        let startPoint;
        let endPoint;

        let sp, ep;

        let activeSelect = false;

        els.container.addEventListener("pointerdown", (e) => {
            if (paintState.action != "BRUSH") return;
            if (paintState.toolId != "select") return;
            let point = to_pixel_canvas_coord(e.clientX, e.clientY);

            let px = clamp(point.x, 0, position.width);
            let py = clamp(point.y, 0, position.height);
            startPoint = { x: px, y: py };
            endPoint = { x: px, y: py };

            sp = {
                x: startPoint.x + (startPoint.x > endPoint.x ? 1 : 0),
                y: startPoint.y + (startPoint.y > endPoint.y ? 1 : 0),
            };

            ep = {
                x: endPoint.x + (startPoint.x <= endPoint.x ? 1 : 0),
                y: endPoint.y + (startPoint.y <= endPoint.y ? 1 : 0),
            };

            activeSelect = true;

            console.log("선택 시작");
        });

        window.addEventListener("pointermove", (e) => {
            if (paintState.action != "BRUSH") return;
            if (paintState.toolId != "select") return;
            if (!paintState.pointerdown) return;
            if (!activeSelect) return;

            let point = to_pixel_canvas_coord(e.clientX, e.clientY);

            let px = clamp(point.x, 0, position.width);
            let py = clamp(point.y, 0, position.height);
            endPoint = { x: px, y: py };

            sp = {
                x: startPoint.x + (startPoint.x > endPoint.x ? 1 : 0),
                y: startPoint.y + (startPoint.y > endPoint.y ? 1 : 0),
            };

            ep = {
                x: endPoint.x + (startPoint.x <= endPoint.x ? 1 : 0),
                y: endPoint.y + (startPoint.y <= endPoint.y ? 1 : 0),
            };

            let startCss = canvas_coord_to_css_coord(sp);
            let endCss = canvas_coord_to_css_coord(ep);

            let startX = Math.min(startCss.x, endCss.x);
            let startY = Math.min(startCss.y, endCss.y);
            let zoomW = Math.abs(startCss.x - endCss.x);
            let zoomH = Math.abs(startCss.y - endCss.y);

            els.zoomArea.style.visibility = "visible";
            els.zoomArea.style.left = `${startX}px`;
            els.zoomArea.style.top = `${startY}px`;
            els.zoomArea.style.width = `${zoomW}px`;
            els.zoomArea.style.height = `${zoomH}px`;
        });

        window.addEventListener("pointerup", (e) => {
            if (paintState.action != "BRUSH") return;
            if (paintState.toolId != "select") return;
            if (!activeSelect) return;
            activeSelect = false;

            els.zoomArea.style.visibility = "hidden";

            let startX = Math.min(sp.x, ep.x);
            let startY = Math.min(sp.y, ep.y);
            let zoomW = Math.abs(sp.x - ep.x);
            let zoomH = Math.abs(sp.y - ep.y);

            if (zoomH == 0 || zoomW == 0) {
                console.error("선택창이 0이 나올 수 없는데?");
                return;
            }
            canvasSelect(startX, startY, zoomW, zoomH);
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
