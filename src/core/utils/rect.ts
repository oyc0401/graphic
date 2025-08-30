import type { Pointer } from "../types.js";

// inclusive Range Rectangle

export class RectNew {
  // 내부 표현: 시작점(x, y) + 크기(w, h)
  // 포함 범위는 [x, x+w-1], [y, y+h-1] (inclusive end)
  private rect: { x: number; y: number; w: number; h: number };

  constructor(x: number, y: number, w: number, h: number) {
    this.rect = { x, y, w, h };
  }

  static fromWidth(x, y, width, height) {
    return new RectNew(x, y, width, height);
  }

  /** 시작/끝 좌표(inclusive end)로 생성 */
  static fromPosition(sx: number, sy: number, ex: number, ey: number): RectNew {
    // 방향에 상관없이 정상화
    const minX = Math.min(sx, ex);
    const minY = Math.min(sy, ey);
    const maxX = Math.max(sx, ex);
    const maxY = Math.max(sy, ey);
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    return new RectNew(minX, minY, w, h);
  }

  static copy(rect: RectNew): RectNew {
    return new RectNew(rect.x, rect.y, rect.width, rect.height);
  }

  /** 경계 Rect 내부로 클램프해서 수정. inclusive end 유지 */
  clampTo(x: number, y: number, w: number, h: number): RectNew {
    if (this.isEmpty()) {
      throw new Error(
        "Invalid operation: Rect is empty and cannot be clamped."
      );
    }

    const bounds = new RectNew(x, y, w, h);
    if (bounds.isEmpty()) {
      throw new Error("Invalid operation: Bounds Rect is empty.");
    }

    const startX = Math.max(bounds.x, this.x);
    const startY = Math.max(bounds.y, this.y);
    const endX = Math.min(bounds.ex, this.ex); // inclusive end
    const endY = Math.min(bounds.ey, this.ey); // inclusive end

    const width = endX - startX + 1;
    const height = endY - startY + 1;

    if (width <= 0 || height <= 0) {
      // console.warn("Rect does not overlap with bounds, setting to 0x0 rect");
      this.rect.x = startX;
      this.rect.y = startY;
      this.rect.w = 0;
      this.rect.h = 0;
    } else {
      this.rect.x = startX;
      this.rect.y = startY;
      this.rect.w = width;
      this.rect.h = height;
    }

    return this;
  }

  /** Rect 인스턴스를 { startX, startY, endX, endY, width, height } 객체로 변환 */
  toData() {
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
    const rect = this.rect;
    return rect.x;
  }

  get y() {
    const rect = this.rect;
    return rect.y;
  }

  get width() {
    const rect = this.rect;
    return rect.w;
  }

  get height() {
    const rect = this.rect;
    return rect.h;
  }

  // 계산된 inclusive end (읽기 전용 파생 값)
  get ex() {
    const rect = this.rect;
    return rect.x + rect.w - 1;
  }

  get ey() {
    const rect = this.rect;
    return rect.y + rect.h - 1;
  }

  isEmpty() {
    return this.rect.w <= 0 || this.rect.h <= 0;
  }

  copy(): RectNew {
    const newRect = new RectNew(
      this.rect.x,
      this.rect.y,
      this.rect.w,
      this.rect.h
    );

    return newRect;
  }
}

export class DirtyRectRecorder {
  private pathDirtyRect: { x: number; y: number; w: number; h: number } | null =
    null;

  private clamped: boolean = false;
  private clampRect: { x: number; y: number; w: number; h: number } | null =
    null;

  static clampedRect(
    x: number,
    y: number,
    w: number,
    h: number
  ): DirtyRectRecorder {
    const recorder = new DirtyRectRecorder();
    recorder.setClampRect(x, y, w, h);
    return recorder;
  }

  /** 클램프 영역 설정 */
  setClampRect(x: number, y: number, w: number, h: number): void {
    this.clampRect = { x, y, w, h };
    this.setClampEnabled(true);
  }

  /** 클램프 사용 여부 설정 */
  setClampEnabled(enabled: boolean): void {
    this.clamped = enabled;
  }

  reset(pointer?: Pointer, radius?: number): void {
    if (pointer && radius !== undefined) {
      this.updatePointer(pointer, radius);
    } else {
      this.pathDirtyRect = null;
    }
  }

  /**
   * 포인터 (x,y)와 반경 radius를 포함하는 정사각형을 합집합(inclusive)으로 반영
   */
  updatePointer(pointer: Pointer, radius: number) {
    let { x, y } = pointer;
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

  /**
   * RectNew가 차지하는 영역을 더티에 합집합으로 추가
   */
  updateRect(rect: RectNew) {
    const newX = rect.x;
    const newY = rect.y;
    const newEx = rect.ex;
    const newEy = rect.ey;
    const newW = rect.width;
    const newH = rect.height;

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

  /** 클램프 적용된 rect 계산 */
  private getClampedRect(): {
    x: number;
    y: number;
    w: number;
    h: number;
  } {
    if (!this.pathDirtyRect) {
      throw Error("기록이 하나도 없습니다.");
    }

    if (!this.clamped || !this.clampRect) {
      return this.pathDirtyRect;
    }

    const rect = this.pathDirtyRect;
    const bounds = this.clampRect;

    const startX = Math.max(bounds.x, rect.x);
    const startY = Math.max(bounds.y, rect.y);
    const endX = Math.min(bounds.x + bounds.w - 1, rect.x + rect.w - 1);
    const endY = Math.min(bounds.y + bounds.h - 1, rect.y + rect.h - 1);

    const width = Math.max(0, endX - startX + 1);
    const height = Math.max(0, endY - startY + 1);

    return { x: startX, y: startY, w: width, h: height };
  }

  /** 더티 체크되지 되었는지 확인 */
  hasBeenDirty(): boolean {
    return this.pathDirtyRect !== null;
  }

  generateRect(): RectNew {
    if (!this.hasBeenDirty()) {
      throw Error("기록이 하나도 없습니다.");
    }

    const clampedRect = this.getClampedRect();
    const { x, y, w, h } = clampedRect;
    return new RectNew(x, y, w, h);
  }
}
