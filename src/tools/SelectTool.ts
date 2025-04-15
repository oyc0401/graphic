// tools/SelectTool.ts
import { paintState } from "../main";
import { selection } from "../selection";
import { position, to_pixel_canvas_coord } from "../position";
import { canvasSelect } from "../selection";
import { clamp } from "../utils";

export class SelectTool {
  private startPoint: { x: number; y: number } | null = null;
  private endPoint: { x: number; y: number } | null = null;
  private active = false;

  down(e: PointerEvent) {
    if (paintState.action !== "BRUSH" || paintState.toolId !== "select") return;

    const point = to_pixel_canvas_coord(e.clientX, e.clientY);
    const px = clamp(point.x, 0, position.width);
    const py = clamp(point.y, 0, position.height);

    this.startPoint = { x: px, y: py };
    this.endPoint = { x: px, y: py };
    this.active = true;
  }

  move(e: PointerEvent) {
    if (!this.active || !paintState.pointerdown) return;
    if (paintState.action !== "BRUSH" || paintState.toolId !== "select") return;
    
    const point = to_pixel_canvas_coord(e.clientX, e.clientY);
    const px = clamp(point.x, 0, position.width);
    const py = clamp(point.y, 0, position.height);
    this.endPoint = { x: px, y: py };

    const sp = {
      x: this.startPoint!.x + (this.startPoint!.x > this.endPoint.x ? 1 : 0),
      y: this.startPoint!.y + (this.startPoint!.y > this.endPoint.y ? 1 : 0),
    };
    const ep = {
      x: this.endPoint.x + (this.startPoint!.x <= this.endPoint.x ? 1 : 0),
      y: this.endPoint.y + (this.startPoint!.y <= this.endPoint.y ? 1 : 0),
    };

    const startX = Math.min(sp.x, ep.x);
    const startY = Math.min(sp.y, ep.y);
    const width = Math.abs(sp.x - ep.x);
    const height = Math.abs(sp.y - ep.y);

    selection.setX(startX);
    selection.setY(startY);
    selection.setWidth(width);
    selection.setHeight(height);
    selection.setShowHint(true);
  }

  up(e: PointerEvent) {
    if (!this.active) return;
    this.active = false;

    const sp = {
      x: this.startPoint!.x + (this.startPoint!.x > this.endPoint!.x ? 1 : 0),
      y: this.startPoint!.y + (this.startPoint!.y > this.endPoint!.y ? 1 : 0),
    };
    const ep = {
      x: this.endPoint!.x + (this.startPoint!.x <= this.endPoint!.x ? 1 : 0),
      y: this.endPoint!.y + (this.startPoint!.y <= this.endPoint!.y ? 1 : 0),
    };

    const startX = Math.min(sp.x, ep.x);
    const startY = Math.min(sp.y, ep.y);
    const width = Math.abs(sp.x - ep.x);
    const height = Math.abs(sp.y - ep.y);

    if (width === 0 || height === 0) {
      console.error("선택창이 0이 나올 수 없는데?");
      return;
    }
    if (width === 1 && height === 1) {
      console.log("1x1 선택창은 만들지 않습니다.");
      return;
    }

    selection.setShowHint(false);
    canvasSelect(startX, startY, width, height);
  }
}

export const selectTool = new SelectTool();
