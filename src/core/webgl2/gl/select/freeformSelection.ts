import type { Pointer } from "@/core/types";
import { Rect } from "@/core/utils/rect";

export function getFreeformSelectionRect(points: Pointer[]): Rect | null {
  if (points.length < 3) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  const x = Math.floor(minX);
  const y = Math.floor(minY);
  const width = Math.ceil(maxX) - x + 1;
  const height = Math.ceil(maxY) - y + 1;

  if (width <= 1 || height <= 1) return null;

  return Rect.fromWidth(x, y, width, height);
}

export function createFreeformSelectionMask(
  points: Pointer[],
  rect: Rect,
): Uint8Array {
  const mask = new Uint8Array(rect.width * rect.height);

  for (let y = 0; y < rect.height; y++) {
    for (let x = 0; x < rect.width; x++) {
      const px = rect.x + x + 0.5;
      const py = rect.y + y + 0.5;
      if (isPointInPolygonEvenOdd(px, py, points)) {
        mask[y * rect.width + x] = 1;
      }
    }
  }

  return mask;
}

function isPointInPolygonEvenOdd(
  x: number,
  y: number,
  points: Pointer[],
): boolean {
  let inside = false;
  let previous = points.length - 1;

  for (let current = 0; current < points.length; current++) {
    const start = points[current];
    const end = points[previous];
    const crossesY = start.y > y !== end.y > y;

    if (crossesY) {
      const intersectionX =
        ((end.x - start.x) * (y - start.y)) / (end.y - start.y) + start.x;
      if (x < intersectionX) inside = !inside;
    }

    previous = current;
  }

  return inside;
}
