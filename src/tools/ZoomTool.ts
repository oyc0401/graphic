// tools/ZoomTool.ts
import { paintState } from "../main";
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
    if (paintState.action !== "ZOOM" || !paintState.pointerdown || this.active)
      return;

    this.active = true;
    zoomRect.setStart(e.clientX, e.clientY);
  }

  move(e: PointerEvent) {
    if (paintState.action !== "ZOOM" || !paintState.pointerdown || !this.active)
      return;

    zoomRect.updateEnd(e.clientX, e.clientY);
  }

  up(e: PointerEvent) {
    if (paintState.action !== "ZOOM" || !this.active) return;

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

    let max_scale = MAX_SCALE * getPixelRatio();

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
        position.bouncingRect.height / 2 +
        (window.innerHeight - position.bouncingRect.height);
      const dx = cx - centerX;
      const dy = cy - centerY;

      position.setX(position.x - dx / position.scale);
      position.setY(position.y - dy / position.scale);

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
