import { addDrawEvent, tranferCanvas } from "./draw";
import {
    addPositionEvent,
    getPixelRatio,
    position,
    render,
    resizeScreen,
    setDefaultPosition,
    updateBouncingRect,
} from "./position";
import { els, getElements } from "./elements";
import { addInteractionEvent } from "./interaction";
import { addSelectionEvent, applySelection } from "./selection";
import { addClipboardEvent } from "./file";
import { makeAutoObservable } from "mobx";
import { bindView } from "./view";
import { getLayerWorker } from "./worker/workerPool";

window.onload = main;

type Action = "BRUSH" | "ZOOM" | "PINCH" | "PAN"; // 키보드 떼면 brush로 됌
type ToolId = "brush" | "select" | "selection"; // 선택창 풀면 brush로 됌
type BrushId = "brush" | "eraser" | "liquify";
class PaintState {
    action: Action = "BRUSH";
    toolId: ToolId = "brush";
    brushId: BrushId = "brush";
    private brushSize = { brush: 5, eraser: 10, liquify: 50 };
    private brushAlpha = { brush: 100, eraser: 100, liquify: 100 };
    color = { r: 30, g: 30, b: 30 };
    cursorX = 0;
    cursorY = 0;

    pointerdown = false;
    drawdownAndMoved = false;

    targetId = "brush";

    changed = false;
    showCircle = false;
    appbarHeight=0;
    constructor() {
        makeAutoObservable(this);
    }

    setAction(val: Action) {
        this.action = val;
    }
    setToolId(toolId: ToolId) {
        this.toolId = toolId;
    }
    setBrushId(brushId: BrushId) {
        this.brushId = brushId;
        this.targetId = brushId;
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

    setColor(r: number, g: number, b: number) {
        this.color = { r, g, b };
    }
    setShowCircle(value) {
        this.showCircle = value;
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

    // dpr이 1이 아니면, 캔버스 확대
    setCanvasCSSSize();

    // 캔버스 업로드
    await tranferCanvas();

    console.log("Complete App!");

    globalThis.position = position;
    globalThis.paintState = paintState;

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

    globalThis.changeLayer = function (layerId = 1) {
        let worker = getLayerWorker();
        // 레이어 바꾸기 전에 무조건 툴, 선택창 종료하기!
        applySelection();
        worker.setLayerId(layerId);
    };

    els.container.addEventListener('touchstart', function( event ) { 
        // text Loupe disable
              event.preventDefault();
        }, false);
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
        paintState.appbarHeight = appbar.offsetHeight;
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
