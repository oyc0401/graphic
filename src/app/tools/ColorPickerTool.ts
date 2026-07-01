import { colorState } from "../colorState";
import { InputMode, paintState, TemporaryToolId, ToolId } from "../paintState";
import { position, to_pixel_canvas_coord } from "../position";
import { getLayerWorker } from "../worker/workerPool";
import type { Tool, ToolConfig } from "./Tool";

export class ColorPickerTool implements Tool {
  config: ToolConfig = {
    allowCanvasResizeHandle: false,
    cursorClass: "colorPicker",
  };

  private pointerStarted = false;

  enter() {}

  exit() {}

  canUse() {
    return (
      paintState.getTemporaryToolId() === TemporaryToolId.ColorPicker ||
      (paintState.getInputMode() === InputMode.DEFAULT &&
        paintState.getToolId() === ToolId.ColorPicker)
    );
  }

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
    if (!paintState.getPointerdown() || !this.canUse()) return;
    this.pointerStarted = true;

    this.sampleFromEvent(e);
  }

  move(e: PointerEvent) {
    paintState.setCursorPosition(e.clientX, e.clientY);
    if (!this.pointerStarted || !this.canUse()) return;
    this.sampleFromEvent(e);
  }

  up() {
    if (!this.pointerStarted) return;
    // 진행 중이던 상호작용은 canUse 여부와 무관하게 항상 종료 처리해야
    // pointerStarted가 true로 고착돼 이후 hover만으로 샘플링되는 걸 막는다.
    this.pointerStarted = false;
    if (!this.canUse()) return;
    paintState.setTemporaryToolId(null);
  }

  cancel() {
    this.pointerStarted = false;
  }
}
