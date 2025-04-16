import { paintState } from "../main";
import { getLayerWorker } from "../worker/workerPool";
import { to_canvas_coord } from "../position";

export class BrushTool {
  private active = false;
  private start = { x: 0, y: 0 };
  private lastFrameTime = 0;
  private timer;
  private lastPoint;

  down(e: PointerEvent) {
    if (!paintState.pointerdown || paintState.toolId !== "brush") return;
    this.active = true;

    const point = to_canvas_coord(e.clientX, e.clientY);
    const worker = getLayerWorker();

    worker.setStrokeSize(paintState.getBrushSize());
    worker.setAlpha(paintState.getBrushAlpha());
    worker.setStrokeColor(
      paintState.color.r,
      paintState.color.g,
      paintState.color.b,
    );

    worker.start(point);

    this.start = { x: e.clientX, y: e.clientY };
    const now = performance.now();
    this.lastFrameTime = now;
  }

  move(e: PointerEvent) {
    if (
      !paintState.pointerdown ||
      !this.active ||
      paintState.toolId !== "brush"
    )
      return;

    const worker = getLayerWorker();
    const brushSize = paintState.getBrushSize();
    const point = to_canvas_coord(e.clientX, e.clientY);

    const now = performance.now();
    const area = brushSize * brushSize;

    const minInterval =
      paintState.brushId == "liquify" ? area / 80000 : area / (100000 * 4);

    this.lastPoint = point;
    clearTimeout(this.timer);
    
    if (now - this.lastFrameTime > minInterval) {
      this.lastFrameTime = now;
      worker.strokeTo(point);
      console.log("draw!");
    } else {
      this.timer = setTimeout(() => {
        if (
          !paintState.pointerdown ||
          !this.active ||
          paintState.toolId !== "brush"
        )
          return;
        this.lastFrameTime = now;
        worker.strokeTo(this.lastPoint);
        console.warn("inner draw");
      }, 150);

      console.log("skip", minInterval);
    }

    paintState.setDrawing(true);
    paintState.setCursorPosition(e.clientX, e.clientY);
  }

  up(e: PointerEvent) {
    if (!this.active || paintState.toolId !== "brush") return;
    this.active = false;

    const point = to_canvas_coord(e.clientX, e.clientY);
    const worker = getLayerWorker();
    if (this.start.x == e.clientX && this.start.y == e.clientY) {
      worker.strokeTo(point);
    }

    worker.end();
    paintState.changed = true;
  }

  cancel() {
    console.log("brushCancel");
    this.active = false;

    getLayerWorker().cancel();
  }
}
