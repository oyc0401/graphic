# 카메라/뷰 상태 리팩토링 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 뷰/카메라 변환·줌·클램프 로직을 순수 모듈(`cameraMath`)로 추출해 단일화하고, GestureModule의 stale 카메라 사본을 `getPosition` DI로 대체해 핀치 튐 버그를 해결한다.

**Architecture:** 접근법 A — 순수 코어 + 얇은 observable 래퍼. `position.ts`의 외부 API는 유지하고 내부 계산만 `cameraMath`에 위임. 변환 공식 중복(view.ts/selectionHitTest/shapeHitTest/resizeGeometry)을 `cameraMath` 호출로 통합. GestureModule은 카메라를 소유하지 않고 핀치 시작 시 `getPosition()`으로 live 값을 재조회(양방향 sync 없음).

**Tech Stack:** TypeScript, MobX 6, Vitest 4, Vite 6. 테스트는 node 환경에서 `window`/worker를 스텁.

**Spec:** `docs/superpowers/specs/2026-07-02-camera-view-state-refactor-design.md`

## Global Constraints

- `spec.test.ts` 파일은 절대 수정 금지 (이 계획은 어떤 spec.test.ts도 건드리지 않는다).
- 기존 외부 API 시그니처 유지: `position.x/y/scale/width/height/dpr/bouncingRect`, 모든 세터, `to_screen_coord`, `to_canvas_coord`, `to_pixel_canvas_coord(_round)`, `setMagification`, `setCameraPosition`, `setDefaultPosition`, `changeCanvasSize`, `getPixelRatio`, `MIN_SCALE`, `MAX_SCALE`.
- **사전 고지된 인터페이스 변경(사용자 승인 완료 — 스펙 리뷰에서 "ㄱㄱㄱ")**:
  1. `position.ts`에 추가 export: `setDpr` 세터(직접 대입 `position.dpr = dpr` 대체), `getCamera()`, `getViewport()`.
  2. `position.ts`에서 **미사용 죽은 export 삭제**: `canvas_coord_to_css_coord` (내부 `to_world_coord`, `canvas_coord_to_screen_coord` 포함 — 전체 코드베이스에서 호출 0건, `/dpr` 누락으로 to_screen_coord와 역함수도 아님).
  3. `GestureModuleOptions.position: GesturePosition` → `getPosition: () => GesturePosition`, `GestureModule.setPosition` 메서드 삭제(되먹임 위험 제거).
  4. `src/app/events/gesture/example.ts`(사용자 데모 파일)는 3번 때문에 참조가 깨지는 **두 지점만 최소 수정** (기존 TS2440 에러는 건드리지 않음).
- 각 태스크 종료 시 `pnpm test` 전체 green + 커밋. tsc 에러는 기존 `example.ts` TS2440 1건 외 0 유지.
- 순수 모듈(`cameraMath.ts`)은 window/document/싱글톤/부수효과 접근 금지 — 모든 입력은 인자.
- 좌표 용어: **scene** = 캔버스 픽셀 공간(`position.x/y` 단위), **container** = 컨테이너 로컬 CSS px, **client** = 뷰포트 CSS px(`clientX/Y`).

---

### Task 1: 골든(특성화) 테스트 — 현재 position.ts 동작 고정

리팩토링 전에 현재 공식의 입출력을 테스트로 고정한다. 이 테스트는 **현재 코드에서 바로 통과**해야 하며(특성화), 이후 태스크에서 회귀 감지기 역할을 한다.

**Files:**
- Test(Create): `src/app/position.golden.test.ts`

**Interfaces:**
- Consumes: 기존 `position.ts` export (`position`, `to_screen_coord`, `setMagification`, `setCameraPosition`, `setDefaultPosition`)
- Produces: 없음 (테스트 전용). 이후 모든 태스크가 이 테스트의 green을 전제로 한다.

- [ ] **Step 1: 골든 테스트 작성**

```ts
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
    expect(position.dpr).toBe(2);
  });
});
```

- [ ] **Step 2: 실행 — 현재 코드에서 통과 확인**

Run: `pnpm vitest run src/app/position.golden.test.ts`
Expected: PASS 5/5 (특성화 테스트이므로 현재 코드에서 바로 통과해야 함. 실패 시 기대값이 아니라 **테스트의 수치 계산**을 의심하고 현재 코드 기준으로 정정)

- [ ] **Step 3: 전체 테스트 확인 후 커밋**

Run: `pnpm test`
Expected: 기존 58 + 신규 5 전부 PASS

```bash
git add src/app/position.golden.test.ts
git commit -m "test: position.ts 카메라 공식 골든(특성화) 테스트 추가"
```

---

### Task 2: cameraMath 순수 모듈 (TDD)

**Files:**
- Create: `src/app/camera/cameraMath.ts`
- Test(Create): `src/app/camera/cameraMath.test.ts`

**Interfaces:**
- Consumes: 없음 (순수, 의존성 0)
- Produces (이후 태스크가 사용하는 정확한 시그니처):

```ts
export type Camera = { x: number; y: number; scale: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type Viewport = { dpr: number; rect: Rect };
export type DocSize = { width: number; height: number };

export function clientToScene(clientX: number, clientY: number, cam: Camera, vp: Viewport): { x: number; y: number };
export function sceneToClient(sceneX: number, sceneY: number, cam: Camera, vp: Viewport): { x: number; y: number };
export function sceneToContainer(sceneX: number, sceneY: number, cam: Camera, dpr: number): { x: number; y: number };
export function sceneLengthToCss(length: number, cam: Camera, dpr: number): number;
export function sceneRectToContainer(rect: Rect, cam: Camera, dpr: number): Rect;
export function zoomAround(cam: Camera, anchorScene: { x: number; y: number }, nextScale: number): Camera;
export function clampOffset(cam: Camera, doc: DocSize, vp: Viewport): Camera;
export function fitDocument(vp: Viewport, percent?: number, ratio?: number): { doc: DocSize; camera: Camera };
```

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/app/camera/cameraMath.test.ts
import { describe, expect, it } from "vitest";
import {
  clientToScene,
  sceneToClient,
  sceneToContainer,
  sceneLengthToCss,
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
    expect(sceneLengthToCss(40, cam, vp.dpr)).toBe(40); // 40*2/2
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
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `pnpm vitest run src/app/camera/cameraMath.test.ts`
Expected: FAIL — "Cannot find module './cameraMath'"

- [ ] **Step 3: 구현**

```ts
// src/app/camera/cameraMath.ts
// 뷰/카메라 좌표 변환·줌·클램프의 단일 원천.
// 순수 모듈: DOM/싱글톤/부수효과 없음 — 모든 입력은 인자로 받는다.
//
// 좌표 용어:
//   scene     = 캔버스 픽셀 공간 (Camera.x/y의 단위)
//   container = 컨테이너 로컬 CSS px (오버레이 배치용)
//   client    = 뷰포트 CSS px (PointerEvent.clientX/Y)

export type Camera = { x: number; y: number; scale: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type Viewport = { dpr: number; rect: Rect };
export type DocSize = { width: number; height: number };

export function clientToScene(
  clientX: number,
  clientY: number,
  cam: Camera,
  vp: Viewport,
): { x: number; y: number } {
  return {
    x: ((clientX - vp.rect.x) / cam.scale) * vp.dpr - cam.x,
    y: ((clientY - vp.rect.y) / cam.scale) * vp.dpr - cam.y,
  };
}

export function sceneToClient(
  sceneX: number,
  sceneY: number,
  cam: Camera,
  vp: Viewport,
): { x: number; y: number } {
  return {
    x: ((sceneX + cam.x) * cam.scale) / vp.dpr + vp.rect.x,
    y: ((sceneY + cam.y) * cam.scale) / vp.dpr + vp.rect.y,
  };
}

export function sceneToContainer(
  sceneX: number,
  sceneY: number,
  cam: Camera,
  dpr: number,
): { x: number; y: number } {
  return {
    x: ((sceneX + cam.x) * cam.scale) / dpr,
    y: ((sceneY + cam.y) * cam.scale) / dpr,
  };
}

export function sceneLengthToCss(length: number, cam: Camera, dpr: number): number {
  return (length * cam.scale) / dpr;
}

export function sceneRectToContainer(rect: Rect, cam: Camera, dpr: number): Rect {
  const p = sceneToContainer(rect.x, rect.y, cam, dpr);
  return {
    x: p.x,
    y: p.y,
    width: sceneLengthToCss(rect.width, cam, dpr),
    height: sceneLengthToCss(rect.height, cam, dpr),
  };
}

// 앵커(scene 좌표)가 화면상 같은 자리에 머물도록 스케일 변경.
//   (anchor + oldPos) * oldScale == (anchor + newPos) * newScale
export function zoomAround(
  cam: Camera,
  anchorScene: { x: number; y: number },
  nextScale: number,
): Camera {
  return {
    scale: nextScale,
    x: ((anchorScene.x + cam.x) * cam.scale) / nextScale - anchorScene.x,
    y: ((anchorScene.y + cam.y) * cam.scale) / nextScale - anchorScene.y,
  };
}

// 카메라 오프셋을 문서가 화면에서 완전히 사라지지 않는 범위로 클램프.
export function clampOffset(cam: Camera, doc: DocSize, vp: Viewport): Camera {
  const screenWidth = vp.rect.width * vp.dpr;
  const screenHeight = vp.rect.height * vp.dpr;
  return {
    scale: cam.scale,
    x: Math.min(screenWidth / cam.scale, Math.max(-doc.width, cam.x)),
    y: Math.min(screenHeight / cam.scale, Math.max(-doc.height, cam.y)),
  };
}

// 화면의 percent 비율 안에 ratio(기본 √2) 종횡비 문서를 중앙 배치.
export function fitDocument(
  vp: Viewport,
  percent = 7 / 8,
  ratio = Math.SQRT2,
): { doc: DocSize; camera: Camera } {
  const W = vp.rect.width * vp.dpr;
  const H = vp.rect.height * vp.dpr;
  let width: number;
  let height: number;

  if (W >= H) {
    height = H * percent;
    width = height * ratio;
    if (width > W) {
      width = W * percent;
      height = width / ratio;
    }
  } else {
    width = W * percent;
    height = width * ratio;
    if (height > H) {
      height = H * percent;
      width = height / ratio;
    }
  }

  return {
    doc: { width: Math.floor(width), height: Math.floor(height) },
    camera: {
      x: Math.floor((W - width) / 2),
      y: Math.floor((H - height) / 2),
      scale: 1,
    },
  };
}
```

- [ ] **Step 4: 실행 — 통과 확인**

Run: `pnpm vitest run src/app/camera/cameraMath.test.ts`
Expected: PASS 10/10

- [ ] **Step 5: 커밋**

```bash
git add src/app/camera/cameraMath.ts src/app/camera/cameraMath.test.ts
git commit -m "feat: cameraMath 순수 모듈 추가 (변환·줌·클램프 단일 원천)"
```

---

### Task 3: position.ts를 cameraMath에 위임

외부 API는 그대로, 내부 계산만 위임. 골든 테스트가 계속 green이어야 한다.

**Files:**
- Modify: `src/app/position.ts`

**Interfaces:**
- Consumes: Task 2의 `cameraMath` 전체
- Produces (신규 export — Task 4·5가 사용):
  - `getCamera(): Camera` — `{ x: position.x, y: position.y, scale: position.scale }`
  - `getViewport(): Viewport` — `{ dpr: getPixelRatio(), rect: position.bouncingRect }`
  - `PositionState.setDpr(dpr: number): void`
- 삭제: `canvas_coord_to_css_coord` export (+ 내부 `to_world_coord`, `canvas_coord_to_screen_coord`) — 전 코드베이스 호출 0건 확인됨

- [ ] **Step 1: import 추가 및 신규 export 작성**

`position.ts` 상단 import에 추가:

```ts
import {
  clampOffset,
  clientToScene,
  fitDocument,
  zoomAround,
  type Camera,
  type Viewport,
} from "./camera/cameraMath";
```

`PositionState` 클래스에 세터 추가 (`setScale` 아래):

```ts
  setDpr(dpr: number) {
    this.dpr = dpr;
  }
```

`export const position = new PositionState();` 아래에 추가:

```ts
// cameraMath에 넘길 현재 카메라/뷰포트 스냅샷 (DI 경계)
export function getCamera(): Camera {
  return { x: position.x, y: position.y, scale: position.scale };
}

export function getViewport(): Viewport {
  return { dpr: getPixelRatio(), rect: position.bouncingRect };
}
```

- [ ] **Step 2: 함수 본문 위임으로 교체**

`setCameraPosition` (기존 73-87행) — 클램프를 `clampOffset`으로:

```ts
export async function setCameraPosition() {
  const clamped = clampOffset(
    getCamera(),
    { width: position.width, height: position.height },
    getViewport(),
  );
  position.setX(clamped.x);
  position.setY(clamped.y);

  const worker = getLayerWorker();
  await worker.setCameraPosition(position.x, position.y, position.scale);
}
```

`setDefaultPosition` (기존 104-155행) — 맞춤 계산을 `fitDocument`로:

```ts
export function setDefaultPosition() {
  updateBouncingRect();

  const dpr = getPixelRatio();
  position.setDpr(dpr);
  MAX_SCALE = 120 * dpr;

  const { doc, camera } = fitDocument(getViewport());
  position.setScale(camera.scale);
  position.setWidth(doc.width);
  position.setHeight(doc.height);
  position.setX(camera.x);
  position.setY(camera.y);
}
```

`setMagification` (기존 157-179행) — `zoomAround`로:

```ts
export function setMagification(new_scale, anchor_point) {
  const next = zoomAround(getCamera(), anchor_point, new_scale);
  position.setScale(next.scale);
  position.setX(next.x);
  position.setY(next.y);
}
```

`to_screen_coord` (기존 209-213행) — `clientToScene`으로:

```ts
export function to_screen_coord(x, y) {
  return clientToScene(x, y, getCamera(), getViewport());
}
```

죽은 코드 삭제 (기존 190-206행): `to_world_coord`, `canvas_coord_to_screen_coord`, `canvas_coord_to_css_coord` 세 함수 전체 제거.

- [ ] **Step 3: 실행 — 골든 포함 전체 green 확인**

Run: `pnpm test && npx tsc --noEmit`
Expected: 골든 5개 포함 전체 PASS. tsc는 기존 example.ts TS2440 1건만.

- [ ] **Step 4: 커밋**

```bash
git add src/app/position.ts
git commit -m "refactor: position.ts 카메라 계산을 cameraMath로 위임 (외부 API 유지)"
```

---

### Task 4: 변환 공식 중복 제거 (view.ts / hit-test / resizeGeometry)

hit-test는 리팩토링 **전에** 특성화 테스트부터 작성한다.

**Files:**
- Test(Create): `src/app/utils/hitTest.test.ts`
- Modify: `src/app/utils/selectionHitTest.ts`, `src/app/utils/shapeHitTest.ts`, `src/app/utils/resizeGeometry.ts`, `src/app/ui/view.ts`

**Interfaces:**
- Consumes: `cameraMath.sceneToContainer/sceneLengthToCss/sceneRectToContainer`, `position.getCamera/getViewport/getPixelRatio`
- Produces: 없음 (기존 함수 시그니처 전부 유지: `getSelectionHandleAtPoint`, `getShapeHandleAtPoint`, `hitTestOutsideCanvasResizeCorner`, `toContainerRect` 등)

- [ ] **Step 1: hit-test 특성화 테스트 작성**

```ts
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
```

- [ ] **Step 2: 실행 — 현재 코드에서 통과 확인**

Run: `pnpm vitest run src/app/utils/hitTest.test.ts`
Expected: PASS 13/13 (특성화 — 실패 시 테스트 수치를 현재 코드 기준으로 정정)

- [ ] **Step 3: 커밋 (테스트 먼저)**

```bash
git add src/app/utils/hitTest.test.ts
git commit -m "test: selection/shape 히트테스트 특성화 테스트 추가"
```

- [ ] **Step 4: selectionHitTest.ts 인라인 공식 교체**

import 교체 및 `toScreen`/`w`/`h` 계산부(기존 29-43행)를:

```ts
import { getCamera, getPixelRatio, position } from "../position";
import { sceneLengthToCss, sceneToContainer } from "../camera/cameraMath";
```

```ts
  const cam = getCamera();
  const dpr = getPixelRatio();

  /** ───── ① canvas 좌표 → 화면 좌표 변환 */
  // X는 컨테이너 로컬 그대로, Y만 컨테이너 상단(AppBar) 오프셋 보정 — 기존 동작 유지
  const toScreen = (canvasX: number, canvasY: number) => {
    const p = sceneToContainer(canvasX, canvasY, cam, dpr);
    return {
      x: p.x,
      y: p.y + position.bouncingRect.y - position.bottomNavHeight,
    };
  };

  const { x: cX, y: cY, width: cW, height: cH } = selRect;
  const p = toScreen(cX, cY);
  const w = sceneLengthToCss(cW, cam, dpr);
  const h = sceneLengthToCss(cH, cam, dpr);
```

나머지(핸들 사각형 계산 이하)는 무변경.

- [ ] **Step 5: shapeHitTest.ts 인라인 공식 교체**

import 교체:

```ts
import { getCamera, getPixelRatio, position } from "../position";
import { sceneLengthToCss, sceneToContainer } from "../camera/cameraMath";
```

`toScreen`/`w`/`h` 계산부(기존 21-33행)를:

```ts
  const cam = getCamera();
  const dpr = getPixelRatio();

  // X는 컨테이너 로컬 그대로, Y만 컨테이너 상단(AppBar) 오프셋 보정 — 기존 동작 유지
  const toScreen = (canvasX: number, canvasY: number) => {
    const p = sceneToContainer(canvasX, canvasY, cam, dpr);
    return {
      x: p.x,
      y: p.y + position.bouncingRect.y - position.bottomNavHeight,
    };
  };

  const p = toScreen(rect.x, rect.y);
  const w = sceneLengthToCss(rect.width, cam, dpr);
  const h = sceneLengthToCss(rect.height, cam, dpr);
```

나머지(핸들 사각형 계산 이하)는 무변경.

- [ ] **Step 6: resizeGeometry.ts 교체**

import 추가:

```ts
import { getCamera, getPixelRatio, position, to_canvas_coord } from "../position";
import { sceneRectToContainer, sceneToContainer } from "../camera/cameraMath";
```

`hitTestOutsideCanvasResizeCorner`의 left/top/width/height 계산(기존 35-44행):

```ts
  const origin = sceneToContainer(0, 0, getCamera(), getPixelRatio());
  const size = sceneRectToContainer(
    { x: 0, y: 0, width: position.width, height: position.height },
    getCamera(),
    getPixelRatio(),
  );
  const left = origin.x;
  const top = origin.y + position.bouncingRect.y - position.bottomNavHeight;
  const width = size.width;
  const height = size.height;
  const right = left + width;
  const bottom = top + height;
```

`toContainerRect`(기존 106-115행):

```ts
export function toContainerRect(rect: CanvasRect): CanvasRect {
  return sceneRectToContainer(rect, getCamera(), getPixelRatio());
}
```

- [ ] **Step 7: view.ts 인라인 공식 교체**

import 추가:

```ts
import { getCamera, getPixelRatio, position, to_canvas_coord } from "../position";
import { sceneLengthToCss, sceneRectToContainer, sceneToContainer } from "../camera/cameraMath";
```

교체 지점 (전부 동일 패턴 — 대표 예시):

- 131행 `const scaled = (brushSize * position.scale) / dpr;`
  → `const scaled = sceneLengthToCss(brushSize, getCamera(), dpr);`
- 155행 동일 패턴 (`sceneLengthToCss(paintState.getBrushSize(), getCamera(), getPixelRatio())`)
- 196-197행 점 변환:
  ```ts
  const p = sceneToContainer(point.x, point.y, getCamera(), dpr);
  const x = p.x;
  const y = p.y;
  ```
- 217-220행 / 253-256행 / 308-311행 / 343-346행 rect 변환 4곳:
  ```ts
  const s = sceneRectToContainer(rect, getCamera(), dpr);
  // 이후 sLeft→s.x, sTop→s.y, sWidth→s.width, sHeight→s.height 로 치환
  ```

- [ ] **Step 8: 실행 — 전체 green 확인**

Run: `pnpm test && npx tsc --noEmit`
Expected: 특성화 13개 + 골든 5개 포함 전체 PASS. tsc 기존 1건만.

- [ ] **Step 9: 커밋**

```bash
git add src/app/utils/selectionHitTest.ts src/app/utils/shapeHitTest.ts src/app/utils/resizeGeometry.ts src/app/ui/view.ts
git commit -m "refactor: scene→screen 변환 중복 4곳을 cameraMath로 통합"
```

---

### Task 5: 핀치 튐 수정 — GestureModule getPosition DI (TDD)

**Files:**
- Test(Create): `src/app/events/gesture/pinchStale.test.ts`
- Modify: `src/app/events/gesture/index.ts`, `src/app/events/gestureAdapter.ts`, `src/app/events/gesture/example.ts`(최소 2지점)

**Interfaces:**
- Consumes: 없음 (gesture는 자족 모듈; adapter가 `position` 싱글톤과 연결)
- Produces:
  - `GestureModuleOptions`: `position: GesturePosition` 필드 **제거**, `getPosition: () => GesturePosition` **추가**
  - `GestureModule.setPosition` 메서드 **제거**
  - `installGestureAdapter(element)` 시그니처 유지

- [ ] **Step 1: 실패하는 회귀 테스트 작성**

핀치 시나리오: 외부 줌으로 카메라가 바뀐 뒤 핀치 시작 → 첫 핀치 이동의 `sceneChanged`가 **바뀐 카메라를 기준**으로 계산돼야 한다(수치는 손계산 — 스텝 주석 참고).

```ts
// src/app/events/gesture/pinchStale.test.ts
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
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `pnpm vitest run src/app/events/gesture/pinchStale.test.ts`
Expected: FAIL — 옵션에 `getPosition` 없음(타입/런타임) 또는 stale 값 `(0, 0, 1.2)` 계산으로 assertion 실패

- [ ] **Step 3: GestureModule 수정**

`src/app/events/gesture/index.ts`:

1. `GestureModuleOptions`(7-23행): `position: GesturePosition;` → `getPosition: () => GesturePosition;`
2. 생성자(67행): `this.position = { ...options.position };` → `this.position = { ...options.getPosition() };`
3. `setPosition` 메서드(80-87행) **전체 삭제**.
4. `startPinch`(364-370행) 첫 줄에 live 재조회 추가:

```ts
  private startPinch(firstPointer: TrackedPointer, secondPointer: TrackedPointer) {
    // 핀치 세션의 기준 카메라는 시작 시점의 live 값이다.
    // (휠/돋보기 등 외부 변경 후에도 stale 사본으로 튀지 않도록)
    this.position = { ...this.options.getPosition() };
    this.blockedPointerIds.add(firstPointer.pointerId);
    this.blockedPointerIds.add(secondPointer.pointerId);
    this.lastPinchCenter = this.averagePointers(firstPointer, secondPointer);
    this.lastPinchDistance = this.getDistance(firstPointer, secondPointer);
    this.options.onPinchStart();
  }
```

- [ ] **Step 4: gestureAdapter.ts 수정**

기존 14-27행(mutable 지역 `gestureX/Y/Scale` + `position:` 옵션)을 `getPosition` 콜백으로 교체. `sceneChanged`의 지역변수 갱신(44-46행)도 삭제:

```ts
export function installGestureAdapter(element: HTMLElement) {
  const pixelRatio = getPixelRatio();

  // app 카메라(scene px, dpr 배율) → gesture 좌표계(컨테이너 CSS px) 변환.
  // gesture 공간: local = scene * gScale + gXY, gScale = scale/dpr
  const toGesturePosition = () => {
    const gestureScale = position.scale / pixelRatio;
    return {
      x: position.x * gestureScale,
      y: position.y * gestureScale,
      scale: gestureScale,
    };
  };

  return new GestureModule({
    element,
    getPosition: toGesturePosition,
    minScale: MIN_SCALE / pixelRatio,
    maxScale: MAX_SCALE / pixelRatio,
    onPointerdown: (event) => {
      paintState.setPointerdown(true);
      dispatchPointer(event, "down");
    },
    onPointermove: (event) => {
      dispatchPointer(event, "move");
    },
    onPointerup: (event) => {
      paintState.setPointerdown(false);
      dispatchPointer(event, "up");
    },
    onPointercancel: (event) => {
      paintState.setPointerdown(false);
      dispatchPointer(event, "cancel");
    },
    sceneChanged: (x, y, scale) => {
      position.setX(x / scale);
      position.setY(y / scale);
      position.setScale(scale * pixelRatio);
      renderChangedPosition();
    },
    onPinchStart: () => {
      paintState.setPointerdown(false);
      paintState.setShowBrushCursor(false);
      paintState.setInputMode(InputMode.Pinch);
    },
    onPinchEnd: () => {
      if (paintState.getInputMode() === InputMode.Pinch) {
        paintState.setInputMode(InputMode.DEFAULT);
      }
    },
    onTwoFingerTap: () => {
      undo();
    },
    onThreeFingerTap: () => {
      redo();
    },
    onTwoFingerDoubleTap: () => {},
    onThreeFingerDoubleTap: () => {},
  });
}
```

- [ ] **Step 5: example.ts 데모 최소 수정 (사용자 파일 — 사전 고지된 2지점만)**

`src/app/events/gesture/example.ts`에서 깨지는 참조만:
1. `new GestureModule({ ... position: {...} ... })` → `getPosition: () => ({...})` (기존 객체 리터럴을 화살표 함수로 감싸기)
2. `.setPosition(` 호출 줄 → 삭제 (해당 데모 기능은 제거된 API)

그 외(기존 TS2440 import 충돌 포함) 일절 무변경.

- [ ] **Step 6: 실행 — 회귀 테스트 통과 + 전체 green**

Run: `pnpm vitest run src/app/events/gesture/pinchStale.test.ts && pnpm test && npx tsc --noEmit`
Expected: 회귀 테스트 PASS, 전체 PASS, tsc 기존 example.ts TS2440 1건만

- [ ] **Step 7: 커밋**

```bash
git add src/app/events/gesture/index.ts src/app/events/gestureAdapter.ts src/app/events/gesture/example.ts src/app/events/gesture/pinchStale.test.ts
git commit -m "fix: 핀치 시작 시 live 카메라 재조회(getPosition DI)로 핀치 튐 해결"
```

---

### Task 6: 최종 검증

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 테스트 + 타입체크**

Run: `pnpm test && npx tsc --noEmit`
Expected: 테스트 전부 PASS (기존 58 + 신규 약 29). tsc는 example.ts TS2440 1건만.

- [ ] **Step 2: 수동 검증 (dev 서버)**

Run: `pnpm dev` 후 브라우저에서:
1. 휠(ctrl+휠)로 확대 → **두 손가락 핀치 시작 → 첫 움직임에 화면이 튀지 않음** (버그 재현 시나리오)
2. 돋보기 탭줌 → 핀치 → 튐 없음
3. 팬 → 핀치 → 튐 없음, 캔버스 리사이즈 핸들 드래그 후 핀치 → 튐 없음
4. 선택 영역 생성·이동·리사이즈 핸들 히트가 이전과 동일
5. 도형 생성·핸들 조작 동일, 브러시 커서 크기 표시 동일
6. undo/redo 후 화면 위치 복원 동일

- [ ] **Step 3: 스펙 대비 완료 확인 후 필요 시 잔여 정리 커밋**

```bash
git status  # 잔여 변경 없어야 함
```
