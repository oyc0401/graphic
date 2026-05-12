// tools/SelectTool.ts
import { InputMode, paintState, ToolId } from "../paintState";
import { selection } from "../selection";
import { position, to_pixel_canvas_coord } from "../position";
import { canvasSelect } from "../selection";
import { clamp } from "../utils/math";

export class SelectTool {
  private startPoint: { x: number; y: number };
  private endPoint: { x: number; y: number };
  private active = false;

  down(e: PointerEvent) {
    if (
      paintState.inputMode !== InputMode.Brush ||
      paintState.toolId !== ToolId.Select
    )
      return;

    const point = to_pixel_canvas_coord(e.clientX, e.clientY);
    const px = clamp(point.x, 0, position.width - 1);
    const py = clamp(point.y, 0, position.height - 1);

    this.startPoint = { x: px, y: py };
    this.endPoint = { x: px, y: py };
    this.active = true;
  }

  move(e: PointerEvent) {
    if (!this.active || !paintState.pointerdown) return;
    if (
      paintState.inputMode !== InputMode.Brush ||
      paintState.toolId !== ToolId.Select
    )
      return;

    const point = to_pixel_canvas_coord(e.clientX, e.clientY);
    const px = clamp(point.x, 0, position.width - 1);
    const py = clamp(point.y, 0, position.height - 1);
    this.endPoint = { x: px, y: py };
    //console.warn(this.startPoint.x, this.startPoint.y, " - ", px, py);

    const sp = this.startPoint;
    const ep = this.endPoint;

    const startX = Math.min(sp.x, ep.x);
    const startY = Math.min(sp.y, ep.y);
    const width = Math.abs(sp.x - ep.x) + 1;
    const height = Math.abs(sp.y - ep.y) + 1;

    selection.setX(startX);
    selection.setY(startY);
    selection.setWidth(width);
    selection.setHeight(height);
    selection.setShowHint(true);
    selection.setShowHandle(false);
  }

  up(e: PointerEvent) {
    if (!this.active) return;
    this.active = false;

    const point = to_pixel_canvas_coord(e.clientX, e.clientY);
    const px = clamp(point.x, 0, position.width - 1);
    const py = clamp(point.y, 0, position.height - 1);
    this.endPoint = { x: px, y: py };

    const sp = this.startPoint;
    const ep = this.endPoint;

    const startX = Math.min(sp.x, ep.x);
    const startY = Math.min(sp.y, ep.y);
    const width = Math.abs(sp.x - ep.x) + 1;
    const height = Math.abs(sp.y - ep.y) + 1;

    if (width === 0 || height === 0) {
      console.error("선택창이 0이 나올 수 없는데?");
      return;
    }
    if (width === 1 && height === 1) {
      console.log("1x1 선택창은 만들지 않습니다.");
      return;
    }

    selection.setShowHint(true);
    selection.setShowHandle(true);
    canvasSelect(startX, startY, width, height);
  }
}

export const selectTool = new SelectTool();
