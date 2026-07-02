// src/app/position.golden.test.ts
// 리팩토링 회귀 방지용 특성화 테스트.
// 현재 position.ts 공식의 입출력을 수치로 고정한다 (dpr=2 기준).
import { describe, expect, it, vi } from "vitest";

vi.mock("./ui/elements", () => ({
  els: {
    container: {
      getBoundingClientRect: () => ({ x: 0, y: 0, width: 800, height: 600 }),
    },
  },
  getElements: () => ({}),
}));

vi.mock("./worker/workerPool", () => ({
  getLayerWorker: () => ({
    setCameraPosition: async () => {},
    resizeScreenSize: async () => {},
    render: () => {},
    resizeLayer: () => {},
  }),
}));

(globalThis as any).window = { devicePixelRatio: 2 };

const {
  position,
  to_screen_coord,
  setMagification,
  setCameraPosition,
  setDefaultPosition,
} = await import("./position");

function setupCamera() {
  position.setBouncingRect({ x: 0, y: 100, width: 800, height: 600 });
  position.setScale(2);
  position.setX(50);
  position.setY(30);
  position.setSize(500, 400);
}

describe("position.ts 골든 (dpr=2)", () => {
  it("to_screen_coord: client → scene", () => {
    setupCamera();
    // px = ((410-0)/2)*2 - 50 = 360, py = ((340-100)/2)*2 - 30 = 210
    expect(to_screen_coord(410, 340)).toEqual({ x: 360, y: 210 });
  });

  it("setMagification: 앵커 고정 줌", () => {
    setupCamera();
    setMagification(4, { x: 100, y: 80 });
    // newX = ((100+50)*2)/4 - 100 = -25, newY = ((80+30)*2)/4 - 80 = -25
    expect(position.scale).toBe(4);
    expect(position.x).toBe(-25);
    expect(position.y).toBe(-25);
  });

  it("setMagification: 앵커의 화면좌표가 줌 전후 동일", () => {
    setupCamera();
    const anchor = { x: 100, y: 80 };
    const before = ((anchor.x + position.x) * position.scale) / 2;
    setMagification(4, anchor);
    const after = ((anchor.x + position.x) * position.scale) / 2;
    expect(after).toBeCloseTo(before, 10);
  });

  it("setCameraPosition: 오프셋 클램프", async () => {
    setupCamera();
    // maxW = screenWidth/scale = 1600/2 = 800, minW = -width = -500
    position.setX(1000);
    position.setY(-999);
    await setCameraPosition();
    expect(position.x).toBe(800);
    expect(position.y).toBe(-400);
  });

  it("setDefaultPosition: 초기 문서 맞춤 (W>=H, √2 비율)", () => {
    setDefaultPosition();
    // H*7/8 = 1050, width = 1050*√2 = 1484.924… → floor
    expect(position.scale).toBe(1);
    expect(position.width).toBe(1484);
    expect(position.height).toBe(1050);
    expect(position.x).toBe(57); // (1600-1484.924…)/2 = 57.537… → floor
    expect(position.y).toBe(75); // (1200-1050)/2
  });
});
