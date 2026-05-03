import { getPixelRatio, position, to_canvas_coord } from "../position";

export const RESIZE_HANDLE_SIZE_PX = 7;
export const RESIZE_HANDLE_EDGE_OFFSET_PX = Math.floor(
  RESIZE_HANDLE_SIZE_PX / 2,
);
export const RESIZE_HANDLE_HIT_MARGIN_PX = 22;

export type ResizeCornerHandle = "LT" | "RT" | "RB" | "LB";
export type ResizeCursor = "default" | "nwse-resize" | "nesw-resize";

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
  margin = RESIZE_HANDLE_HIT_MARGIN_PX,
): ResizeCornerHandle | null {
  const dpr = getPixelRatio();
  const left = (position.x * position.scale) / dpr;
  const top =
    (position.y * position.scale) / dpr +
    position.bouncingRect.y -
    position.bottomNavHeight;
  const width = (position.width * position.scale) / dpr;
  const height = (position.height * position.scale) / dpr;
  const right = left + width;
  const bottom = top + height;

  const inRect = (
    x: number,
    y: number,
    rect: { x: number; y: number; w: number; h: number },
  ) =>
    x >= rect.x &&
    x <= rect.x + rect.w &&
    y >= rect.y &&
    y <= rect.y + rect.h;

  const corners = {
    LT: { x: left - margin, y: top - margin, w: margin, h: margin },
    RT: { x: right, y: top - margin, w: margin, h: margin },
    RB: { x: right, y: bottom, w: margin, h: margin },
    LB: { x: left - margin, y: bottom, w: margin, h: margin },
  } as const;

  for (const key of ["LT", "RT", "RB", "LB"] as const) {
    if (inRect(clientX, clientY, corners[key])) return key;
  }

  return null;
}

export function cursorForResizeHandle(
  handle: ResizeCornerHandle | null,
): ResizeCursor {
  if (handle === "LT" || handle === "RB") return "nwse-resize";
  if (handle === "RT" || handle === "LB") return "nesw-resize";
  return "default";
}

export function toResizeEdgePoint(
  e: PointerEvent,
  handle: ResizeCornerHandle | null,
) {
  const dpr = getPixelRatio();
  const offset = (RESIZE_HANDLE_EDGE_OFFSET_PX * dpr) / position.scale;
  const point = to_canvas_coord(e.clientX, e.clientY);
  const toPixel = ({ x, y }: { x: number; y: number }) => ({
    x: Math.round(x),
    y: Math.round(y),
  });

  switch (handle) {
    case "LT":
      return toPixel({ x: point.x + offset, y: point.y + offset });
    case "RT":
      return toPixel({ x: point.x - offset, y: point.y + offset });
    case "RB":
      return toPixel({ x: point.x - offset, y: point.y - offset });
    case "LB":
      return toPixel({ x: point.x + offset, y: point.y - offset });
    case null:
      return toPixel(point);
  }
}

export function toContainerRect(rect: CanvasRect): CanvasRect {
  const dpr = getPixelRatio();

  return {
    x: ((rect.x + position.x) * position.scale) / dpr,
    y: ((rect.y + position.y) * position.scale) / dpr,
    width: (rect.width * position.scale) / dpr,
    height: (rect.height * position.scale) / dpr,
  };
}
