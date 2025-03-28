import { addDrawEvent, initDraw } from "./draw";
import { addPositionEvent, position, setDefaultPosition } from "./position";
import { addInteractionEvent, getElements } from "./interface";
window.onload = main;

interface PaintState {
    action: string;
    brushSize: number;
    brushAlpha: number;
    cursorX: number;
    cursorY: number;
    toolId: string;
    pointerdown: boolean;
}

export let paintState: PaintState;

function getDefaultPaintState() {
    return {
        action: "BRUSH",
        brushSize: 5,
        brushAlpha: 1.0,
        cursorX: 0,
        cursorY: 0,
        toolId: "brush",
        pointerdown: false,
    };
}

async function main() {
    console.log("Start App!");
    getElements();

    paintState = getDefaultPaintState();

    setDefaultPosition();

    await initDraw();

    addInteractionEvent();

    addPositionEvent();

    addDrawEvent();

    position.resizeScreen();

    globalThis.position = position;

    console.log("Complete App!");
}
