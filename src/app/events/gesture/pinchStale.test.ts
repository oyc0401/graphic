// 회귀 테스트: 외부(휠/돋보기) 줌 이후 핀치 시작 시 stale 카메라로 계산돼
// 화면이 튀던 버그. 핀치는 시작 시점에 getPosition()으로 live 값을 읽어야 한다.
import { describe, expect, it } from "vitest";

// ─── node 환경용 최소 스텁 ───
(globalThis as any).window ??= globalThis;
(globalThis as any).window.addEventListener ??= () => {};
(globalThis as any).window.removeEventListener ??= () => {};
class FakeNode {}
(globalThis as any).Node = FakeNode;
(globalThis as any).PointerEvent = class FakePointerEvent {
  type: string;
  constructor(type: string, init: Record<string, unknown> = {}) {
    this.type = type;
    Object.assign(this, init);
  }
};

const { GestureModule } = await import("./index");

const elementStub = {
  addEventListener: () => {},
  removeEventListener: () => {},
  getBoundingClientRect: () => ({ left: 0, top: 0 }),
  contains: () => true,
} as unknown as HTMLElement;

function fakePointer(pointerId: number, clientX: number, clientY: number) {
  return {
    pointerId,
    clientX,
    clientY,
    pointerType: "touch",
    isPrimary: pointerId === 1,
    target: new FakeNode(),
    bubbles: true,
    cancelable: true,
    composed: true,
    button: 0,
    buttons: 1,
    pressure: 0.5,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    preventDefault: () => {},
    stopImmediatePropagation: () => {},
  } as unknown as PointerEvent;
}

describe("핀치 stale 카메라 회귀", () => {
  it("외부 줌 이후 핀치 첫 이동이 live 카메라 기준으로 계산된다", () => {
    // 설치 시점 카메라: {0,0,1} → 이후 외부 줌으로 {-100,-50,3}로 변경됨
    let live = { x: 0, y: 0, scale: 1 };
    const sceneChangedCalls: Array<{ x: number; y: number; scale: number }> = [];

    const gesture = new GestureModule({
      element: elementStub,
      getPosition: () => ({ ...live }),
      minScale: 0.1,
      maxScale: 10,
      onPointerdown: () => {},
      onPointermove: () => {},
      onPointerup: () => {},
      onPointercancel: () => {},
      sceneChanged: (x, y, scale) => sceneChangedCalls.push({ x, y, scale }),
      onPinchStart: () => {},
      onPinchEnd: () => {},
      onTwoFingerTap: () => {},
      onThreeFingerTap: () => {},
      onTwoFingerDoubleTap: () => {},
      onThreeFingerDoubleTap: () => {},
    });

    // 외부 줌 발생 (휠/돋보기 상당) — gesture 모듈엔 아무 통지 없음
    live = { x: -100, y: -50, scale: 3 };

    const g = gesture as any;
    // 두 손가락 다운 (150ms 이내 → 핀치 진입)
    g.handlePointerdown(fakePointer(1, 0, 0));
    g.handlePointerdown(fakePointer(2, 0, 100));
    // 핀치 이동: p2 (0,100) → (0,120)
    //   center (0,50)→(0,60): dy=+10 / distance 100→120: scaleFactor 1.2
    //   live 기준: nextScale=3.6, y=-50+10=-40
    //   zoomAt(0,60): sceneY=(60+40)/3=100/3 → y'=60-(100/3)*3.6=-60, x'=-120
    //   → sceneChanged(-120, -60, 3.6)
    //   (stale {0,0,1} 기준이었다면 (0, 0, 1.2)로 전혀 다른 값)
    g.handlePointermove(fakePointer(2, 0, 120));

    expect(sceneChangedCalls.length).toBe(1);
    expect(sceneChangedCalls[0].x).toBeCloseTo(-120, 8);
    expect(sceneChangedCalls[0].y).toBeCloseTo(-60, 8);
    expect(sceneChangedCalls[0].scale).toBeCloseTo(3.6, 8);
  });
});
