import { clamp } from "../../../utils/math";
import { paintOptions } from "../texture";

export class DirtyRect {
  pathDirtyRect = { x: 0, y: 0, ex: 0, ey: 0 };

  constructor(x = 0, y = 0, ex = 0, ey = 0) {
    this.pathDirtyRect = { x, y, ex, ey };
  }
  static fromWidth(x, y, width, height) {
    return new DirtyRect(x, y, width + x - 1, height + y - 1);
  }
  static copy(rect) {
    return DirtyRect.fromWidth(rect.x, rect.y, rect.width, rect.height);
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

  updatePointer(pointer, radius) {
    let minX = Math.min(this.pathDirtyRect.x, Math.floor(pointer.x - radius));
    let maxX = Math.max(this.pathDirtyRect.ex, Math.floor(pointer.x + radius));
    let minY = Math.min(this.pathDirtyRect.y, Math.floor(pointer.y - radius));
    let maxY = Math.max(this.pathDirtyRect.ey, Math.floor(pointer.y + radius));

    this.pathDirtyRect.x = minX;
    this.pathDirtyRect.y = minY;
    this.pathDirtyRect.ex = maxX;
    this.pathDirtyRect.ey = maxY;
  }

  reset(pointer: Pointer, radius) {
    this.pathDirtyRect = { x: 0, y: 0, ex: 0, ey: 0 };

    this.pathDirtyRect.x = Math.floor(pointer.x - radius);
    this.pathDirtyRect.y = Math.floor(pointer.y - radius);
    this.pathDirtyRect.ex = Math.floor(pointer.x + radius);
    this.pathDirtyRect.ey = Math.floor(pointer.y + radius);
  }
}

export class Rect {
  pathDirtyRect = { x: 0, y: 0, ex: 0, ey: 0 };

  constructor(x = 0, y = 0, ex = 0, ey = 0) {
    this.pathDirtyRect = { x, y, ex, ey };
  }
  static fromWidth(x, y, width, height) {
    return new Rect(x, y, width + x - 1, height + y - 1);
  }
  static copy(rect) {
    return Rect.fromWidth(rect.x, rect.y, rect.width, rect.height);
  }

  get x() {
    return this.pathDirtyRect.x;
  }

  get y() {
    return this.pathDirtyRect.y;
  }

  get ex() {
    return this.pathDirtyRect.ex;
  }

  get ey() {
    return this.pathDirtyRect.ey;
  }

  get width() {
    return this.ex - this.x + 1;
  }

  get height() {
    return this.ey - this.y + 1;
  }

  updatePointer(pointer, radius) {
    let minX = Math.min(this.pathDirtyRect.x, Math.floor(pointer.x - radius));
    let maxX = Math.max(this.pathDirtyRect.ex, Math.floor(pointer.x + radius));
    let minY = Math.min(this.pathDirtyRect.y, Math.floor(pointer.y - radius));
    let maxY = Math.max(this.pathDirtyRect.ey, Math.floor(pointer.y + radius));

    this.pathDirtyRect.x = minX;
    this.pathDirtyRect.y = minY;
    this.pathDirtyRect.ex = maxX;
    this.pathDirtyRect.ey = maxY;
  }

  reset(pointer: Pointer, radius) {
    this.pathDirtyRect = { x: 0, y: 0, ex: 0, ey: 0 };

    this.pathDirtyRect.x = Math.floor(pointer.x - radius);
    this.pathDirtyRect.y = Math.floor(pointer.y - radius);
    this.pathDirtyRect.ex = Math.floor(pointer.x + radius);
    this.pathDirtyRect.ey = Math.floor(pointer.y + radius);
  }
}

interface Pointer {
  x: number;
  y: number;
}
