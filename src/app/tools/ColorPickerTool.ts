import { colorState } from "../colorState";
import { paintState } from "../paintState";
import { position, to_pixel_canvas_coord } from "../position";
import { getLayerWorker } from "../worker/workerPool";

export class ColorPickerTool {
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
    if (!paintState.pointerdown || paintState.activeToolId !== "colorPicker")
      return;
    this.pointerStarted = true;

    this.sampleFromEvent(e);
  }

  move(e: PointerEvent) {
    paintState.setCursorPosition(e.clientX, e.clientY);
    if (!this.pointerStarted || paintState.activeToolId !== "colorPicker")
      return;
    this.sampleFromEvent(e);
  }

  up() {
    if (!this.pointerStarted || paintState.activeToolId !== "colorPicker")
      return;
    this.pointerStarted = false;

    if (paintState.temporaryTool?.restoreOn === "pointerup") {
      paintState.restoreSelectedToolMode();
    }
  }

  cancel() {
    this.pointerStarted = false;
  }
}
