import { clamp } from "../../../utils/math";
import { paintOptions } from "../texture";

export class DirtyRect {
  pathDirtyRect = { x: 0, y: 0, ex: 0, ey: 0, width: 0, height: 0 };

  constructor() {
    this.pathDirtyRect = { x: 0, y: 0, ex: 0, ey: 0, width: 0, height: 0 };
  }

  get x() {
    return clamp(this.pathDirtyRect.x, 0, paintOptions.width - 1);
  }

  get y() {
    return clamp(this.pathDirtyRect.y, 0, paintOptions.height - 1);
  }

  get ex() {
    return clamp(this.pathDirtyRect.ex, 0, paintOptions.width - 1);
  }

  get ey() {
    return clamp(this.pathDirtyRect.ey, 0, paintOptions.height - 1);
  }

  get width() {
    return this.ex - this.x + 1;
  }

  get height() {
    return this.ey - this.y + 1;
  }

  updatePathDirtyRect(pointer, radius) {
    let minX = Math.min(this.pathDirtyRect.x, Math.floor(pointer.x - radius));
    let maxX = Math.max(this.pathDirtyRect.ex, Math.floor(pointer.x + radius));
    let minY = Math.min(this.pathDirtyRect.y, Math.floor(pointer.y - radius));
    let maxY = Math.max(this.pathDirtyRect.ey, Math.floor(pointer.y + radius));

    this.pathDirtyRect.x = minX;
    this.pathDirtyRect.y = minY;
    this.pathDirtyRect.ex = maxX;
    this.pathDirtyRect.ey = maxY;
  }

  reset(pointer, radius) {
    this.pathDirtyRect = { x: 0, y: 0, ex: 0, ey: 0, width: 0, height: 0 };
    console.log("시작!");

    this.pathDirtyRect.x = Math.floor(pointer.x - radius);
    this.pathDirtyRect.y = Math.floor(pointer.y - radius);
    this.pathDirtyRect.ex = Math.floor(pointer.x + radius);
    this.pathDirtyRect.ey = Math.floor(pointer.y + radius);
    console.log(pointer, radius, this.pathDirtyRect);
  }
}
