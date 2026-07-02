// tools/ZoomTool.ts
import { InputMode, paintState, ToolId } from "../paintState";
import {
  position,
  renderChangedPosition,
  to_screen_coord,
  setMagification,
  getPixelRatio,
} from "../position";
import { zoomRect } from "../ui/zoomState";
import { cssDeltaToScene } from "../utils/cameraMath";
import type { Tool, ToolConfig } from "./Tool";

const MIN_SCALE = 0.125;
const MAX_SCALE = 120;

export class ZoomTool implements Tool {
  config: ToolConfig = {
    allowCanvasResizeHandle: false,
    cursorClass: "zoom",
  };

  private active = false;

  enter() {}

  exit() {}

  canUse() {
    return (
      paintState.getInputMode() === InputMode.Zoom ||
      (paintState.getInputMode() === InputMode.DEFAULT &&
        paintState.getToolId() === ToolId.Zoom)
    );
  }

  down(e: PointerEvent) {
    if (!this.canUse() || !paintState.getPointerdown() || this.active) return;

    this.active = true;
    zoomRect.setStart(e.clientX, e.clientY);
  }

  move(e: PointerEvent) {
    if (!this.canUse() || !paintState.getPointerdown() || !this.active) return;

    zoomRect.updateEnd(e.clientX, e.clientY);
  }

  up(e: PointerEvent) {
    if (!this.canUse() || !this.active) return;

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
      // 드래그(고무줄) 분기는 max_scale로 클램프하는데 클릭 분기만 여기에 dpr을
      // 한 번 더 곱해(=MAX_SCALE*dpr²) 레티나에서 탭 줌이 드래그보다 dpr배 더
      // 확대됐다. 두 분기의 최대 배율을 max_scale로 일치시킨다.
      const clamped = Math.min(
        max_scale,
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

      position.setX(position.x - cssDeltaToScene(dx, position.scale, dpr));
      position.setY(position.y - cssDeltaToScene(dy, position.scale, dpr));

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
