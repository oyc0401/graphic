import { addDrawEvent, tranferCanvas } from "./draw";
import { addPositionEvent, position, setDefaultPosition } from "./position";
import { getElements } from "./elements";
import { addInteractionEvent } from "./interaction";
import { addSelectionEvent } from "./selection";
import { addClipboardListener } from "./file";
import { makeAutoObservable } from "mobx";
import { bindView } from "./view";
window.onload = main;

class PaintState {
    action = "BRUSH";
    brushSize = 5;
    brushAlpha = 100;
    color = { r: 30, g: 30, b: 30 };
    cursorX = 0;
    cursorY = 0;
    toolId = "brush";
    pointerdown = false;

    brushCursorScale = 1;
    constructor() {
        makeAutoObservable(this);
    }

    setAction(val: string) {
        this.action = val;
    }
    setPointerdown(val: boolean) {
        this.pointerdown = val;
    }
    setCursorPosition(x, y) {
        this.cursorX = x;
        this.cursorY = y;
    }
    setBrushSize(size: number) {
        this.brushSize = size;
    }
    setBrushAlpha(alpha: number) {
        this.brushAlpha = alpha;
    }
    setToolId(toolId: string) {
        this.toolId = toolId;
    }
    setColor(r: number, g: number, b: number) {
        this.color = { r, g, b };
    }
    setBrushCursorScale(scale) {
        this.brushCursorScale = scale;
    }
}

export const paintState = new PaintState();

async function main() {
    console.log("Start App!");

    getElements();

    // 초기 캔버스 위치 계산
    setDefaultPosition();

    await tranferCanvas();

    // 뷰 바인딩
    bindView();

    // 이벤트 추가
    addInteractionEvent();
    addClipboardListener();
    addPositionEvent();
    addDrawEvent();
    addSelectionEvent();

    // 캔버스 렌더링
    position.resizeScreen();

    console.log("Complete App!");

    globalThis.position = position;
    globalThis.paintState = paintState;
}
