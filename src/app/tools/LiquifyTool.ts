import { LiquifyToolId, paintState, SessionId } from "../paintState";
import { to_canvas_coord } from "../position";
import { getLayerWorker } from "../worker/workerPool";
import { BrushTool } from "./BrushTool";
import type { Tool, ToolConfig } from "./Tool";

const LIQUIFY_SPRAY_INTERVAL_MS = 33;

class LiquifyPushTool extends BrushTool {
  config: ToolConfig = {
    allowCanvasResizeHandle: false,
  };
}

class LiquifySprayTool implements Tool {
  config: ToolConfig = {
    allowCanvasResizeHandle: false,
  };

  private active = false;
  private timerId: number | null = null;
  private point = { x: 0, y: 0 };

  enter() {}

  exit() {
    this.stopTimer();
  }

  canUse() {
    return paintState.getSessionMode();
  }

  down(e: PointerEvent) {
    if (!paintState.getPointerdown() || !this.canUse()) return;

    this.active = true;
    this.point = to_canvas_coord(e.clientX, e.clientY);
    this.apply();
    this.startTimer();

    paintState.setMoved(false);
    paintState.setShowBrushCursor(true);
    paintState.setCursorPosition(e.clientX, e.clientY);
  }

  move(e: PointerEvent) {
    if (!paintState.getPointerdown() || !this.active || !this.canUse()) return;

    this.point = to_canvas_coord(e.clientX, e.clientY);
    paintState.setMoved(true);
    paintState.setShowBrushCursor(true);
    paintState.setCursorPosition(e.clientX, e.clientY);
  }

  up(_e: PointerEvent) {
    if (!this.active || !this.canUse()) return;

    this.active = false;
    this.stopTimer();
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

  private apply() {
    const worker = getLayerWorker();
    worker.setStrokeSize(paintState.getBrushSize());
    worker.setAlpha(paintState.getBrushAlpha());
    worker.apply(this.point);
  }

  private startTimer() {
    if (this.timerId !== null) return;

    this.timerId = window.setInterval(() => {
      if (!paintState.getPointerdown() || !this.active || !this.canUse()) {
        this.stopTimer();
        return;
      }

      this.apply();
    }, LIQUIFY_SPRAY_INTERVAL_MS);
  }

  private stopTimer() {
    if (this.timerId === null) return;

    window.clearInterval(this.timerId);
    this.timerId = null;
  }
}

export class LiquifySessionTool implements Tool {
  config: ToolConfig = {
    allowCanvasResizeHandle: false,
  };

  private pushTool = new LiquifyPushTool();
  private sprayTool = new LiquifySprayTool();

  enter() {}

  exit() {
    this.pushTool.exit();
    this.sprayTool.exit();
  }

  canUse() {
    return paintState.getSessionMode();
  }

  down(e: PointerEvent) {
    this.getActiveTool().down(e);
  }

  move(e: PointerEvent) {
    this.getActiveTool().move(e);
  }

  up(e: PointerEvent) {
    this.getActiveTool().up(e);
  }

  cancel() {
    this.getActiveTool().cancel();
  }

  private getActiveTool() {
    if (paintState.getSessionId() === SessionId.Mosaic) {
      return this.pushTool;
    }
    return paintState.getLiquifyToolId() === LiquifyToolId.Push
      ? this.pushTool
      : this.sprayTool;
  }
}
