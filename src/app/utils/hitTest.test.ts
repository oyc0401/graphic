// src/app/utils/hitTest.test.ts
// selection/shape 핸들 히트테스트 특성화 테스트 (dpr=2, 리팩토링 회귀 방지)
import { describe, expect, it, vi } from "vitest";

vi.mock("../ui/elements", () => ({ els: {}, getElements: () => ({}) }));
vi.mock("../worker/workerPool", () => ({ getLayerWorker: () => ({}) }));

(globalThis as any).window = { devicePixelRatio: 2 };

const { position } = await import("../position");
const { getSelectionHandleAtPoint } = await import("./selectionHitTest");
const { getShapeHandleAtPoint } = await import("./shapeHitTest");

function setupCamera() {
  position.setBouncingRect({ x: 0, y: 100, width: 800, height: 600 });
  position.setScale(2);
  position.setX(50);
  position.setY(30);
}

// selRect(scene) {x:100,y:80,w:200,h:100} → 화면(client):
//   left=(100+50)*2/2=150, top=(80+30)*2/2+100=210, w=200, h=100
//   → right=350, bottom=310
const rect = { x: 100, y: 80, width: 200, height: 100 };

describe("selection/shape 핸들 히트테스트 (특성화)", () => {
  it.each([
    [150, 210, "LT"],
    [350, 210, "RT"],
    [350, 310, "RB"],
    [150, 310, "LB"],
    [250, 210, "T"],
    [350, 260, "R"],
    [250, 310, "B"],
    [150, 260, "L"],
    [250, 260, "INSIDE"],
    [500, 500, "OUTSIDE"],
  ] as const)("selection: (%i, %i) → %s", (cx, cy, expected) => {
    setupCamera();
    expect(getSelectionHandleAtPoint(cx, cy, rect)).toBe(expected);
  });

  it.each([
    [150, 210, "LT"],
    [250, 260, "INSIDE"],
    [500, 500, "OUTSIDE"],
  ] as const)("shape: (%i, %i) → %s", (cx, cy, expected) => {
    setupCamera();
    expect(getShapeHandleAtPoint(cx, cy, rect)).toBe(expected);
  });
});
