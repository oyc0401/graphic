import { initDraw } from "./draw";
import { initPosition, position } from "./position";
import { initInterface } from "./interface";
window.onload = main;

export let paintState = {
    action: "BRUSH",
    brushSize: 5,
    brushAlpha: 0.3,
    container: document.querySelector("#container"),
    layer_area: document.querySelector("#layer-area"),
    bouncingRectpointerdown: false,
    pointerX: 0,
    pointerY: 0,
    toolId:"brush",
};

async function main() {
    initInterface();
    
    initPosition();

    await initDraw();

    position.resizeScreen();
}
