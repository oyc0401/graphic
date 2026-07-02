import { describe, expect, it } from "vitest";
import {
  clientToScene,
  sceneToClient,
  sceneToContainer,
  sceneLengthToCss,
  cssDeltaToScene,
  sceneRectToContainer,
  zoomAround,
  clampOffset,
  fitDocument,
  type Camera,
  type Viewport,
} from "./cameraMath";

const cam: Camera = { x: 50, y: 30, scale: 2 };
const vp: Viewport = { dpr: 2, rect: { x: 0, y: 100, width: 800, height: 600 } };

describe("cameraMath", () => {
  it("clientToScene: 골든 수치 일치 (to_screen_coord와 동일 공식)", () => {
    expect(clientToScene(410, 340, cam, vp)).toEqual({ x: 360, y: 210 });
  });

  it("sceneToClient ∘ clientToScene = 항등 (왕복)", () => {
    const scene = clientToScene(123.4, 567.8, cam, vp);
    const back = sceneToClient(scene.x, scene.y, cam, vp);
    expect(back.x).toBeCloseTo(123.4, 10);
    expect(back.y).toBeCloseTo(567.8, 10);
  });

  it("sceneToContainer: rect 오프셋 없는 컨테이너 로컬 좌표", () => {
    // (100+50)*2/2 = 150, (80+30)*2/2 = 110
    expect(sceneToContainer(100, 80, cam, vp.dpr)).toEqual({ x: 150, y: 110 });
  });

  it("sceneLengthToCss: 길이 변환", () => {
    expect(sceneLengthToCss(40, 2, 2)).toBe(40); // 40*2/2
    expect(sceneLengthToCss(40, 4, 2)).toBe(80);
  });

  it("cssDeltaToScene: CSS 델타 → scene 델타 (sceneLengthToCss의 역)", () => {
    expect(cssDeltaToScene(40, 2, 2)).toBe(40); // 40*2/2
    expect(cssDeltaToScene(80, 4, 2)).toBe(40);
    expect(sceneLengthToCss(cssDeltaToScene(123.4, 3, 2), 3, 2)).toBeCloseTo(123.4, 10);
  });

  it("sceneRectToContainer: rect 일괄 변환", () => {
    expect(
      sceneRectToContainer({ x: 100, y: 80, width: 40, height: 20 }, cam, vp.dpr),
    ).toEqual({ x: 150, y: 110, width: 40, height: 20 });
  });

  it("zoomAround: 골든 수치 일치 (setMagification과 동일 공식)", () => {
    const next = zoomAround(cam, { x: 100, y: 80 }, 4);
    expect(next).toEqual({ x: -25, y: -25, scale: 4 });
  });

  it("zoomAround: 앵커의 화면좌표 불변", () => {
    const anchor = { x: 100, y: 80 };
    const before = sceneToClient(anchor.x, anchor.y, cam, vp);
    const next = zoomAround(cam, anchor, 3.7);
    const after = sceneToClient(anchor.x, anchor.y, next, vp);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it("clampOffset: 경계 클램프 (골든 수치)", () => {
    const doc = { width: 500, height: 400 };
    const clamped = clampOffset({ x: 1000, y: -999, scale: 2 }, doc, vp);
    expect(clamped).toEqual({ x: 800, y: -400, scale: 2 });
  });

  it("clampOffset: 범위 안 값은 그대로", () => {
    const doc = { width: 500, height: 400 };
    expect(clampOffset(cam, doc, vp)).toEqual(cam);
  });

  it("fitDocument: 골든 수치 일치 (setDefaultPosition과 동일 공식)", () => {
    const { doc, camera } = fitDocument(vp);
    expect(doc).toEqual({ width: 1484, height: 1050 });
    expect(camera).toEqual({ x: 57, y: 75, scale: 1 });
  });
});
