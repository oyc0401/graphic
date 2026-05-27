import { Rect } from "@/core/utils/rect";
import type { Pointer } from "@/core/types";
import { HistoryObject, getHistoryManager } from "../../../../history/history";
import { getLayerManager } from "../../layer";
import { getRenderingManager } from "../../render/render";
import { getSourceTextureManager, paintOptions } from "../../texture";
import { createFloodFill } from "./floodFillModule";
import type { FloodFillColor, FloodFillRect } from "./floodFillModule";

export function floodFill(
  canvas: OffscreenCanvas,
  gl: WebGL2RenderingContext,
  point: Pointer,
  tolerance: number,
) {
  const layerManager = getLayerManager(canvas, gl);
  const layerTexture = layerManager.getLayerTex(paintOptions.layerId);
  const floodFill = createFloodFill(gl, {
    imageTexture: layerTexture,
    resultTexture: layerTexture,
    width: paintOptions.width,
    height: paintOptions.height,
  });

  floodFill.setTolerance(tolerance);
  floodFill.setAlpha(paintOptions.alpha);
  floodFill.setColor(paintOptions.color as FloodFillColor);

  const fillRect = floodFill.fill(point);
  floodFill.destroy();

  const rect = toLayerRect(fillRect);
  if (!rect || rect.isEmpty()) return false;

  const sourceTextureManager = getSourceTextureManager(canvas, gl);
  const renderingManager = getRenderingManager(canvas, gl);
  const { before, after } = sourceTextureManager.upload(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
  );

  const byteSize = rect.width * rect.height * 4 * 2;
  const history = new HistoryObject({
    undo: async () => {
      await before.apply();
      await renderingManager.render(rect);
      return {};
    },
    redo: async () => {
      await after.apply();
      await renderingManager.render(rect);
      return {};
    },
    byteSize,
  });

  getHistoryManager(canvas, gl).addUndo(history);
  renderingManager.render(rect);
  return true;
}

function toLayerRect(rect: FloodFillRect | null): Rect | null {
  if (!rect || rect.width === 0 || rect.height === 0) return null;
  return Rect.fromWidth(rect.x, rect.y, rect.width, rect.height);
}
