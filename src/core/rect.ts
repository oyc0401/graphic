// inclusive Range Rectangle
export class Rect {
  // 내부 표현: 시작점(x, y) + 크기(w, h)
  // 포함 범위는 [x, x+w-1], [y, y+h-1] (inclusive end)
  private pathDirtyRect: { x: number; y: number; w: number; h: number } | null =
    null;

  constructor(x?: number, y?: number, w?: number, h?: number) {
    if (
      x !== undefined &&
      y !== undefined &&
      w !== undefined &&
      h !== undefined
    ) {
      this.pathDirtyRect = { x, y, w, h };
    }
  }

  reset(): void {
    this.pathDirtyRect = null;
  }

  /** 시작/끝 좌표(inclusive end)로 생성 */
  static fromPosition(sx: number, sy: number, ex: number, ey: number): Rect {
    // 방향에 상관없이 정상화
    const minX = Math.min(sx, ex);
    const minY = Math.min(sy, ey);
    const maxX = Math.max(sx, ex);
    const maxY = Math.max(sy, ey);
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    return new Rect(minX, minY, w, h);
  }

  static copy(rect: Rect): Rect {
    return new Rect(rect.x, rect.y, rect.width, rect.height);
  }

  /** 캔버스 경계([0..W-1], [0..H-1])로 클램프. inclusive end 유지 */
  static clampToCanvas(
    rect: Rect,
    canvasWidth: number,
    canvasHeight: number
  ): Rect {
    const bounds = new Rect(0, 0, canvasWidth, canvasHeight);
    return Rect.clampTo(rect, bounds);
  }

  /** 경계 Rect 내부로 클램프. inclusive end 유지 */
  static clampTo(rect: Rect, bounds: Rect): Rect {
    if (rect.isEmpty()) {
      throw new Error(
        "Invalid operation: Rect is empty and cannot be clamped."
      );
    }

    if (bounds.isEmpty()) {
      throw new Error("Invalid operation: Bounds Rect is empty.");
    }

    const startX = Math.max(bounds.x, rect.x);
    const startY = Math.max(bounds.y, rect.y);
    const endX = Math.min(bounds.ex, rect.ex); // inclusive end
    const endY = Math.min(bounds.ey, rect.ey); // inclusive end

    const width = endX - startX + 1;
    const height = endY - startY + 1;

    if (width <= 0 || height <= 0) {
      console.warn("Rect does not overlap with bounds, returning 0x0 rect");
      return new Rect(startX, startY, 0, 0); // 빈 rect로 반환
    }

    return new Rect(startX, startY, width, height);
  }

  /** Rect 인스턴스를 { startX, startY, endX, endY, width, height } 객체로 변환 */
  toData() {
    if (this.isEmpty()) {
      throw new Error(
        "Invalid operation: Cannot convert an empty Rect to an object."
      );
    }
    return {
      startX: this.x,
      startY: this.y,
      endX: this.ex,
      endY: this.ey,
      width: this.width,
      height: this.height,
    };
  }

  // === Getters ===
  get x() {
    if (!this.pathDirtyRect) {
      throw new Error(
        "Invalid access: Rect is empty, no x coordinate available."
      );
    }
    return this.pathDirtyRect.x;
  }

  get y() {
    if (!this.pathDirtyRect) {
      throw new Error(
        "Invalid access: Rect is empty, no y coordinate available."
      );
    }
    return this.pathDirtyRect.y;
  }

  get width() {
    if (!this.pathDirtyRect) {
      throw new Error("Invalid access: Rect is empty, no width available.");
    }
    return this.pathDirtyRect.w;
  }

  get height() {
    if (!this.pathDirtyRect) {
      throw new Error("Invalid access: Rect is empty, no height available.");
    }
    return this.pathDirtyRect.h;
  }

  // 계산된 inclusive end (읽기 전용 파생 값)
  get ex() {
    if (!this.pathDirtyRect) {
      throw new Error("Invalid access: Rect is empty, cannot calculate ex.");
    }
    return this.pathDirtyRect.x + this.pathDirtyRect.w - 1;
  }

  get ey() {
    if (!this.pathDirtyRect) {
      throw new Error("Invalid access: Rect is empty, cannot calculate ey.");
    }
    return this.pathDirtyRect.y + this.pathDirtyRect.h - 1;
  }

  isEmpty() {
    return this.pathDirtyRect === null;
  }

  /**
   * 포인터 (x,y)와 반경 radius를 포함하는 정사각형을 합집합(inclusive)으로 반영
   */
  updatePointer(x: number, y: number, radius: number) {
    const newX = Math.floor(x - radius);
    const newY = Math.floor(y - radius);
    const newEx = Math.floor(x + radius);
    const newEy = Math.floor(y + radius);

    const newW = newEx - newX + 1;
    const newH = newEy - newY + 1;

    if (this.pathDirtyRect === null) {
      this.pathDirtyRect = { x: newX, y: newY, w: newW, h: newH };
    } else {
      const r = this.pathDirtyRect;
      const unionX = Math.min(r.x, newX);
      const unionY = Math.min(r.y, newY);
      const unionEx = Math.max(r.x + r.w - 1, newEx);
      const unionEy = Math.max(r.y + r.h - 1, newEy);
      r.x = unionX;
      r.y = unionY;
      r.w = unionEx - unionX + 1;
      r.h = unionEy - unionY + 1;
    }
  }
}
