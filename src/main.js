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
async function main() {
    initPosition();
    await initDraw();

    initiaize();
}

function initiaize() {
    paintState.updateBouncingRect();

    position.resizeScreen();

    setKey();
}

/**
 * 단축키
 */
export let pressedKeys = {
    Space: false,
    KeyZ: false,
};

export function setKeyEvents() {
    paintState.action = "BRUSH";
    if (pressedKeys.Space) {
        paintState.action = "PAN";
    }
    if (pressedKeys.KeyZ) {
        paintState.action = "ZOOM";
    }
}

function setKey() {
    (function () {
        document.addEventListener("keydown", (event) => {
            //console.log(event);
            if (event.repeat) return; // OS 기본 딜레이 방지

            if (event.code == "KeyZ") {
                event.preventDefault();
                pressedKeys["KeyZ"] = true;

                setKeyEvents();
            }
            if (event.code === "Space") {
                event.preventDefault();
                pressedKeys["Space"] = true;

                setKeyEvents();
            }
        });

        document.addEventListener("keyup", (event) => {
            if (event.code == "KeyZ") {
                event.preventDefault();
                pressedKeys["KeyZ"] = false;

                setKeyEvents();
            }
            if (event.code === "Space") {
                event.preventDefault();
                pressedKeys["Space"] = false;

                setKeyEvents();
            }
        });
    })();
}
