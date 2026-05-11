import { colorState } from "../colorState";
import { paintState } from "../paintState";
import { position, to_pixel_canvas_coord } from "../position";
import { getLayerWorker } from "../worker/workerPool";

export class ColorPickerTool {
  private active = false;
  private pointerStarted = false;

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
    if (!paintState.pointerdown || paintState.inputMode !== "COLOR_PICKER")
      return;
    this.active = true;
    this.pointerStarted = true;

    if (!this.sampleFromEvent(e)) {
      this.active = false;
    }
  }

  move(e: PointerEvent) {
    paintState.setCursorPosition(e.clientX, e.clientY);
    if (!this.active || paintState.inputMode !== "COLOR_PICKER") return;
    this.sampleFromEvent(e);
  }

  up() {
    if (!this.pointerStarted || paintState.inputMode !== "COLOR_PICKER") return;
    this.active = false;
    this.pointerStarted = false;

    if (paintState.colorPickerModeSource === "button") {
      paintState.restoreSelectedToolMode();
    }
  }

  cancel() {
    this.active = false;
    this.pointerStarted = false;
  }
}
