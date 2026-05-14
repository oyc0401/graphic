import { getActiveToolId } from "../coreToolAdapter";
import { colorState } from "../colorState";
import { InputMode, paintState, ToolId } from "../paintState";
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
    if (!paintState.getPointerdown() || getActiveToolId() !== ToolId.ColorPicker)
      return;
    this.pointerStarted = true;

    this.sampleFromEvent(e);
  }

  move(e: PointerEvent) {
    paintState.setCursorPosition(e.clientX, e.clientY);
    if (!this.pointerStarted || getActiveToolId() !== ToolId.ColorPicker) return;
    this.sampleFromEvent(e);
  }

  up() {
    if (!this.pointerStarted || getActiveToolId() !== ToolId.ColorPicker) return;
    this.pointerStarted = false;
    paintState.setInputMode(InputMode.DEFAULT);
  }

  cancel() {
    this.pointerStarted = false;
  }
}
