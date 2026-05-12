import { describe, expect, it } from "vitest";
import { toWebglCoord, toWebglCoord2, toWebglCoord3 } from "./coordinate";

describe("toWebglCoord", () => {
  it("포인터 좌표의 y축을 캔버스 높이 기준으로 뒤집는다", () => {
    expect(toWebglCoord({ x: 12, y: 34 }, 100)).toEqual({ x: 12, y: 66 });
  });

  it("캔버스 위쪽 끝 좌표는 WebGL 아래쪽 끝 좌표가 된다", () => {
    expect(toWebglCoord({ x: 0, y: 0 }, 100)).toEqual({ x: 0, y: 100 });
  });
});

describe("toWebglCoord2", () => {
  it("사각형의 y좌표를 높이까지 고려해 WebGL 좌표계로 변환한다", () => {
    expect(toWebglCoord2(10, 20, 30, 40, 100)).toEqual({ x: 10, y: 40, w: 30, h: 40 });
  });

  it("사각형 아래쪽 끝이 캔버스 아래쪽에 닿으면 y는 0이 된다", () => {
    expect(toWebglCoord2(4, 70, 10, 30, 100)).toEqual({ x: 4, y: 0, w: 10, h: 30 });
  });
});

describe("toWebglCoord3", () => {
  it("카메라 y좌표를 화면 높이와 배율 기준으로 변환한다", () => {
    expect(toWebglCoord3(15, 25, 200, 800, 2)).toEqual({ x: 15, y: 175 });
  });

  it("배율이 1이면 화면 높이 전체를 기준으로 변환한다", () => {
    expect(toWebglCoord3(3, 50, 300, 900, 1)).toEqual({ x: 3, y: 550 });
  });
});
