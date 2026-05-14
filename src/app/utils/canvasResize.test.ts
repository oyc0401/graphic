import { describe, expect, it } from "vitest";
import { resizeCanvasFromHandleDrag } from "./canvasResize";

describe("resizeCanvasFromHandleDrag", () => {
  it("처음 누른 핸들 영역 좌표를 anchor로 삼아 pointer 이동량만큼 캔버스 rect를 변경한다", () => {
    expect(
      resizeCanvasFromHandleDrag({
        startRect: { x: 0, y: 0, width: 5, height: 5 },
        handle: "RB",
        startPointer: { x: 7, y: 7 },
        pointer: { x: 6, y: 6 },
      }),
    ).toEqual({ x: 0, y: 0, width: 4, height: 4 });

    expect(
      resizeCanvasFromHandleDrag({
        startRect: { x: 0, y: 0, width: 5, height: 5 },
        handle: "RB",
        startPointer: { x: 4, y: 7 },
        pointer: { x: 4, y: 6 },
      }),
    ).toEqual({ x: 0, y: 0, width: 5, height: 4 });

    expect(
      resizeCanvasFromHandleDrag({
        startRect: { x: 0, y: 0, width: 5, height: 5 },
        handle: "RB",
        startPointer: { x: 7, y: 2 },
        pointer: { x: 5, y: 6 },
      }),
    ).toEqual({ x: 0, y: 0, width: 3, height: 9 });

    expect(
      resizeCanvasFromHandleDrag({
        startRect: { x: 0, y: 0, width: 5, height: 5 },
        handle: "LT",
        startPointer: { x: -2, y: -2 },
        pointer: { x: -3, y: -3 },
      }),
    ).toEqual({ x: -1, y: -1, width: 6, height: 6 });

    expect(
      resizeCanvasFromHandleDrag({
        startRect: { x: 0, y: 0, width: 5, height: 5 },
        handle: "LB",
        startPointer: { x: -2, y: 7 },
        pointer: { x: -3, y: 8 }, // -1, +1
      }),
    ).toEqual({ x: -1, y: 0, width: 6, height: 6 });

    expect(
      resizeCanvasFromHandleDrag({
        startRect: { x: 0, y: 0, width: 5, height: 5 },
        handle: "RT",
        startPointer: { x: 7, y: -2 },
        pointer: { x: 8, y: -3 }, // +1, -1
      }),
    ).toEqual({ x: 0, y: -1, width: 6, height: 6 });
  });
});
