import { addDrawEvent, initDraw } from "./draw";
import { addPositionEvent, position, setDefaultPosition } from "./position";
import { addInteractionEvent, getElements } from "./interface";
import { addSelectionEvent } from "./selection";
import { getLayerWorker } from "./worker/workerPool";
import { addClipboardListener } from "./file";
window.onload = main;

interface PaintState {
    action: string;
    brushSize: number;
    brushAlpha: number;
    color: { r: number; g: number; b: number };
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
        brushAlpha: 100,
        color: { r: 30, g: 30, b: 30 },
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
    addSelectionEvent();

    addClipboardListener();

    position.resizeScreen();

    globalThis.position = position;
    globalThis.paintState = paintState;

    console.log("Complete App!");
}
