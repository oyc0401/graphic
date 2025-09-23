// tools/SelectionTool.ts
import { paintState } from "../paintState";
import { selection, beforeSelectionPos, applySelection } from "../selection";
import { getSelectionHandleAtPoint, HandleType } from "../utils/selectionHitTest";
import { to_pixel_canvas_coord } from "../position";
import { getLayerWorker } from "../worker/workerPool";
import { clamp } from "../utils/math";
import { paintConfig } from "@/paint.config";
import { Pointer } from "@/core/types";

export class SelectionTool {
  private activeHandle: HandleType | null = null;
  private dragOffset = { x: 0, y: 0 };
  private start = { x: 0, y: 0, w: 0, h: 0, flipH: false, flipV: false };

  private startTime;

  // // 이건 exclusive 좌표계를 사용.
  private startPoint: Pointer; // 좌상단
  private endPoint: Pointer; // 우하단

  down(e: PointerEvent) {
    if (paintState.toolId !== "selection" || paintState.action !== "BRUSH") return;
    if (!paintState.pointerdown) return;

    // console.log("point!!:", this.startPoint, this.endPoint);

    const rect = {
      x: selection.x,
      y: selection.y,
      width: selection.width,
      height: selection.height,
    };

    const handle = getSelectionHandleAtPoint(e.clientX, e.clientY, rect);
    this.activeHandle = handle;
    this.start = {
      x: selection.x,
      y: selection.y,
      w: selection.width,
      h: selection.height,
      flipH: selection.flipH,
      flipV: selection.flipV,
    };

    console.log("handle:", handle);
    if (handle === "INSIDE") {
      const point = to_pixel_canvas_coord(e.clientX, e.clientY);
      this.dragOffset = {
        x: point.x - selection.x,
        y: point.y - selection.y,
      };
      selection.active = true;
    } else if (handle === "OUTSIDE") {
      this.startTime = performance.now();
    } else {
      selection.active = true;
    }
  }

  move(e: PointerEvent) {
    // el.container의 커서를 grab으로, paintState.pointerdown이면 grabbing으로
    // 그리고 핸들 범위에 올라가면, nesw-resize이런 4개방향 화살표로.

    const rect = {
      x: selection.x,
      y: selection.y,
      width: selection.width,
      height: selection.height,
    };

    const hoveredHandle = getSelectionHandleAtPoint(e.clientX, e.clientY, rect);
    switch (hoveredHandle) {
      case "LT":
      case "RB":
        selection.setHover("nwse-resize");
        break;
      case "RT":
      case "LB":
        selection.setHover("nesw-resize");
        break;
      case "T":
      case "B":
        selection.setHover("ns-resize");
        break;
      case "L":
      case "R":
        selection.setHover("ew-resize");
        break;
      case "INSIDE":
        selection.setHover("move");
        break;
      case "OUTSIDE":
        selection.setHover("default");
        break;
    }

    if (!paintState.pointerdown) return;

    const point = to_pixel_canvas_coord(e.clientX, e.clientY);

    if (this.activeHandle === "INSIDE") {
      if (!selection.active) return;

      selection.setShowHandle(false);
      const newX = point.x - this.dragOffset.x;
      const newY = point.y - this.dragOffset.y;
      selection.setPosition(newX, newY);

      getLayerWorker().moveSelection(
        selection.x,
        selection.y,
        selection.width,
        selection.height,
        selection.flipH,
        selection.flipV,
      );
    } else if (this.activeHandle && this.activeHandle !== "OUTSIDE") {
      let { x, y, w, h } = this.start;
      let finalFlipH = this.start.flipH,
        finalFlipV = this.start.flipV;

      const p = point;

      switch (this.activeHandle) {
        case "RB":
          w = p.x - x + 1;
          if (w <= 0) w = p.x - x;
          h = p.y - y + 1;
          if (h <= 0) h = p.y - y;

          if (w < 0) finalFlipH = !this.start.flipH;
          if (h < 0) finalFlipV = !this.start.flipV;
          break;

        case "RT":
          h = y + h - p.y;
          y = p.y;
          w = p.x - x + 1;
          if (w <= 0) w = p.x - x;
          if (h <= 0) {
            h = this.start.y + this.start.h - p.y - 1;
            y = p.y + 1;
          }
          if (w < 0) finalFlipH = !this.start.flipH;
          if (h < 0) finalFlipV = !this.start.flipV;
          break;

        case "LB":
          w = x + w - p.x;
          x = p.x;
          h = p.y - y + 1;
          if (w <= 0) {
            w = this.start.x + this.start.w - p.x - 1;
            x = p.x + 1;
          }
          if (h <= 0) h = p.y - y;
          if (w < 0) finalFlipH = !this.start.flipH;
          if (h < 0) finalFlipV = !this.start.flipV;
          break;

        case "LT":
          w = x + w - p.x;
          h = y + h - p.y;
          x = p.x;
          y = p.y;

          if (w <= 0) {
            w = this.start.x + this.start.w - p.x - 1;
            x = p.x + 1;
          }
          if (h <= 0) {
            h = this.start.y + this.start.h - p.y - 1;
            y = p.y + 1;
          }
          if (w < 0) finalFlipH = !this.start.flipH;
          if (h < 0) finalFlipV = !this.start.flipV;
          break;

        case "R":
          w = p.x - x + 1;
          if (w <= 0) w = p.x - x;

          if (w < 0) finalFlipH = !this.start.flipH;

          break;

        case "L":
          w = this.start.x + this.start.w - p.x;
          x = p.x;
          if (w <= 0) {
            w = this.start.x + this.start.w - p.x - 1;
            x = p.x + 1;
          }

          if (w < 0) finalFlipH = !this.start.flipH;
          break;

        case "B":
          h = p.y - y + 1;
          if (h <= 0) h = p.y - y;
          if (h < 0) finalFlipV = !this.start.flipV;
          break;

        case "T":
          h = this.start.y + this.start.h - p.y;
          y = p.y;

          if (h <= 0) {
            h = this.start.y + this.start.h - p.y - 1;
            y = p.y + 1;
          }
          if (h < 0) finalFlipV = !this.start.flipV;
          break;
      }

      if (e.shiftKey) {
        const ratio = this.start.w / this.start.h;

        if (["L", "R", "T", "B"].includes(this.activeHandle)) {
          // LRTB 핸들: 변경된 방향에 따라 다른 방향도 비례적으로 조정
          if (["L", "R"].includes(this.activeHandle)) {
            // L, R 핸들: width 변경에 따라 height 조정
            h = Math.floor(Math.abs(w) / ratio);
          } else if (["T", "B"].includes(this.activeHandle)) {
            // T, B 핸들: height 변경에 따라 width 조정
            w = Math.floor(Math.abs(h) * ratio);
          }
        } else {
          // 코너 핸들: 기존 로직 유지
          const curRatio = w / h;
          console.log("before:", w, h);
          if (curRatio < ratio) w = Math.floor(h * ratio);
          else h = Math.floor(w / ratio);
        }

        if (["L", "LT", "LB"].includes(this.activeHandle)) x = this.start.x + this.start.w - w;
        if (["T", "LT", "RT"].includes(this.activeHandle)) y = this.start.y + this.start.h - h;
        console.log("after:", w, h);
      }

      // flip이 발생하면 좌표 정규화
      if (w < 0) {
        const newX = x + w;
        x = newX;
        w = -w; // Math.abs(w) 대신 -w 사용
      }
      if (h < 0) {
        const newY = y + h;
        y = newY;
        h = -h; // Math.abs(h) 대신 -h 사용
      }

      const min = 1,
        max = paintConfig.maxSize;
      selection.setX(x);
      selection.setY(y);
      selection.setWidth(clamp(w, min, max));
      selection.setHeight(clamp(h, min, max));

      // flip 상태 업데이트
      selection.setFlip(finalFlipH, finalFlipV);

      getLayerWorker().moveSelection(
        selection.x,
        selection.y,
        selection.width,
        selection.height,
        finalFlipH,
        finalFlipV,
      );
    }
  }

  up() {
    if (!this.activeHandle) return;
    if (this.activeHandle === "INSIDE") {
      beforeSelectionPos.x = selection.x;
      beforeSelectionPos.y = selection.y;
      beforeSelectionPos.width = selection.width;
      beforeSelectionPos.height = selection.height;
      selection.setShowHandle(true);
    }
    if (!paintState.pointerdown && this.activeHandle == "OUTSIDE") {
      let now = performance.now();
      if (now - this.startTime < 150) {
        console.log("cancel Selection!");

        applySelection();
        paintState.setToolId("select");
      }
    }

    if (this.activeHandle != "OUTSIDE") {
      const worker = getLayerWorker();
      worker.endMove();
    }

    selection.active = false;
    this.activeHandle = null;
  }
}

export const selectionTool = new SelectionTool();
