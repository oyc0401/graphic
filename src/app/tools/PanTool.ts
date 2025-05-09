// tools/PanTool.ts
import { paintState } from "../paintState";
import { getPixelRatio, position, renderChangedPosition } from "../position";

export class PanTool {
  private lastClientX = 0;
  private lastClientY = 0;
  private active = false;

  down(e: PointerEvent) {
    if (paintState.action !== "PAN" || !paintState.pointerdown) return;
    this.active = true;

    this.lastClientX = e.clientX;
    this.lastClientY = e.clientY;
  }

  move(e: PointerEvent) {
    if (paintState.action !== "PAN" || !paintState.pointerdown || !this.active)
      return;

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
    // No-op for pan
    if (paintState.action !== "PAN") return;
    this.active = false;
  }

  cancel() {
    // 선택적으로 추가 가능
    this.active = false;
  }
}

export const panTool = new PanTool();
