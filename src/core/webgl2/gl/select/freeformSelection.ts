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
    const intersections = getRowIntersections(rect.y + y + 0.5, points);
    let inside = intersections.length % 2 === 1;
    let startX = 0;

    for (const intersectionX of intersections) {
      const endX = clampMaskX(Math.ceil(intersectionX - rect.x - 0.5), rect);
      if (inside) {
        fillMaskRow(mask, rect.width, y, startX, endX);
      }
      inside = !inside;
      startX = endX;
    }

    if (inside) {
      fillMaskRow(mask, rect.width, y, startX, rect.width);
    }
  }

  return mask;
}

function getRowIntersections(y: number, points: Pointer[]): number[] {
  const intersections: number[] = [];
  let previous = points.length - 1;

  for (let current = 0; current < points.length; current++) {
    const start = points[current];
    const end = points[previous];
    const crossesY = start.y > y !== end.y > y;

    if (crossesY) {
      const intersectionX =
        ((end.x - start.x) * (y - start.y)) / (end.y - start.y) + start.x;
      intersections.push(intersectionX);
    }

    previous = current;
  }

  return intersections.sort((a, b) => a - b);
}

function clampMaskX(x: number, rect: Rect): number {
  return Math.min(rect.width, Math.max(0, x));
}

function fillMaskRow(
  mask: Uint8Array,
  width: number,
  y: number,
  startX: number,
  endX: number,
) {
  for (let x = startX; x < endX; x++) {
    mask[y * width + x] = 1;
  }
}
