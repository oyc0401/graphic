import { paintState } from "./main";
import { position } from "./position";
import { to_canvas_coord, to_screen_coord } from "./position";
import { getLayerWorker } from "./worker/workerPool";
import * as Comlink from "comlink";

let pointer_active = false;

export function cancel() {
    const worker = getLayerWorker();
    worker.cancel(layerId);

    endDrawing();
}

export function endDrawing() {
    document.querySelector("#container").dispatchEvent(new Event("pointerup")); // 브러시 드로우 포인터 업
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

window.changeTool = function () {
    if (toolId == "brush") {
        toolId = "eraser";
    } else {
        toolId = "brush";
    }
    return toolId;
};

let changeBtn = document.querySelector("#changeTool");
changeBtn.addEventListener("click", () => {
    window.changeTool();
});

document.querySelector("#cancel").addEventListener("click", () => {
    cancel();
});

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

    //let pointerId;
    document
       .querySelector("#container")
        .addEventListener("pointerdown", (e) => {
            e.preventDefault();
            if (paintState.action != "BRUSH") return;
            if (pointer_active) return;
            to_screen_coord(e.clientX, e.clientY);
            pointer_active = true;
            //pointerId = e.pointerId;
            let point = to_canvas_coord(e.clientX, e.clientY);
            const worker = getLayerWorker();

            if (toolId == "brush") {
                worker.setStrokeColor(layerId, 0, 255, 255);
                worker.setStrokeSize(layerId, 5);
                worker.setAlpha(layerId, 0.2);

                worker.drawStart(layerId, point);
            } else {
                worker.setStrokeSize(layerId, 10);
                worker.setAlpha(layerId, 1);

                worker.eraserStart(layerId, point);
            }
        });

    document
        .querySelector("#container")
        .addEventListener("pointermove", (e) => {
            e.preventDefault();
            if (paintState.action != "BRUSH") {
                endDrawing();
                return;
            }
            if (!pointer_active) return;

            //if (pointerId != e.pointerId) return; // 이렇게 안해도 되는 이유는 모바일 캡쳐 때문임.

            let point = to_canvas_coord(e.clientX, e.clientY);

            const worker = getLayerWorker();

            if (toolId == "brush") {
                worker.drawTo(layerId, point);
            } else {
                worker.eraserTo(layerId, point);
            }
        });

    document.querySelector("#container").addEventListener("pointerup", (e) => {
        e.preventDefault();
        if (!pointer_active) return;
        pointer_active = false;
        const worker = getLayerWorker();
        if (toolId == "brush") {
            worker.drawEnd(layerId);
        } else {
            worker.eraserEnd(layerId);
        }
    });
}
