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
    pointerdown: false,
};
async function main() {
    initPosition();
    await initDraw();

    initiaize();
}

function initiaize() {
    paintState.updateBouncingRect();

    position.resizeScreen();

    setKey();

    setCursor();
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
    container.classList.remove("grab", "grabbing", "crosshair", "zoom");
    brushCursor.style.visibility = "hidden";
    if (paintState.action === "PAN") {
        if (paintState.pointerdown) {
            container.classList.add("grabbing");
        } else {
            container.classList.add("grab");
        }
    } else if (paintState.action === "BRUSH") {
        let brushSize = 10;
        let scaledBrushSize = brushSize * position.scale;
        container.classList.add("crosshair");

        brushCursor.style.visibility = "visible";
        brushCursor.style.left = `${pointerX - scaledBrushSize / 2}px`;
        brushCursor.style.top = `${pointerY - scaledBrushSize / 2}px`;
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

document.querySelector("#container").addEventListener(
    "pointerdown",
    (e) => {
        paintState.pointerdown = true;
        setCursor();
        // 이 안에서 도구가 변하면 안됌!! 여기서 변하면 투터치때 위험함
    },
    true,
);
document.querySelector("#container").addEventListener(
    "pointermove",
    (e) => {
        setCursor();
        // 이 안에서 도구가 변하면 안됌!! 여기서 변하면 투터치때 위험함
    },
    true,
);
window.addEventListener(
    "pointerup",
    (e) => {
        paintState.pointerdown = false;
        setCursor();
        // 이 안에서 도구가 변하면 안됌!! 여기서 변하면 드로우 잘 작동 안됌!
    },
    true,
);
let pointerX = 0,
    pointerY = 0; // 전역 변수로 저장

window.addEventListener(
    "pointermove",
    (event) => {
        // 이건 절대절대 모바일이 되는 작업에선 쓰면 안됌!!
        pointerX = event.clientX;
        pointerY = event.clientY;
        setCursor();
    },
    true,
);

// 마우스 이동 감지하여 좌표 저장

function setKey() {
    (function () {
        document.addEventListener("keydown", (event) => {
            //console.log(event);
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

window.addEventListener("contextmenu", (event) => event.preventDefault());
