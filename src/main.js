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
