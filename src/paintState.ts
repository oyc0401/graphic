import { makeAutoObservable } from "mobx";
import { getLayerWorker } from "./core/worker/workerPool";

type Action = "BRUSH" | "ZOOM" | "PINCH" | "PAN"; // 키보드 떼면 brush로 됌
type ToolId = "brush" | "select" | "selection" | "resize"; // 선택창 풀면 brush로 됌
type BrushId = "brush" | "eraser" | "liquify";
class PaintState {
    action: Action = "BRUSH";
    toolId: ToolId = "brush";
    brushId: BrushId = "brush";
     brushSize = { brush: 5, eraser: 10, liquify: 50 };
     brushAlpha = { brush: 70, eraser: 100, liquify: 100 };
    color = { r: 30, g: 30, b: 30 };
    cursorX = 0;
    cursorY = 0;

    pointerdown = false;
    drawing = false;

    targetId = "brush";

    changed = false;
    showCircle = false;
    showSizeHandle = false;
    
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
    setDrawing(val: boolean) {
        this.drawing = val;
    }
    setCursorPosition(x, y) {
        this.cursorX = x;
        this.cursorY = y;
    }
    setBrushSize(size: number) {
        this.brushSize[this.targetId] = size;
        const worker = getLayerWorker();
        worker.setStrokeSize(size);
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

    setShowSizeHandle(val) {
        this.showSizeHandle = val;
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