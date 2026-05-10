import { colorState } from "../colorState";
import { toolManager } from "../draw";
import { paintState } from "../paintState";
import { position, to_pixel_canvas_coord } from "../position";
import { getLayerWorker } from "../worker/workerPool";

export class ColorPickerTool {
  private active = false;
  private shouldReturnToBrush = false;

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
    if (!paintState.pointerdown || paintState.toolId !== "colorPicker") return;
    this.active = true;
    this.shouldReturnToBrush = true;

    if (!this.sampleFromEvent(e)) {
      this.active = false;
    }
  }

  move(e: PointerEvent) {
    paintState.setCursorPosition(e.clientX, e.clientY);
    if (!this.active || paintState.toolId !== "colorPicker") return;
    this.sampleFromEvent(e);
  }

  up() {
    if (!this.shouldReturnToBrush || paintState.toolId !== "colorPicker") return;
    this.active = false;
    this.shouldReturnToBrush = false;

    setTimeout(() => {
      if (paintState.toolId === "colorPicker") {
        toolManager.setBrushTool();
      }
    }, 0);
  }

  cancel() {
    this.active = false;
    this.shouldReturnToBrush = false;
  }
}
