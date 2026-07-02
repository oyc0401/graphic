import { getCamera, getPixelRatio, position, to_canvas_coord } from "../position";
import { sceneRectToContainer } from "./cameraMath";

export const RESIZE_HANDLE_SIZE_PX = 7;
export const RESIZE_HANDLE_STROKE_WIDTH_PX = 3;
export const RESIZE_HANDLE_HIT_SIZE_PX = 23;

export type ResizeCornerHandle = "LT" | "RT" | "RB" | "LB";
export type ResizeCursor = "nwse-resize" | "nesw-resize";

export type CanvasRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getCanvasResizeRect(): CanvasRect {
  return {
    x: 0,
    y: 0,
    width: position.width,
    height: position.height,
  };
}

export function hitTestOutsideCanvasResizeCorner(
  clientX: number,
  clientY: number,
  hitSize = RESIZE_HANDLE_HIT_SIZE_PX,
): ResizeCornerHandle | null {
  if (hitSize % 2 === 0) {
    throw new Error("Canvas resize handle hit size must be odd.");
  }

  const size = sceneRectToContainer(
    { x: 0, y: 0, width: position.width, height: position.height },
    getCamera(),
    getPixelRatio(),
  );
  const left = size.x;
  const top = size.y + position.bouncingRect.y - position.bottomNavHeight;
  const width = size.width;
  const height = size.height;
  const right = left + width;
  const bottom = top + height;

  const inRect = (
    x: number,
    y: number,
    rect: { x: number; y: number; w: number; h: number },
  ) =>
    x >= rect.x &&
    x < rect.x + rect.w &&
    y >= rect.y &&
    y < rect.y + rect.h;

  const half = Math.floor(hitSize / 2);
  const insideCanvas =
    clientX >= left && clientX < right && clientY >= top && clientY < bottom;

  if (insideCanvas) {
    return null;
  }

  const corners = {
    LT: { x: left - half, y: top - half, w: hitSize, h: hitSize },
    RT: { x: right - half, y: top - half, w: hitSize, h: hitSize },
    RB: { x: right - half, y: bottom - half, w: hitSize, h: hitSize },
    LB: { x: left - half, y: bottom - half, w: hitSize, h: hitSize },
  } as const;

  for (const key of ["LT", "RT", "RB", "LB"] as const) {
    if (inRect(clientX, clientY, corners[key])) return key;
  }

  return null;
}

export function cursorForResizeHandle(
  handle: ResizeCornerHandle | null,
): ResizeCursor | null {
  if (handle === "LT" || handle === "RB") return "nwse-resize";
  if (handle === "RT" || handle === "LB") return "nesw-resize";
  return null;
}

export function toResizeEdgePoint(
  e: PointerEvent,
  handle: ResizeCornerHandle | null,
) {
  const point = to_canvas_coord(e.clientX, e.clientY);
  const toPixel = ({ x, y }: { x: number; y: number }) => ({
    x: Math.round(x),
    y: Math.round(y),
  });

  switch (handle) {
    case "LT":
    case "RT":
    case "RB":
    case "LB":
    case null:
      return toPixel(point);
  }
}

export function toContainerRect(rect: CanvasRect): CanvasRect {
  return sceneRectToContainer(rect, getCamera(), getPixelRatio());
}
