import { paintState } from "./main";
import { position } from "./position";
import { to_canvas_coord, to_screen_coord } from "./position";
import { getLayerWorker } from "./worker/workerPool";
import * as Comlink from "comlink";

let pointer_active = false;

export function cancel() {
    pointer_active = false;
    const worker = getLayerWorker();
    worker.cancel(layerId);
}

export function endDrawing() {
    pointer_active = false;
}

export let layer = {
    canvas: document.querySelector("#canvas"),
    draw_canvas: document.querySelector("#draw-canvas"),
    //ctx: document.querySelector("#canvas").getContext("2d"),
    //draw_ctx: document.querySelector("#draw-canvas").getContext("2d"),
    width: 300,
    height: 300,
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
    document
        .querySelector("#container")
        .addEventListener("pointerdown", (e) => {
            e.preventDefault();
            if (paintState.action != "BRUSH") return;
            if (pointer_active) return;
            to_screen_coord(e.clientX, e.clientY);
            pointer_active = true;
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
            if (!pointer_active) return;

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
            // worker.drawEnd(layerId);
        } else {
            // worker.eraserEnd(layerId);
        }
    });
}

///////////////////////////////////////////////////

function normalize(vx, vy) {
    let mag = Math.sqrt(vx * vx + vy * vy);
    return { x: vx / mag, y: vy / mag };
}

function computeControlPoint(p0, p1, p2, power = 4) {
    // 벡터 d = p0 - p2
    let dx = p0.x - p2.x;
    let dy = p0.y - p2.y;

    // 정규화된 방향 벡터
    let unit = normalize(dx, dy);

    // 이동 거리 = len(p0, p1) / 4
    let d = Math.hypot(p1.x - p0.x, p1.y - p0.y) / power;

    // 최종 조절점
    return {
        x: p1.x + unit.x * d,
        y: p1.y + unit.y * d,
    };
}

let points = [];

function draw() {
    layer.draw_ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (points.length == 1) return;
    if (points.length == 2) {
        draw0(points[0], points[1]);
        console.log("직선");
        return;
    }
    for (let i = 0; i < points.length - 1; i++) {
        if (i == 0) {
            draw1(points[i], points[i + 1], points[i + 2]);
            // console.log(i, i + 1, i + 2);
        } else if (i == points.length - 2) {
            draw3(points[i - 1], points[i], points[i + 1]);

            // console.log(i - 1, i, i + 1);
        } else {
            draw2(points[i - 1], points[i], points[i + 1], points[i + 2]);
            // console.log(i - 1, i, i + 1, i + 2);
        }
    }
    layer.draw_ctx.stroke(); // 그리기
}

function draw0(p0, p1) {
    layer.draw_ctx.beginPath();
    layer.draw_ctx.moveTo(p0.x, p0.y); // 시작점으로 이동
    layer.draw_ctx.lineTo(p1.x, p1.y);
}
//draw1(points[0], points[1], points[2]);
function draw1(p0, p1, p2) {
    let a0 = computeControlPoint(p0, p1, p2);
    layer.draw_ctx.beginPath();
    layer.draw_ctx.moveTo(p0.x, p0.y); // 시작점으로 이동
    layer.draw_ctx.quadraticCurveTo(a0.x, a0.y, p1.x, p1.y);
}

//draw2(points[0], points[1], points[2], points[3]);
function draw2(p0, p1, p2, p3) {
    let a0 = computeControlPoint(p2, p1, p0);
    let a1 = computeControlPoint(p1, p2, p3);
    layer.draw_ctx.bezierCurveTo(a0.x, a0.y, a1.x, a1.y, p2.x, p2.y);
}

//draw3(points[1], points[2], points[3]);
function draw3(p0, p1, p2) {
    let a0 = computeControlPoint(p2, p1, p0);
    layer.draw_ctx.quadraticCurveTo(a0.x, a0.y, p2.x, p2.y);
}
