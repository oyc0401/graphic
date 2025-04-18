import { paintState } from "../main";
import { getLayerWorker } from "../worker/workerPool";
import { to_canvas_coord } from "../position";

export class BrushTool {
  private active = false;
  private start = { x: 0, y: 0 };

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

    this.start = point;
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

    const dx = point.x - this.start.x;
    const dy = point.y - this.start.y;
    if (Math.hypot(dx, dy) > brushSize / 25) {
      this.start = point;
      worker.strokeTo(point);
    }

    paintState.setDrawing(true);
    paintState.setCursorPosition(e.clientX, e.clientY);
  }

  up(e: PointerEvent) {
    if (!this.active || paintState.toolId !== "brush") return;
    this.active = false;

    const point = to_canvas_coord(e.clientX, e.clientY);
    const worker = getLayerWorker();
    if (this.start.x == point.x && this.start.y == point.y) {
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
