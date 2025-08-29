import type { IRenderService } from "../IRenderService.js";
import { paintOptions } from "../DrawingController.js";
import { Rect } from "../rect.js";
import type { Pointer } from "../types.js";
import { calculateTangents, hermite } from "../utils";

// WebGPU 타입 선언 (임시로 any 사용)
declare global {
  interface Navigator {
    gpu: any;
  }
}

export class WebGPUService implements IRenderService {
  private points: Pointer[] = [];
  private isDrawing: boolean = false;
  private canvas2D: HTMLCanvasElement;
  private webgpuCanvas: HTMLCanvasElement;
  private tempCanvas: OffscreenCanvas;
  private tempCtx: OffscreenCanvasRenderingContext2D;

  // WebGPU 리소스
  private device: any = null;
  private context: any = null;
  private initialized: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas2D = canvas;

    // WebGPU 전용 캔버스 생성
    this.webgpuCanvas = document.createElement("canvas");
    this.webgpuCanvas.width = canvas.width;
    this.webgpuCanvas.height = canvas.height;
    this.webgpuCanvas.style.position = "absolute";
    this.webgpuCanvas.style.top = canvas.offsetTop + "px";
    this.webgpuCanvas.style.left = canvas.offsetLeft + "px";
    this.webgpuCanvas.style.zIndex = "5";
    this.webgpuCanvas.style.pointerEvents = "none";
    this.webgpuCanvas.style.display = "block";

    canvas.parentElement?.appendChild(this.webgpuCanvas);

    // tempCanvas는 기존 방식 그대로 유지
    this.tempCanvas = new OffscreenCanvas(canvas.width, canvas.height);
    this.tempCtx = this.tempCanvas.getContext("2d")!;
    this.tempCtx.imageSmoothingEnabled = false;
  }

  async initialize(): Promise<boolean> {
    try {
      if (!navigator.gpu) {
        console.warn("WebGPU not supported");
        return false;
      }

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.warn("No WebGPU adapter found");
        return false;
      }

      this.device = await adapter.requestDevice();
      this.context = this.webgpuCanvas.getContext("webgpu");

      if (!this.context) {
        console.warn("Failed to get WebGPU context");
        return false;
      }

      const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format: canvasFormat,
        alphaMode: "premultiplied",
      });

      await this.createTextures();
      await this.createShaders();

      this.initialized = true;

      // Canvas2D 숨기고 WebGPU 표시
      this.canvas2D.style.display = "none";
      this.webgpuCanvas.style.display = "block";

      console.log("WebGPU service initialized successfully");
      return true;
    } catch (error) {
      console.error("WebGPU service initialization failed:", error);
      this.initialized = false;
      return false;
    }
  }

  private async createTextures(): Promise<void> {
    if (!this.device) return;
    // 텍스처 생성 로직은 나중에 구현
    console.log("Creating WebGPU textures (stub)");
  }

  private async createShaders(): Promise<void> {
    // 간단한 셰이더 구현 - 실제로는 더 복잡한 파이프라인 필요
    // 현재는 기본 구조만 생성
  }

  start(pointer: Pointer): void {
    this.isDrawing = true;
    this.points = [];
    this.points.push(pointer);
  }

  strokeTo(pointer: Pointer): void {
    if (this.isDrawing && this.initialized) {
      this.points.push(pointer);
      this.drawSpline();
    }
  }

  end(): void {
    if (this.isDrawing && this.initialized) {
      this.finalizeStroke();
      this.isDrawing = false;
    }
  }

  cancel(): void {
    this.isDrawing = false;
    this.points = [];
    if (this.initialized) {
      this.clearDrawTexture();
    }
  }

  getServiceType(): "canvas2d" | "webgpu" {
    return "webgpu";
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  destroy(): void {
    this.webgpuCanvas.remove();
    // 2D 캔버스 다시 표시
    this.canvas2D.style.display = "block";
  }

  private drawSpline(): void {
    // 1. tempCanvas에 스플라인 그리기 (기존 방식)
    const dirtyRect = this.drawToTempCanvas("incremental");
    if (!dirtyRect) return;

    // 2. tempCanvas → GPU 텍스처 업로드
    this.updateGPUFromCanvas(dirtyRect);

    // 3. GPU에서 렌더링 및 합성
    this.renderOnGPU(dirtyRect);
  }

  private finalizeStroke(): void {
    const dirtyRect = this.drawToTempCanvas("final");
    if (!dirtyRect) return;

    this.updateGPUFromCanvas(dirtyRect);
    this.renderOnGPU(dirtyRect);

    // drawTexture → layerTexture 합성
    this.commitToLayer();
  }

  private drawToTempCanvas(mode: "incremental" | "final"): Rect | null {
    // 기존 SplineTool의 drawToTempCanvasInternal과 동일한 로직
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
        for (let t = 0; t <= 1.0001; t += stepSize) {
          const p = hermite(t, p0, p1, v0, v1);
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

    return dirtyRect.isEmpty() ? null : dirtyRect;
  }

  private updateGPUFromCanvas(dirtyRect: Rect): void {
    // tempCanvas 픽셀 데이터 → alphaTexture 업로드
    // 실제 구현에서는 GPU 버퍼 생성 및 copyBufferToTexture 사용
    console.log("Updating GPU textures from canvas", dirtyRect);
  }

  private renderOnGPU(dirtyRect: Rect): void {
    // alphaTexture + color → drawTexture 렌더링
    // GPU compute shader 실행
    console.log("Rendering on GPU", dirtyRect);
  }

  private commitToLayer(): void {
    // drawTexture → layerTexture 합성
    // copyTextureToTexture 사용
    console.log("Committing draw to layer");
  }

  private clearDrawTexture(): void {
    // drawTexture 초기화
    console.log("Clearing draw texture");
  }
}
