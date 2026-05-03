// tools/ZoomTool.ts
import { paintState } from "../paintState";
import {
  position,
  renderChangedPosition,
  to_screen_coord,
  setMagification,
  getPixelRatio,
} from "../position";
import { zoomRect } from "../ui/zoomState";

const MIN_SCALE = 0.125;
const MAX_SCALE = 120;

export class ZoomTool {
  private active = false;

  down(e: PointerEvent) {
    if (paintState.inputMode !== "ZOOM" || !paintState.pointerdown || this.active)
      return;

    this.active = true;
    zoomRect.setStart(e.clientX, e.clientY);
  }

  move(e: PointerEvent) {
    if (paintState.inputMode !== "ZOOM" || !paintState.pointerdown || !this.active)
      return;

    zoomRect.updateEnd(e.clientX, e.clientY);
  }

  up(e: PointerEvent) {
    if (paintState.inputMode !== "ZOOM" || !this.active) return;

    this.active = false;

    const sx = zoomRect.sx;
    const sy = zoomRect.sy;
    const ex = zoomRect.ex;
    const ey = zoomRect.ey;

    zoomRect.reset();

    const zoomW = Math.abs(sx - ex);
    const zoomH = Math.abs(sy - ey);
    const cx = (sx + ex) / 2;
    const cy = (sy + ey) / 2;

    let dpr = getPixelRatio();
    let max_scale = MAX_SCALE * dpr;

    if (zoomW < 10 || zoomH < 10) {
      let newMag = position.scale;
      newMag *= e.button === 2 ? 1 / 1.5 : 1.5;
      const clamped = Math.min(
        max_scale * getPixelRatio(),
        Math.max(MIN_SCALE, newMag),
      );
      setMagification(clamped, to_screen_coord(e.clientX, e.clientY));
    } else {
      const px = position.bouncingRect.width / zoomW;
      const py = position.bouncingRect.height / zoomH;
      const zoomFactor = Math.min(px, py);

      const centerX = position.bouncingRect.width / 2;
      const centerY =
        position.bouncingRect.height / 2 + position.bouncingRect.y;

      const dx = cx - centerX;
      const dy = cy - centerY;

      position.setX((position.x / dpr - dx / position.scale) * dpr);
      position.setY((position.y / dpr - dy / position.scale) * dpr);

      const newMag = position.scale * zoomFactor;
      const clamped = Math.min(max_scale, Math.max(MIN_SCALE, newMag));
      setMagification(clamped, to_screen_coord(centerX, centerY));
    }

    renderChangedPosition();
  }

  cancel() {
    this.active = false;
    zoomRect.reset();
  }
}

export const zoomTool = new ZoomTool();
