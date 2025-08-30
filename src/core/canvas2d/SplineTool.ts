import { paintOptions } from "./Canvas2DService";
import { Rect } from "../utils/rect";
import type { Pointer } from "../types.js";
import { calculateTangents, hermite } from "../utils/spline";

export class SplineTool {
  private points: Pointer[] = [];
  private isDrawing: boolean = false;
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private drawCanvas: HTMLCanvasElement;
  private drawCtx: CanvasRenderingContext2D;
  private tempCanvas: OffscreenCanvas;
  private tempCtx: OffscreenCanvasRenderingContext2D;
  private alphaMap: number[][];

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    // 그리기용 임시 캔버스 생성
    this.drawCanvas = document.createElement("canvas");
    this.drawCanvas.width = canvas.width;
    this.drawCanvas.height = canvas.height;
    this.drawCanvas.style.position = "absolute";
    this.drawCanvas.style.top = canvas.offsetTop + "px";
    this.drawCanvas.style.left = canvas.offsetLeft + "px";
    this.drawCanvas.style.zIndex = "10";
    this.drawCanvas.style.pointerEvents = "none";

    // 메인 캔버스의 부모에 임시 캔버스 추가
    canvas.parentElement?.appendChild(this.drawCanvas);

    this.drawCtx = this.drawCanvas.getContext("2d")!;
    this.drawCtx.imageSmoothingEnabled = false;

    // 선 그리기용 임시 캔버스 생성 (화면에 표시되지 않음)
    this.tempCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    this.tempCanvas.width = canvas.width;
    this.tempCanvas.height = canvas.height;
    let option: CanvasRenderingContext2DSettings = {};
    this.tempCtx = this.tempCanvas.getContext("2d", option)!; // willReadFrequently: true 하면 안됌!! line이 이상하게 그려짐!!
    this.tempCtx.imageSmoothingEnabled = false;

    // 알파 맵 초기화
    this.alphaMap = Array.from({ length: canvas.height }, () =>
      Array.from({ length: canvas.width }, () => 0)
    );
  }

  start(pointer: Pointer): void {
    this.isDrawing = true;
    this.points = [];
    // 알파 맵 초기화
    this.clearAlphaMap();
    this.points.push(pointer);
  }

  strokeTo(pointer: Pointer): void {
    if (this.isDrawing) {
      // 거리 작으면 무시하지 않게 하기. 애초에 거리가 충분히 떨어져있다고 가정.
      this.points.push(pointer);

      this.drawSpline();
    }
  }

  end(): void {
    if (this.isDrawing) {
      let dirtyRect = this.drawToTempCanvasInternal("final")!;
      // console.log(
      //   `🏁 End - DirtyRect: (${dirtyRect.x}, ${dirtyRect.y}) ~ (${dirtyRect.ex}, ${dirtyRect.ey}) | ${dirtyRect.width}x${dirtyRect.height}`
      // );
      this.extractToAlphaMap(
        this.tempCanvas,
        this.tempCtx,
        this.alphaMap,
        dirtyRect
      );
      this.renderFromAlphaMap(this.alphaMap, dirtyRect);

      this.isDrawing = false;
      // drawCanvas의 내용을 mainCanvas에 블렌딩 (덮어쓰기가 아닌 색상 합성)
      this.ctx.globalCompositeOperation = "source-over";
      this.ctx.drawImage(this.drawCanvas, 0, 0);
      // drawCanvas 초기화
      this.drawCtx.clearRect(
        0,
        0,
        this.drawCanvas.width,
        this.drawCanvas.height
      );
    }
  }

  cancel(): void {
    this.isDrawing = false;
    this.points = [];
    // 임시 캔버스 초기화
    this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
    // 메인 캔버스 초기화
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawSpline(): void {
    let dirtyRect = this.drawToTempCanvasInternal("incremental");
    if (dirtyRect) {
      // dirtyRect 디버깅 출력
      // console.log(
      //   `🎯 DrawSpline - DirtyRect: (${dirtyRect.x}, ${dirtyRect.y}) ~ (${dirtyRect.ex}, ${dirtyRect.ey}) | ${dirtyRect.width}x${dirtyRect.height}`
      // );

      // tempCanvas에서 alphaMap으로 픽셀 데이터 추출
      this.extractToAlphaMap(
        this.tempCanvas,
        this.tempCtx,
        this.alphaMap,
        dirtyRect
      );

      // alphaMap을 바탕으로 drawCanvas에 렌더링
      this.renderFromAlphaMap(this.alphaMap, dirtyRect);
    }
  }

  private clearAlphaMap(): void {
    for (let y = 0; y < this.alphaMap.length; y++) {
      for (let x = 0; x < this.alphaMap[y].length; x++) {
        this.alphaMap[y][x] = 0;
      }
    }
  }

  private drawToTempCanvasInternal(mode: "incremental" | "final"): Rect | null {
    this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
    const slicedPoints = this.points.slice(-4);
    const tangents = calculateTangents(slicedPoints);

    this.tempCtx.strokeStyle = "black";
    this.tempCtx.lineWidth = paintOptions.diameter;
    this.tempCtx.lineCap = "round";
    this.tempCtx.lineJoin = "round";
    this.tempCtx.beginPath();

    let dirtyRect = new Rect();

    if (slicedPoints.length == 1) {
      const p = slicedPoints[0];
      dirtyRect.updatePointer(p.x, p.y, paintOptions.diameter / 2);
      this.tempCtx.moveTo(p.x, p.y);
      this.tempCtx.lineTo(p.x, p.y);
      this.tempCtx.stroke();
      return dirtyRect;
    }

    for (let i = 0; i < slicedPoints.length - 1; i++) {
      const p0 = slicedPoints[i];
      const p1 = slicedPoints[i + 1];
      const v0 = tangents[i];
      const v1 = tangents[i + 1];

      const distance = Math.sqrt((p1.x - p0.x) ** 2 + (p1.y - p0.y) ** 2);
      const steps = Math.max(1, Math.floor(distance / 2));
      const stepSize = 1.0 / steps;

      let isFirst = true;
      const shouldDraw =
        mode === "incremental"
          ? i == slicedPoints.length - 3
          : i == slicedPoints.length - 2;

      if (shouldDraw) {
        //le.log("draw:");

        for (let t = 0; t <= 1.0001; t += stepSize) {
          const p = hermite(t, p0, p1, v0, v1);

          // console.log("stepSize:", p.x, p.y);

          dirtyRect.updatePointer(p.x, p.y, paintOptions.diameter / 2);

          if (isFirst) {
            this.tempCtx.moveTo(p.x, p.y);
            isFirst = false;
          } else {
            this.tempCtx.lineTo(p.x, p.y);
          }
        }
      }
    }
    this.tempCtx.stroke();

    if (dirtyRect.isEmpty()) {
      return null;
    }

    return dirtyRect;
  }

  private extractToAlphaMap(canvas, ctx, map, dirtyRect: Rect): void {
    const clampedRect = Rect.clampToCanvas(
      dirtyRect,
      canvas.width,
      canvas.height
    );
    const { startX, startY, endX, endY, width, height } = clampedRect.toData();

    const imageData = ctx.getImageData(startX, startY, width, height);
    const data = imageData.data;

    let pixelCount = 0;
    for (let y = startY; y <= endY; y++) {
      // inclusive 루프
      for (let x = startX; x <= endX; x++) {
        // inclusive 루프
        const index = ((y - startY) * width + (x - startX)) * 4;
        const alpha = data[index + 3] / 255; // 0~255를 0~1로 정규화
        map[y][x] = Math.max(map[y][x], alpha); // 기존값과 비교해서 더 큰 값 사용
        pixelCount++;
      }
    }
  }

  private renderFromAlphaMap(map, dirtyRect: Rect): void {
    // Rect.clampToCanvas로 경계 계산을 캡슐화
    const clampedRect = Rect.clampToCanvas(
      dirtyRect,
      this.drawCanvas.width,
      this.drawCanvas.height
    );
    const { startX, startY, endX, endY, width, height } = clampedRect.toData();

    this.drawCtx.clearRect(startX, startY, width, height);

    const imageData = this.drawCtx.createImageData(width, height);
    const data = imageData.data;

    let pixelCount = 0;
    for (let y = startY; y <= endY; y++) {
      // inclusive 루프
      for (let x = startX; x <= endX; x++) {
        // inclusive 루프
        const index = ((y - startY) * width + (x - startX)) * 4;
        const alpha = map[y][x];

        if (alpha > 0) {
          data[index] = paintOptions.color.r; // R
          data[index + 1] = paintOptions.color.g; // G (cyan)
          data[index + 2] = paintOptions.color.b; // B
          data[index + 3] = Math.round(alpha * 255 * paintOptions.alpha); // A (0.5 투명도 적용)
        }
        pixelCount++;
      }
    }

    this.drawCtx.putImageData(imageData, startX, startY);
  }
}
