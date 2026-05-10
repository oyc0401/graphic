import { colorState } from "../colorState";
import { toolManager } from "../draw";
import { paintState } from "../paintState";
import { position, to_pixel_canvas_coord } from "../position";
import { getLayerWorker } from "../worker/workerPool";

export class EyedropperTool {
  private active = false;

  private sampleFromEvent(e: PointerEvent) {
    const point = to_pixel_canvas_coord(e.clientX, e.clientY);
    if (
      point.x < 0 ||
      point.y < 0 ||
      point.x >= position.width ||
      point.y >= position.height
    ) {
      return false;
    }

    const { r, g, b } = getLayerWorker().sampleColor(point.x, point.y);
    colorState.setColorFromRGB(r, g, b);
    return true;
  }

  down(e: PointerEvent) {
    if (!paintState.pointerdown || paintState.toolId !== "eyedropper") return;
    this.active = true;

    if (!this.sampleFromEvent(e)) {
      this.active = false;
    }
  }

  move(e: PointerEvent) {
    paintState.setCursorPosition(e.clientX, e.clientY);
    if (!this.active || paintState.toolId !== "eyedropper") return;
    this.sampleFromEvent(e);
  }

  up() {
    if (!this.active || paintState.toolId !== "eyedropper") return;
    this.active = false;
    toolManager.setBrushTool();
  }

  cancel() {
    this.active = false;
  }
}
