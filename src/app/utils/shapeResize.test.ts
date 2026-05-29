import { describe, expect, it } from "vitest";
import { resizeShapeFromHandle } from "./shapeResize";

describe("resizeShapeFromHandle", () => {
  it("RB 핸들은 포인터가 위치한 칸까지 도형을 늘린다", () => {
    expect(
      resizeShapeFromHandle({
        startRect: { x: 2, y: 2, width: 5, height: 5 },
        handle: "RB",
        pointer: { x: 8, y: 9 },
        keepRatio: false,
      }),
    ).toEqual({ x: 2, y: 2, width: 7, height: 8 });
  });

  it("INSIDE 이동은 도형 리사이즈 유틸을 거치지 않으므로 L 핸들은 오른쪽 anchor 기준으로 폭만 바꾼다", () => {
    expect(
      resizeShapeFromHandle({
        startRect: { x: 2, y: 2, width: 5, height: 5 },
        handle: "L",
        pointer: { x: 0, y: 4 },
        keepRatio: false,
      }),
    ).toEqual({ x: 0, y: 2, width: 7, height: 5 });
  });

  it("keepRatio=true이면 시작 도형 비율을 유지한다", () => {
    expect(
      resizeShapeFromHandle({
        startRect: { x: 2, y: 2, width: 6, height: 3 },
        handle: "RB",
        pointer: { x: 9, y: 3 },
        keepRatio: true,
      }),
    ).toEqual({ x: 2, y: 2, width: 8, height: 4 });
  });
});
