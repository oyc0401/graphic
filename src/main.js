import { initDraw, initUI, cancel, endDrawing } from "./draw";
import { initPosition, position } from "./position";
window.onload = main;

//////////////////////////
export let paintState = {
    action: "BRUSH",
    brushSize: 5,
    brushAlpha: 0.3,
    container: document.querySelector("#container"),
    layer_area: document.querySelector("#layer-area"),
    bouncingRect: null,
    updateBouncingRect() {
        this.bouncingRect = this.container.getBoundingClientRect();
    },
    pointerdown: false,
    pointerX: 0,
    pointerY: 0,
};
async function main() {
    initUI();

    initPosition();

  paintState.updateBouncingRect();
  
    await initDraw();

    initiaize();
}

function initiaize() {
    position.resizeScreen();

    setKey();

    setCursor();

    document.querySelector("#container").addEventListener(
        "pointerdown",
        (_) => {
            paintState.pointerdown = true;
            setCursor();
            // 이 안에서 도구가 변하면 안됌!! 여기서 변하면 투터치때 위험함
        },
        true,
    );

    window.addEventListener(
        "pointerup",
        (_) => {
            paintState.pointerdown = false;
            setCursor();
            // 이 안에서 도구가 변하면 안됌!! 여기서 변하면 드로우 잘 작동 안됌!
        },
        true,
    );

    window.addEventListener(
        "pointermove",
        (event) => {
            if (event.pointerType == "mouse") {
                // 이건 절대절대 모바일이 되는 작업에선 쓰면 안됌!!
                paintState.pointerX = event.clientX;
                paintState.pointerY = event.clientY;
                setCursor();
            }
        },
        true,
    );

    window.addEventListener("contextmenu", (event) => event.preventDefault());
}

/**
 * 단축키
 */
export let pressedKeys = {
    Space: false,
    KeyZ: false,
};

export function setCursor() {
    const container = document.querySelector("#container");
    if (!container) return;
    let brushCursor = document.querySelector("#brush-cursor");

    // 모든 상태 초기화
    container.classList.remove("grab", "grabbing", "brush", "zoom");
    brushCursor.style.visibility = "hidden";
    if (paintState.action === "PAN") {
        if (paintState.pointerdown) {
            container.classList.add("grabbing");
        } else {
            container.classList.add("grab");
        }
    } else if (paintState.action === "BRUSH") {
        let scaledBrushSize = paintState.brushSize * position.scale;
        container.classList.add("brush");
        if (!("ontouchstart" in window)) {
            brushCursor.style.visibility = "visible";
        }
        brushCursor.style.left = `${paintState.pointerX - scaledBrushSize / 2}px`;
        brushCursor.style.top = `${paintState.pointerY - scaledBrushSize / 2}px`;
        brushCursor.style.width = `${scaledBrushSize}px`;
        brushCursor.style.height = `${scaledBrushSize}px`;
    } else if (paintState.action === "ZOOM") {
        container.classList.add("zoom");
    }
}

// 누르고 있는 키에 따라서 도구를 바꿈
export function applyKeyAction() {
    if (paintState.pointerdown) {
        return;
    }
    paintState.action = "BRUSH";
    // 이전에 뭔가 작동중이면 안바꿈
    if (pressedKeys.Space) {
        paintState.action = "PAN";
    }
    if (pressedKeys.KeyZ) {
        console.log("zoom 누르는중");
        paintState.action = "ZOOM";
    }
}

function setKey() {
    (function () {
        document.addEventListener("keydown", (event) => {
            if (event.repeat) return; // OS 기본 딜레이 방지

            if (event.code == "KeyZ") {
                event.preventDefault();
                pressedKeys["KeyZ"] = true;
                // 이때 마우스가 클릭되어있는 상태면 바로 팬이 작동되게 하고, 확대 축소는 또 한번 클릭해야지 되는걸로 하자.

                applyKeyAction();
                setCursor();
            }
            if (event.code === "Space") {
                event.preventDefault();
                pressedKeys["Space"] = true;

                applyKeyAction();
                setCursor();
            }

            if (event.code === "Escape") {
                console.log("취소!");
                cancel();
                endDrawing();
            }
        });

        document.addEventListener("keyup", (event) => {
            if (event.code == "KeyZ") {
                event.preventDefault();
                pressedKeys["KeyZ"] = false;

                applyKeyAction();
                setCursor();
            }
            if (event.code === "Space") {
                event.preventDefault();
                pressedKeys["Space"] = false;

                applyKeyAction();
                setCursor();
            }
        });
    })();
}
