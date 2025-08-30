import type { Pointer, Tangent } from "../types.js";

const tension = 0; // 0 = Catmull-Rom
const k = (1 - tension) * 0.5;

export function calculateTangents(points: Pointer[]): Tangent[] {
  return points.map((_, i, arr) => {
    if (i === 0 || i === arr.length - 1) return { x: 0, y: 0 };

    return {
      x: k * (arr[i + 1].x - arr[i - 1].x),
      y: k * (arr[i + 1].y - arr[i - 1].y),
    };
  });
}

export function hermite(
  t: number,
  p0: Pointer,
  p1: Pointer,
  v0: Tangent,
  v1: Tangent
): Pointer {
  const t2 = t * t;
  const t3 = t2 * t;
  const h1 = 2 * t3 - 3 * t2 + 1;
  const h2 = -2 * t3 + 3 * t2;
  const h3 = t3 - 2 * t2 + t;
  const h4 = t3 - t2;

  return {
    x: h1 * p0.x + h2 * p1.x + h3 * v0.x + h4 * v1.x,
    y: h1 * p0.y + h2 * p1.y + h3 * v0.y + h4 * v1.y,
  };
}
