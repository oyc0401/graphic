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

    this.start = { x: e.clientX, y: e.clientY };
  }

  move(e: PointerEvent) {
    if (
      !paintState.pointerdown ||
      !this.active ||
      paintState.toolId !== "brush"
    )
      return;
    const point = to_canvas_coord(e.clientX, e.clientY);
    const worker = getLayerWorker();
    const brushSize = paintState.getBrushSize();

    if (paintState.brushId === "liquify") {
      const dx = e.clientX - this.start.x;
      const dy = e.clientY - this.start.y;
      if (Math.hypot(dx, dy) > brushSize / 25) {
        this.start = { x: e.clientX, y: e.clientY };
        worker.strokeTo(point);
      }
    } else {
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
    if (this.start.x == e.clientX && this.start.x == e.clientY) {
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
