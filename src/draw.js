import { paintState, applyKeyAction, setCursor } from "./main";
import { position } from "./position";
import { to_canvas_coord, to_screen_coord } from "./position";
import { workerApi } from "./worker/api";
import { getLayerWorker } from "./worker/workerPool";
import * as Comlink from "comlink";

/**
 * 원본 텍스쳐로 돌려놓기
 */
export function cancel() {
    const worker = getLayerWorker();
    worker.cancel(layerId);
}

/**
 * 현재 이미지를 원본 텍스쳐에 덮어쓰기
 */
export function endDrawing() {
    console.log("endDrawing!");
    pointerActive = false;

    const worker = getLayerWorker();
    // resetImageTexture
    if (toolId == "brush") {
        worker.drawEnd(layerId);
    } else if (toolId == "eraser") {
        worker.eraserEnd(layerId);
    } else if (toolId == "liquify") {
    }
}

export let layer = {
    canvas: document.querySelector("#canvas"),
    draw_canvas: document.querySelector("#draw-canvas"),
    //ctx: document.querySelector("#canvas").getContext("2d"),
    //draw_ctx: document.querySelector("#draw-canvas").getContext("2d"),
    width: 500,
    height: 500,
    reset() {
        // 이 작업은 캔버스의 내용을 모두 지우고, 크기를 조정합니다.
        this.canvas.width = position.width;
        this.canvas.height = position.height;

        this.draw_canvas.width = position.width;
        this.draw_canvas.height = position.height;
    },
};

const layerId = "SingleLayer";
const layerName = "SingleLayerName";

let toolId = "brush";

function updateUI() {
    document.querySelector("#select-brush").classList.remove("selected");
    document.querySelector("#select-eraser").classList.remove("selected");

    if (toolId == "brush") {
        document.querySelector("#select-brush").classList.add("selected");
    } else if (toolId == "eraser") {
        document.querySelector("#select-eraser").classList.add("selected");
    } else if (toolId == "liquify") {
    }
}

export function initUI() {
    updateUI();

    const worker = getLayerWorker();

    document.querySelector("#select-brush").addEventListener("click", () => {
        if (toolId == "liquify") {
            worker.liquifyReset(layerId);
        }
        toolId = "brush";
        paintState.brushSize = 5;
        paintState.brushAlpha = 0.3;

        updateUI();
    });

    document.querySelector("#select-eraser").addEventListener("click", () => {
        if (toolId == "liquify") {
            worker.liquifyReset(layerId);
        }
        toolId = "eraser";
        paintState.brushSize = 10;
        paintState.brushAlpha = 1;
        updateUI();
    });

    document.querySelector("#select-liquify").addEventListener("click", () => {
        toolId = "liquify";
        paintState.brushSize = 10;
        paintState.brushAlpha = 1;
        updateUI();
    });
}

let pointerActive = false;

export async function initDraw() {
    layer.reset();

    const worker = getLayerWorker();
    const offscreen = layer.canvas.transferControlToOffscreen();

    await worker.makeLayer(
        layerId,
        layerName,
        Comlink.transfer(offscreen, [offscreen]),
        layer.width,
        layer.height,
        0,
    );

    // 이거 안하면 드래그중에 브러시로 바뀌면 pointerdown을 스킵하고 move부터 시작하게 됌.

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

            if (toolId == "brush") {
                worker.setStrokeColor(layerId, 10, 10, 0);
                worker.setStrokeSize(layerId, paintState.brushSize);
                worker.setAlpha(layerId, paintState.brushAlpha);

                worker.drawStart(layerId, point);
                worker.drawTo(layerId, point);
            } else if (toolId == "eraser") {
                worker.setStrokeSize(layerId, paintState.brushSize);
                worker.setAlpha(layerId, paintState.brushAlpha);

                worker.eraserStart(layerId, point);
                worker.eraserTo(layerId, point);
            } else if (toolId == "liquify") {
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

        const worker = getLayerWorker();

        if (toolId == "brush") {
            worker.drawTo(layerId, point);
        } else if (toolId == "eraser") {
            worker.eraserTo(layerId, point);
        } else if (toolId == "liquify") {
            worker.liquifyTo(layerId, point);
        }
    });

    window.addEventListener("pointerup", (e) => {
        e.preventDefault();
        if (paintState.action != "BRUSH") return;
        if (!pointerActive) return;

        let point = to_canvas_coord(e.clientX, e.clientY);
        const worker = getLayerWorker();
        if (toolId == "brush") {
            worker.drawTo(layerId, point);
        } else if (toolId == "eraser") {
            worker.eraserTo(layerId, point);
        } else if (toolId == "liquify") {
        }

        pointerActive = false;
        endDrawing();

        applyKeyAction();
        setCursor();
    });
}
