import { initDraw, endDrawing } from "./draw";
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

function setCursor() {
    const container = document.querySelector("#container");
    if (!container) return;

    // 모든 상태 초기화
    container.classList.remove("grab", "grabbing", "crosshair");

    if (paintState.action === "PAN") {
        if (paintState.pointerdown) {
            container.classList.add("grabbing");
        } else {
            container.classList.add("grab");
        }
    } else if (paintState.action === "BRUSH") {
        container.classList.add("crosshair");
    }
    // ZOOM일 때는 모든 클래스를 제거한 상태 유지
}

// 누르고 있는 키에 따라서 도구를 바꿈
function changeKeyAction() {
    paintState.action = "BRUSH";
    // 이전에 뭔가 작동중이면 안바꿈
    if (paintState.pointerdown) {
        return;
    }
    if (pressedKeys.Space) {
        paintState.action = "PAN";
    }
    if (pressedKeys.KeyZ) {
        paintState.action = "ZOOM";
    }
}

document.querySelector("#container").addEventListener(
    "pointerdown",
    (_) => {
        console.log("pointerdown");
        paintState.pointerdown = true;
        setCursor();
    },
    true,
);
window.addEventListener(
    "pointermove",
    (e) => {
        // 이건 모바일에서 버그나니깐 모바일 되는거에선 쓰지 말기!
        paintState.clientX = e.clientX;
        paintState.clientY = e.clientY;
    },
    true,
);
window.addEventListener(
    "pointerup",
    (_) => {
        console.log("pointerup");
        paintState.pointerdown = false;
        changeKeyAction();
        setCursor();
    },
    true,
);

function setKey() {
    (function () {
        document.addEventListener("keydown", (event) => {
            //console.log(event);
            if (event.repeat) return; // OS 기본 딜레이 방지

            if (event.code == "KeyZ") {
                event.preventDefault();
                pressedKeys["KeyZ"] = true;
                // 이때 마우스가 클릭되어있는 상태면 바로 팬이 작동되게 하고, 확대 축소는 또 한번 클릭해야지 되는걸로 하자.

                changeKeyAction();
                setCursor();
            }
            if (event.code === "Space") {
                event.preventDefault();
                pressedKeys["Space"] = true;

                changeKeyAction();
                setCursor();
            }
        });

        document.addEventListener("keyup", (event) => {
            if (event.code == "KeyZ") {
                event.preventDefault();
                pressedKeys["KeyZ"] = false;

                changeKeyAction();
                setCursor();
            }
            if (event.code === "Space") {
                event.preventDefault();
                pressedKeys["Space"] = false;

                changeKeyAction();
                setCursor();
            }
        });
    })();
}
