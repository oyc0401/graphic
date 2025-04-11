import { addDrawEvent, tranferCanvas } from "./draw";
import {
    addPositionEvent,
    getPixelRatio,
    position,
    render,
    renderChangedPosition,
    resizeLayer,
    resizeScreen,
    setCameraPosition,
    setDefaultPosition,
    updateBouncingRect,
} from "./position";
import { els, getElements } from "./elements";
import { addInteractionEvent } from "./interaction";
import { addSelectionEvent } from "./selection";
import { addClipboardEvent } from "./file";
import { makeAutoObservable } from "mobx";
import { bindView } from "./view";

window.onload = main;

type Action = "BRUSH" | "ZOOM" | "PINCH" | "PAN";
type ToolId = "brush" | "eraser" | "liquify" | "select" | "selection";
class PaintState {
    action: Action = "BRUSH";
    private brushSize = { brush: 5, eraser: 10, liquify: 50 };
    private brushAlpha = { brush: 100, eraser: 100, liquify: 100 };
    color = { r: 30, g: 30, b: 30 };
    cursorX = 0;
    cursorY = 0;
    toolId: ToolId = "brush";
    pointerdown = false;
    drawdownAndMoved = false;

    targetId = "brush";

    constructor() {
        makeAutoObservable(this);
    }

    setAction(val: Action) {
        this.action = val;
    }
    setPointerdown(val: boolean) {
        this.pointerdown = val;
    }
    setDrawdownAndMoved(val: boolean) {
        this.drawdownAndMoved = val;
    }
    setCursorPosition(x, y) {
        this.cursorX = x;
        this.cursorY = y;
    }
    setBrushSize(size: number) {
        this.brushSize[this.targetId] = size;
    }
    setBrushAlpha(alpha: number) {
        this.brushAlpha[this.targetId] = alpha;
    }
    setToolId(toolId: ToolId) {
        this.toolId = toolId;
        if (toolId != "select" && toolId != "selection") {
            this.targetId = toolId;
        }
    }
    setColor(r: number, g: number, b: number) {
        this.color = { r, g, b };
    }

    getBrushSize() {
        return this.brushSize[this.targetId];
    }
    getBrushAlpha() {
        return this.brushAlpha[this.targetId];
    }
    getColor() {
        return this.color;
    }
}

export const paintState = new PaintState();

async function main() {
    console.log("Start App!");

    getElements();
    setContainerWidth();

    // 초기 캔버스 위치 계산
    setDefaultPosition();

    // 뷰 바인딩
    bindView();

    // 이벤트 추가
    addInteractionEvent();

    addClipboardEvent();

    addPositionEvent();

    addDrawEvent();

    addSelectionEvent();

    // 캔버스 업로드
    tranferCanvas();

    console.log("Complete App!");

    globalThis.position = position;
    globalThis.paintState = paintState;

    // 캔버스 렌더링
    setCameraPosition();
    resizeScreen();
    resizeLayer();
    render();

    setCanvasCSSSize();

    window.addEventListener("resize", async function () {
        debounce(async () => {
            console.log("debounce");
            updateBouncingRect();
            setContainerWidth();
            resizeScreen(); // worker에 있는 webgl에 드로우콜 날림
            render();
            setCanvasCSSSize();
        }, 100);
    });
}

function setCanvasCSSSize() {
    let dpr = getPixelRatio();
    if (dpr != 1) {
        els.canvas.style.width = `${position.bouncingRect.width}px`;
        els.canvas.style.height = `${position.bouncingRect.height}px`;
    }
}

function setContainerWidth() {
    const hiddenAppbar = document.getElementById("header-space");
    const appbar = document.getElementById("appbar");
    if (hiddenAppbar && appbar) {
        hiddenAppbar.style.height = appbar.offsetHeight + "px";
    }
}

let timer;
function debounce(func, delay) {
    clearTimeout(timer);
    timer = setTimeout(() => {
        func();
    }, delay);
}
