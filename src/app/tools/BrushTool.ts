import { paintState } from "../paintState";
import { getLayerWorker } from "../worker/workerPool";
import { to_canvas_coord } from "../position";
import { colorState } from "../colorState";
import { historyState } from "../history";

export class BrushTool {
  private active = false;
  private start = { x: 0, y: 0 };

  down(e: PointerEvent) {
    if (!paintState.pointerdown || paintState.toolId !== "brush") return;
    this.active = true;
    // console.log("down:", e.clientX, e.clientY);
    const point = to_canvas_coord(e.clientX, e.clientY);
    const worker = getLayerWorker();

    worker.setStrokeSize(paintState.getBrushSize());
    worker.setAlpha(paintState.getBrushAlpha());
    let { r, g, b } = colorState.getRGB();
    worker.setStrokeColor(r, g, b);

    worker.start(point);

    this.start = point;

    paintState.setMoved(false);
  }

  move(e: PointerEvent) {
    // console.log("dddd22", paintState.pointerdown, paintState.toolId);
    if (
      !paintState.pointerdown ||
      !this.active ||
      paintState.toolId !== "brush"
    )
      return;

    paintState.setMoved(true);

    const worker = getLayerWorker();
    const brushSize = paintState.getBrushSize();
    const point = to_canvas_coord(e.clientX, e.clientY);

    //console.log("move:", e.clientX, e.clientY);
    const dx = point.x - this.start.x;
    const dy = point.y - this.start.y;
    //if (Math.hypot(dx, dy) > 4/ position.scale) {
    this.start = point;
    worker.strokeTo(point);
    //}

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

    //console.log("up:", e.clientX, e.clientY);
    worker.end();
    let { undoCount, redoCount } = worker.getHistoryCount();
    historyState.setUndoCount(undoCount);
    historyState.setRedoCount(redoCount);
    paintState.setMoved(false);
    paintState.changed = true;
  }

  cancel() {
    console.log("brushCancel");
    this.active = false;

    getLayerWorker().cancel();
  }
}
