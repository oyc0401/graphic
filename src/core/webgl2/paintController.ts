import { paintOptions } from "./gl/texture";
import { toWebglCoord, toWebglCoord2, toWebglCoord3 } from "./coordinate";
import { PaintService } from "./paintService";
import { getInitialImageLayout } from "../initialImageLayout";
import type {
  CoreSessionTool,
  CoreTool,
  LiquifyTool,
  MosaicMode,
  Pointer,
} from "../types.js";
import { HistoryResponse } from "../history/history";

let paint: PaintService;

export class WebGL2Controller {
  // 그림판을 사용할 캔버스와 이미지 크기, 초기 화면 위치를 설정한다.
  async install(
    main_canvas: OffscreenCanvas,
    screenWidth: number,
    screenHeight: number,
    dpr: number,
    width: number,
    height: number,
    px: number,
    py: number,
    scale: number,
    image?: ImageBitmap | null,
  ): Promise<void> {
    if (image) {
      const layout = getInitialImageLayout(
        screenWidth,
        screenHeight,
        image.width,
        image.height,
      );
      width = layout.width;
      height = layout.height;
      px = layout.x;
      py = layout.y;
      scale = layout.scale;
    }

    let { x, y } = toWebglCoord3(px, py, height, screenHeight, scale);

    paintOptions.screenWidth = screenWidth;
    paintOptions.screenHeight = screenHeight;
    paintOptions.dpr = dpr;
    paintOptions.width = width;
    paintOptions.height = height;

    paintOptions.x = x;
    paintOptions.y = y;

    paintOptions.magnification = scale;

    main_canvas.width = screenWidth;
    main_canvas.height = screenHeight;

    paint = new PaintService(main_canvas);
    await paint.initialize();
    if (image) {
      paint.uploadInitialImage(image);
    }
  }

  // 그리기와 편집이 적용될 레이어를 선택한다.
  setLayerId(layerId: string | number): void {
    paint.setLayerId(layerId);
  }

  // 사용자가 보고 있는 화면의 위치와 확대 비율을 변경한다.
  setCameraPosition(px: number, py: number, magnification: number): void {
    let { x, y } = toWebglCoord3(
      px,
      py,
      paintOptions.height,
      paintOptions.screenHeight,
      magnification,
    );
    paint.setCameraPosition(x, y, magnification);
  }

  // 현재 레이어를 지정한 위치와 크기로 다시 맞춘다.
  resizeLayer(px: number, py: number, width: number, height: number): void {
    const newY = paintOptions.height - height - py;
    paint.resizeLayer(px, newY, width, height);
  }

  // 브라우저에 보이는 작업 화면의 크기를 변경한다.
  resizeScreenSize(screenWidth: number, screenHeight: number): void {
    paint.resizeScreen(screenWidth, screenHeight);
  }

  // 현재 이미지와 편집 상태를 화면에 다시 그린다.
  render(): void {
    paint.render();
  }

  // 브러시의 색상을 설정한다.
  setStrokeColor(r: number, g: number, b: number): void {
    paint.setStrokeColor(r, g, b);
  }

  // 브러시의 두께를 설정한다.
  setStrokeSize(size: number): void {
    paint.setStrokeSize(size);
  }

  // 브러시의 불투명도를 0부터 100까지의 값으로 설정한다.
  setAlpha(alpha: number): void {
    paint.setAlpha(alpha / 100);
  }
  // 이미지에서 지정한 위치의 색상을 가져온다.
  sampleColor(px: number, py: number): { r: number; g: number; b: number } {
    const x = Math.floor(px);
    const y = paintOptions.height - Math.floor(py) - 1;
    return paint.sampleColor(x, y);
  }

  // 브러시, 지우개, 선택 같은 현재 사용 도구를 변경한다.
  setTool(toolId: CoreTool): void {
    paint.setTool(toolId);
  }

  // 픽셀 유동화처럼 적용 전까지 임시로 편집하는 작업 모드를 시작한다.
  openSession(toolId: CoreSessionTool): void {
    paint.openSession(toolId);
  }

  // 픽셀 유동화 세션 내부에서 사용할 변형 도구를 선택한다.
  setLiquifyTool(toolId: LiquifyTool): void {
    paint.setLiquifyTool(toolId);
  }

  // 모자이크 세션에서 사용할 렌더링 방식을 선택한다.
  setMosaicMode(mode: MosaicMode): void {
    paint.setMosaicMode(mode);
  }

  // 모자이크 세션의 전역 강도를 0부터 100까지의 값으로 설정한다.
  setMosaicStrength(strength: number): void {
    paint.setMosaicStrength(strength / 100);
  }

  // 현재 세션의 편집 결과를 이미지에 적용한다.
  commitSession(): void {
    paint.commitSession();
  }

  // 현재 세션의 편집 결과를 버린다.
  discardSession(): void {
    paint.discardSession();
  }

  // 사용자가 누른 위치에서 그리기나 편집 동작을 시작한다.
  start(p: Pointer): void {
    let pointer = toWebglCoord(p, paintOptions.height);
    paint.start(pointer);
  }
  // 사용자가 움직인 위치까지 그리기나 편집 동작을 이어간다.
  strokeTo(p: Pointer): void {
    let pointer = toWebglCoord(p, paintOptions.height);
    paint.strokeTo(pointer);
  }
  // 포인터를 누른 상태에서 매 프레임 적용되는 편집 동작을 실행한다.
  apply(p: Pointer): void {
    let pointer = toWebglCoord(p, paintOptions.height);
    paint.apply(pointer);
  }
  // 현재 진행 중인 그리기나 편집 동작을 완료한다.
  end(): void {
    paint.end();
  }
  // 현재 진행 중인 그리기나 편집 동작을 취소한다.
  cancel(): void {
    paint.cancel();
  }

  // 이미지의 지정한 사각형 영역을 선택한다.
  createSelection(px: number, py: number, w: number, h: number): void {
    let { x, y } = toWebglCoord2(px, py, w, h, paintOptions.height);
    paint.createSelection(x, y, w, h);
  }

  // 선택 영역을 지정한 위치와 크기로 이동하거나 뒤집는다.
  transformSelection(
    px: number,
    py: number,
    width: number,
    height: number,
    flipH = false,
    flipV = false,
  ): void {
    let { x, y } = toWebglCoord2(px, py, width, height, paintOptions.height);
    paint.transformSelection(x, y, width, height, flipH, flipV);
  }

  // 선택 영역 이동이나 변형 작업을 완료한다.
  completeTransformSelection(): void {
    paint.completeTransformSelection();
  }

  // 선택 영역에 대한 이동, 붙여넣기, 변형 결과를 이미지에 확정한다.
  commitSelection(): void {
    paint.commitSelection();
  }

  // 현재 선택된 이미지 영역을 지운다.
  deleteSelection(): void {
    paint.deleteSelection();
  }

  // 외부 이미지를 지정한 영역에 붙여넣는다.
  paste(
    px: number,
    py: number,
    width: number,
    height: number,
    imageBitmap: ImageBitmap,
  ): void {
    let { x, y } = toWebglCoord2(px, py, width, height, paintOptions.height);
    paint.paste(x, y, width, height, imageBitmap);
  }

  // 현재 선택 영역의 이미지 데이터를 복사해 가져온다.
  getSelectionPixel(): PixelData {
    return paint.getSelectionPixel();
  }

  // 현재 선택 영역을 이미지에서 제거하고 그 데이터를 가져온다.
  cut(): PixelData {
    return paint.cut();
  }
  // 전체 이미지를 저장이나 내보내기에 사용할 픽셀 데이터로 가져온다.
  downloadImage(): PixelData {
    return paint.downloadImage();
  }

  // 외부 이미지를 현재 작업 이미지로 불러온다.
  uploadImage(bitmap: ImageBitmap): void {
    return paint.uploadImage(bitmap);
  }
  // 작업 이미지를 비우고 지정한 크기의 새 이미지로 시작한다.
  resetImage(width: number, height: number): void {
    return paint.resetImage(width, height);
  }

  // 마지막으로 확정한 편집 작업을 되돌린다.
  async undo(): Promise<HistoryResponse | null> {
    return paint.undo();
  }
  // 되돌렸던 편집 작업을 다시 적용한다.
  async redo(): Promise<HistoryResponse | null> {
    return paint.redo();
  }

  // 되돌리기와 다시 적용이 가능한 작업 개수를 가져온다.
  getHistoryCount(): HistoryCount {
    return paint.getHistoryCount();
  }

  // 이 컨트롤러가 사용하는 그림 처리 방식을 식별한다.
  getServiceType(): "canvas2d" | "webgl" | "webgpu" {
    return "webgl";
  }

  // 컨트롤러 사용을 끝낼 때 필요한 정리 작업을 수행한다.
  destroy(): void {
    // SplineTool에서 리소스 정리하도록 위임 (필요시)
  }
}

interface HistoryCount {
  undoCount: number;
  redoCount: number;
}

interface PixelData {
  pixels: Uint8ClampedArray<ArrayBufferLike>;
  width: number;
  height: number;
}
