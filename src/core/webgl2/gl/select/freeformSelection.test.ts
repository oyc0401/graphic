import { describe, expect, it } from "vitest";
import {
  createFreeformSelectionMask,
  getFreeformSelectionRect,
} from "./freeformSelection";

describe("freeform selection", () => {
  it("calculates an inclusive bounding rect", () => {
    const rect = getFreeformSelectionRect([
      { x: 2, y: 3 },
      { x: 6, y: 3 },
      { x: 6, y: 8 },
      { x: 2, y: 8 },
    ]);

    expect(rect?.x).toBe(2);
    expect(rect?.y).toBe(3);
    expect(rect?.width).toBe(5);
    expect(rect?.height).toBe(6);
  });

  it("fills the polygon interior with even-odd rule", () => {
    const points = [
      { x: 1, y: 1 },
      { x: 5, y: 1 },
      { x: 5, y: 5 },
      { x: 1, y: 5 },
    ];
    const rect = getFreeformSelectionRect(points)!;
    const mask = createFreeformSelectionMask(points, rect);

    expect(mask[(2 - rect.y) * rect.width + (2 - rect.x)]).toBe(1);
    expect(mask[(5 - rect.y) * rect.width + (5 - rect.x)]).toBe(0);
  });

  it("supports self-intersecting paths", () => {
    const points = [
      { x: 1, y: 1 },
      { x: 5, y: 5 },
      { x: 1, y: 5 },
      { x: 5, y: 1 },
    ];
    const rect = getFreeformSelectionRect(points)!;
    const mask = createFreeformSelectionMask(points, rect);

    const selectedPixels = mask.reduce((total, value) => total + value, 0);
    expect(selectedPixels).toBeGreaterThan(0);
    expect(selectedPixels).toBeLessThan(rect.width * rect.height);
  });

  it("matches the naive per-pixel even-odd result", () => {
    const cases = [
      [
        { x: 1, y: 1 },
        { x: 7, y: 2 },
        { x: 6, y: 7 },
        { x: 2, y: 6 },
      ],
      [
        { x: 1, y: 1 },
        { x: 7, y: 7 },
        { x: 1, y: 7 },
        { x: 7, y: 1 },
      ],
      [
        { x: 2.5, y: 1 },
        { x: 8, y: 4.5 },
        { x: 5, y: 8 },
        { x: 1, y: 5 },
      ],
    ];

    for (const points of cases) {
      const rect = getFreeformSelectionRect(points)!;
      expect([...createFreeformSelectionMask(points, rect)]).toEqual([
        ...createNaiveMask(points, rect),
      ]);
    }
  });
});

function createNaiveMask(
  points: { x: number; y: number }[],
  rect: { x: number; y: number; width: number; height: number },
): Uint8Array {
  const mask = new Uint8Array(rect.width * rect.height);

  for (let y = 0; y < rect.height; y++) {
    for (let x = 0; x < rect.width; x++) {
      if (isPointInPolygonEvenOdd(rect.x + x + 0.5, rect.y + y + 0.5, points)) {
        mask[y * rect.width + x] = 1;
      }
    }
  }

  return mask;
}

function isPointInPolygonEvenOdd(
  x: number,
  y: number,
  points: { x: number; y: number }[],
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
