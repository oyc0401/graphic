import { initDraw } from "./draw";
import { initPosition, position } from "./position";

window.onload = main;

//////////////////////////
export let paintState = {
    action: "BRUSH",
    brushSize: 10,
    container: document.querySelector("#container"),
    layer_area: document.querySelector("#layer-area"),
    bouncingRect: null,
    updateBouncingRect() {
        this.bouncingRect = this.container.getBoundingClientRect();
    },
};

export let layer = {
    canvas: document.querySelector("#canvas"),
    draw_canvas: document.querySelector("#draw-canvas"),
    ctx: document.querySelector("#canvas").getContext("2d"),
    draw_ctx: document.querySelector("#draw-canvas").getContext("2d"),
    width: 300,
    height: 300,
    reset() {
        // 이 작업은 캔버스의 내용을 모두 지우고, 크기를 조정합니다.
        this.canvas.width = position.width;
        this.canvas.height = position.height;

        this.draw_canvas.width = position.width;
        this.draw_canvas.height = position.height;
    },
    style() {
        this.draw_ctx.lineJoin = "round";
        this.draw_ctx.lineCap = "round";
        this.draw_ctx.lineWidth = paintState.brushSize; // 고정된 브러시 크기
        this.draw_ctx.strokeStyle = "rgba(255,0,0,0.5)"; // 브러시 색상 설정
    },
};

export function cancel() {
    layer.draw_ctx.clearRect(0, 0, position.width, position.height);
}

function main() {
    initPosition();
    initDraw();

    initiaize();
}

function initiaize() {
    paintState.updateBouncingRect();

    layer.reset();
    layer.style();

    position.resizeScreen();

    setKey();
}

/**
 * 단축키
 */
function setKey() {
    (function () {
        document.addEventListener("keydown", (event) => {
            //console.log(event);
            if (event.code == "KeyZ") {
                event.preventDefault();
                paintState.action = "ZOOM";
            }
            if (event.code === "Space") {
                event.preventDefault();
                //console.log("스페이스바 눌림!");
                paintState.action = "PAN";
            }
        });

        document.addEventListener("keyup", (event) => {
            if (event.code == "KeyZ") {
                event.preventDefault();
                if (paintState.action != "ZOOM") return;
                paintState.action = "BRUSH";
            }
            if (event.code === "Space") {
                if (paintState.action != "PAN") return;
                paintState.action = "BRUSH";
            }
        });
    })();
}
