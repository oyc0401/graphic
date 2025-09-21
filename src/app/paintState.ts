import { makeAutoObservable, runInAction } from "mobx";
import { getLayerWorker } from "./worker/workerPool";

type Action = "BRUSH" | "ZOOM" | "PINCH" | "PAN"; // 키보드 떼면 brush로 됌
type ToolId = "brush" | "select" | "selection" | "resize"; // 선택창 풀면 brush로 됌
type BrushId = "brush" | "eraser" | "liquify";
class PaintState {
  action: Action = "BRUSH";
  toolId: ToolId = "brush";
  brushId: BrushId = "brush";
  brushSize = { brush: 5, eraser: 10, liquify: 50 };
  brushAlpha = { brush: 100, eraser: 100, liquify: 100 };

  cursorX = 0;
  cursorY = 0;

  pointerdown = false;
  drawing = false;
  canTouch = true;

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
  setCanTouch(val: boolean) {
    if (val) {
      setTimeout(() => {
        runInAction(() => {
          this.canTouch = val;
        });
      });
    } else {
      this.canTouch = val;
    }
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
  moved = true;

  setMoved(value) {
    this.moved = value;
  }
}

export const paintState = new PaintState();
