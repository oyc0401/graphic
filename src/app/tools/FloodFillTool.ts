import { paintState, ToolId } from "../paintState";
import { to_canvas_coord } from "../position";
import { getLayerWorker } from "../worker/workerPool";
import { colorState } from "../colorState";
import { syncCoreState } from "../history";
import type { Tool, ToolConfig } from "./Tool";

function clampTolerance(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export class FloodFillTool implements Tool {
  config: ToolConfig = {
    allowCanvasResizeHandle: true,
  };

  enter() {}

  exit() {}

  canUse() {
    return (
      paintState.getToolId() === ToolId.FloodFill &&
      paintState.getSessionId() === null
    );
  }

  down(e: PointerEvent) {
    if (!paintState.getPointerdown() || !this.canUse()) return;

    const point = to_canvas_coord(e.clientX, e.clientY);
    const worker = getLayerWorker();
    const { r, g, b } = colorState.getRGB();

    worker.setStrokeColor(r, g, b);
    worker.setAlpha(paintState.getBrushAlpha());
    const changed = worker.floodFill(
      point,
      clampTolerance(paintState.getBrushSize()) / 100,
    );
    if (changed) {
      syncCoreState();
    }
  }

  move() {}

  up() {}

  cancel() {}
}
