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
});
