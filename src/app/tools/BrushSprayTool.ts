import { colorState } from "../colorState";
import { paintState } from "../paintState";
import { to_canvas_coord } from "../position";
import { getLayerWorker } from "../worker/workerPool";
import type { Tool, ToolConfig } from "./Tool";

const BRUSH_SPRAY_INTERVAL_MS = 16;

export class BrushSprayTool implements Tool {
  config: ToolConfig = {
    allowCanvasResizeHandle: false,
  };

  private active = false;
  private timerId: number | null = null;
  private point = { x: 0, y: 0 };

  constructor(private readonly canUseTool: () => boolean) {}

  enter() {}

  exit() {
    this.stopTimer();
  }

  canUse() {
    return this.canUseTool();
  }

  down(e: PointerEvent) {
    if (!paintState.getPointerdown() || !this.canUse()) return;

    this.active = true;
    this.point = to_canvas_coord(e.clientX, e.clientY);

    const worker = getLayerWorker();
    worker.setStrokeSize(paintState.getBrushSize());
    worker.setAlpha(paintState.getBrushAlpha());
    const { r, g, b } = colorState.getRGB();
    worker.setStrokeColor(r, g, b);
    worker.start(this.point);

    this.strokeToCurrentPoint();
    this.startTimer();

    paintState.setMoved(false);
    paintState.setShowBrushCursor(true);
    paintState.setCursorPosition(e.clientX, e.clientY);
  }

  move(e: PointerEvent) {
    if (!paintState.getPointerdown() || !this.active || !this.canUse()) return;

    this.point = to_canvas_coord(e.clientX, e.clientY);
    this.strokeToCurrentPoint();

    paintState.setMoved(true);
    paintState.setShowBrushCursor(true);
    paintState.setCursorPosition(e.clientX, e.clientY);
  }

  up(e: PointerEvent) {
    if (!this.active || !this.canUse()) return;

    this.active = false;
    this.stopTimer();
    this.point = to_canvas_coord(e.clientX, e.clientY);
    this.strokeToCurrentPoint();
    getLayerWorker().end();

    paintState.setMoved(false);
    paintState.setShowBrushCursor(false);
  }

  cancel() {
    this.active = false;
    this.stopTimer();
    paintState.setShowBrushCursor(false);
    getLayerWorker().cancel();
  }

  private strokeToCurrentPoint() {
    getLayerWorker().strokeTo(this.point);
  }

  private startTimer() {
    if (this.timerId !== null) return;

    this.timerId = window.setInterval(() => {
      if (!paintState.getPointerdown() || !this.active || !this.canUse()) {
        this.stopTimer();
        return;
      }

      this.strokeToCurrentPoint();
    }, BRUSH_SPRAY_INTERVAL_MS);
  }

  private stopTimer() {
    if (this.timerId === null) return;

    window.clearInterval(this.timerId);
    this.timerId = null;
  }
}
