// tools/PanTool.ts
import { InputMode, paintState } from "../paintState";
import { getPixelRatio, position, renderChangedPosition } from "../position";
import type { Tool, ToolConfig } from "./Tool";

export class PanTool implements Tool {
  config: ToolConfig = {
    allowCanvasResizeHandle: false,
  };

  private lastClientX = 0;
  private lastClientY = 0;
  private active = false;

  enter() {}

  exit() {
    this.active = false;
  }

  canUse() {
    return paintState.getInputMode() === InputMode.Pan;
  }

  down(e: PointerEvent) {
    if (!this.canUse() || !paintState.getPointerdown()) return;
    this.active = true;

    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;
  }

  move(e: PointerEvent) {
    if (!this.canUse() || !paintState.getPointerdown() || !this.active) return;

    const dx = (this.lastClientX - e.clientX) * getPixelRatio();
    const dy = (this.lastClientY - e.clientY) * getPixelRatio();

    const newX = position.x - dx / position.scale;
    const newY = position.y - dy / position.scale;

    position.setX(newX);
    position.setY(newY);

    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;

    renderChangedPosition();
  }

  up(_: PointerEvent) {
    if (!this.canUse()) return;
    this.active = false;
  }

  cancel() {
    this.active = false;
  }
}

export const panTool = new PanTool();
