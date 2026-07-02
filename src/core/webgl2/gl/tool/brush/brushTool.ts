import { getRenderingManager } from "../../render/render";
import { getSourceTextureManager, paintOptions } from "../../texture";
import { getLayerManager } from "../../layer";
import { getManager } from "../../../../utils/cachedManager";
import { HistoryObject, getHistoryManager } from "../../../../history/history";
import { Rect } from "@/core/utils/rect";
import type { Pointer } from "@/core/types";
import { CapsuleModule } from "./strokeModule/capsuleModule";
import { CapsuleHardModule } from "./strokeModule/capsuleHardModule";
import { PencilModule } from "./strokeModule/pencilModule";
import { SplineModule } from "./strokeModule/splineModule";
import { createBrushRender } from "./renderModule";
import type { BrushRenderRect, BrushRenderMode } from "./renderModule";

export enum StrokeType {
  Spline = "spline",
  Dist = "dist",
  Pencil = "pencil",
}

export function getBrushManager(
  canvas: HTMLCanvasElement,
  gl: WebGL2RenderingContext,
) {
  return getManager(gl, "brushManager", () => new BrushManager(canvas, gl));
}

interface StrokeModule {
  setAlpha(alpha: number): void;
  setDiameter(diameter: number): void;
  start(point: { x: number; y: number }): BrushRenderRect;
  move(point: { x: number; y: number }): BrushRenderRect;
  end(): BrushRenderRect;
}

class BrushManager {
  private readonly sourceTextureManager;
  private readonly layerManager;
  private readonly renderingManager;
  private readonly canvas: HTMLCanvasElement;

  private renderModule: ReturnType<typeof createBrushRender>;
  private splinePath: StrokeModule;
  private distPath: StrokeModule;
  private distPixelPath: StrokeModule;
  private pencilPath: StrokeModule;
  private alphaMapTexture: WebGLTexture;
  private imageFBO: WebGLFramebuffer;
  private resultFBO: WebGLFramebuffer;

  private currentStrokeModule: StrokeModule;
  private strokeType = StrokeType.Spline;
  private mode: BrushRenderMode = "brush";
  private dirtyRect: BrushRenderRect | null = null;
  private resourceWidth = 0;
  private resourceHeight = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
  ) {
    this.canvas = canvas;
    this.sourceTextureManager = getSourceTextureManager(canvas, gl);
    this.layerManager = getLayerManager(canvas, gl);
    this.renderingManager = getRenderingManager(canvas, gl);

    const modules = this.createModules();
    this.alphaMapTexture = modules.alphaMapTexture;
    this.renderModule = modules.renderModule;
    this.splinePath = modules.splinePath;
    this.distPath = modules.distPath;
    this.distPixelPath = modules.distPixelPath;
    this.pencilPath = modules.pencilPath;
    this.imageFBO = modules.imageFBO;
    this.resultFBO = modules.resultFBO;
    this.currentStrokeModule = this.splinePath;
    this.resourceWidth = paintOptions.width;
    this.resourceHeight = paintOptions.height;
  }

  setMode(nextMode: BrushRenderMode) {
    this.mode = nextMode;
  }

  setStrokeType(type: StrokeType) {
    this.strokeType = type;
  }

  start(pointer: Pointer) {
    this.ensureSize();
    this.currentStrokeModule = this.selectStrokeModule();
    this.currentStrokeModule.setAlpha(paintOptions.alpha);
    this.currentStrokeModule.setDiameter(paintOptions.radius * 2);
    this.renderModule.setMode(this.mode);
    this.renderModule.setColor([
      paintOptions.color[0],
      paintOptions.color[1],
      paintOptions.color[2],
      1,
    ]);
    this.dirtyRect = null;

    const rect = this.currentStrokeModule.start(pointer);
    this.dirtyRect = unionRect(this.dirtyRect, rect);
    this.renderModule.render(rect);
    this.renderingManager.render();
  }

  stroke(_start: Pointer, end: Pointer) {
    const rect = this.currentStrokeModule.move(end);
    this.dirtyRect = unionRect(this.dirtyRect, rect);
    this.renderModule.render(rect);
    this.renderingManager.render();
  }

  brush() {}

  eraser() {}

  end(toolId: "brush" | "eraser") {
    this.mode = toolId === "eraser" ? "eraser" : "brush";
    this.renderModule.setMode(this.mode);

    const strokeRect = this.currentStrokeModule.end();
    const rect = unionRect(this.dirtyRect, strokeRect);
    this.dirtyRect = null;

    if (rect.width === 0 || rect.height === 0) return;

    this.renderModule.render(rect);
    this.blitRect(this.resultFBO, this.imageFBO, rect);
    this.clearAlphaMap(rect);
    this.commitHistory(rect);
    this.renderingManager.render(this.toAppRect(rect) ?? undefined);
  }

  cancel() {
    const strokeRect = this.currentStrokeModule.end();
    const rect = unionRect(this.dirtyRect, strokeRect);
    this.dirtyRect = null;

    if (rect.width === 0 || rect.height === 0) return;

    this.blitRect(this.imageFBO, this.resultFBO, rect);
    this.clearAlphaMap(rect);
    this.renderingManager.render();
  }

  private ensureSize() {
    if (
      this.resourceWidth === paintOptions.width &&
      this.resourceHeight === paintOptions.height
    ) {
      return;
    }

    // 리사이즈마다 재생성하므로 이전 세대 GL 리소스를 먼저 해제한다.
    // (alphaMapTexture는 캔버스 크기의 R8 텍스처라 누수 시 비용이 큼)
    const gl = this.gl;
    gl.deleteTexture(this.alphaMapTexture);
    gl.deleteFramebuffer(this.imageFBO);
    gl.deleteFramebuffer(this.resultFBO);

    const modules = this.createModules();
    this.alphaMapTexture = modules.alphaMapTexture;
    this.renderModule = modules.renderModule;
    this.splinePath = modules.splinePath;
    this.distPath = modules.distPath;
    this.distPixelPath = modules.distPixelPath;
    this.pencilPath = modules.pencilPath;
    this.imageFBO = modules.imageFBO;
    this.resultFBO = modules.resultFBO;
    this.currentStrokeModule = this.selectStrokeModule();
    this.resourceWidth = paintOptions.width;
    this.resourceHeight = paintOptions.height;
  }

  private createModules() {
    const gl = this.gl;
    const width = paintOptions.width;
    const height = paintOptions.height;
    const imageTexture = this.sourceTextureManager.texture;
    const resultTexture = this.layerManager.getLayerTex(paintOptions.layerId);

    const alphaMapTexture = createAlphaMapTexture(gl, width, height);

    const renderModule = createBrushRender(gl, {
      imageTexture,
      resultTexture,
      maskTexture: alphaMapTexture,
      width,
      height,
    });

    const imageFBO = createFramebuffer(gl, imageTexture);
    const resultFBO = createFramebuffer(gl, resultTexture);

    const splinePath = SplineModule(gl, { alphaMapTexture, width, height });
    const distPath = CapsuleModule(gl, { alphaMapTexture, width, height });
    const distPixelPath = CapsuleHardModule(gl, { alphaMapTexture, width, height });
    const pencilPath = PencilModule(gl, { alphaMapTexture, width, height });

    return { alphaMapTexture, renderModule, splinePath, distPath, distPixelPath, pencilPath, imageFBO, resultFBO };
  }

  private blitRect(readFBO: WebGLFramebuffer, drawFBO: WebGLFramebuffer, rect: BrushRenderRect) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, drawFBO);
    gl.blitFramebuffer(
      rect.x, rect.y, rect.x + rect.width, rect.y + rect.height,
      rect.x, rect.y, rect.x + rect.width, rect.y + rect.height,
      gl.COLOR_BUFFER_BIT, gl.NEAREST,
    );
  }

  private clearAlphaMap(rect: BrushRenderRect) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.alphaMapTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(
      gl.TEXTURE_2D, 0,
      rect.x, rect.y, rect.width, rect.height,
      gl.RED, gl.UNSIGNED_BYTE,
      new Uint8Array(rect.width * rect.height),
    );
  }

  private selectStrokeModule(): StrokeModule {
    if (this.strokeType === StrokeType.Dist) return this.distPath;
    if (this.strokeType === StrokeType.Pencil) {
      return paintOptions.radius * 2 > 20 ? this.distPixelPath : this.pencilPath;
    }
    return this.splinePath;
  }

  private commitHistory(brushRect: BrushRenderRect) {
    const rect = this.toAppRect(brushRect);
    if (!rect || rect.isEmpty()) return;

    const { before, after } = this.sourceTextureManager.upload(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    );

    const byteSize = rect.width * rect.height * 4 * 2;
    const history = new HistoryObject({
      undo: async () => {
        await before.apply();
        await this.renderingManager.render(rect);
        return {};
      },
      redo: async () => {
        await after.apply();
        await this.renderingManager.render(rect);
        return {};
      },
      byteSize,
    });

    getHistoryManager(this.canvas, this.gl).addUndo(history);
  }

  private toAppRect(rect: BrushRenderRect | null): Rect | null {
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return Rect.fromWidth(rect.x, rect.y, rect.width, rect.height);
  }
}

function unionRect(
  a: BrushRenderRect | null,
  b: BrushRenderRect,
): BrushRenderRect {
  if (!a) return b;
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function createFramebuffer(gl: WebGL2RenderingContext, texture: WebGLTexture): WebGLFramebuffer {
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  return fbo;
}

function createAlphaMapTexture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
): WebGLTexture {
  const PATHMAP_UNIT = 3;
  const texture = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0 + PATHMAP_UNIT);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  return texture;
}
