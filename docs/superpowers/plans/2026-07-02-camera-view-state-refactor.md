# 카메라/뷰 상태 리팩토링 구현 계획 (v2 — 코드 재검증 후 재설계)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 뷰/카메라 변환·줌·클램프 로직을 순수 모듈(`cameraMath`)로 추출해 단일화하고, 앱 전역에 흩어진 변환 수식 중복을 통합한다.

**Architecture:** 접근법 A — 순수 코어 + 얇은 observable 래퍼. `position.ts`의 외부 API는 유지하고 내부 계산만 `cameraMath`에 위임. 변환 공식 중복(view.ts / selectionHitTest / shapeHitTest / resizeGeometry의 scene→screen 4곳 + PanTool / wheelEvent / ZoomTool / main.tsx의 CSS델타→scene 4곳)을 `cameraMath` 호출로 통합.

**Tech Stack:** TypeScript, MobX 6, Vitest 4(node 환경, `vi.mock` 필수 — 아래 참고), Vite 6.

**Spec:** `docs/superpowers/specs/2026-07-02-camera-view-state-refactor-design.md`

## v1 → v2 변경 근거 (전부 직접 코드로 재검증함)

1. **구 Task 5(핀치 튐)는 이미 완료** — 커밋 `309df9c` (`getPosition` DI + `setPosition` 제거 + `pinchStale.test.ts`). 이 계획에서 제외.
2. **경로 변경**: `src/app/camera/cameraMath.ts` → `src/app/utils/cameraMath.ts`. 기존 컨벤션(순수 기하 유틸 `selectionResize`/`shapeResize`/`canvasResize` + 테스트가 전부 `utils/`)과 일치시킴.
3. **신규 함수 `cssDeltaToScene` 추가**: `delta * dpr / scale` 패턴이 4곳에 반복됨을 스윕으로 확인 — `PanTool.ts:36-40`, `wheelEvent.ts:50-54`, `ZoomTool.ts:92-93`(`(x/dpr - dx/scale)*dpr` = 동일식), `main.tsx:121-122`.
4. **`setDpr` 세터 계획 폐기 → `dpr` 필드 삭제 제안**: `position.dpr`은 쓰기 1곳(`position.ts:136`), **읽기 0곳**인 죽은 관측 필드로 확인됨 (`screenWidth/Height` getter는 `getPixelRatio()` 모듈 캐시를 사용). ⚠️ **state 스토어 선언 삭제 — 이 계획 승인으로 사용자 고지·승인 처리.**
5. **골든 테스트의 `vi.mock`은 필수임을 확인**: `elements.ts:14`이 `export let els = elements()`로 **모듈 로드 즉시** `document.getElementById` ~30회 실행 + 실패 시 throw. node 환경에서 mock 없이는 import 자체가 불가.
6. **오보 정리**: `PanTool.ts:39`의 dpr 누락 의심은 오판(36-37행에서 이미 `* getPixelRatio()` 적용, 휠팬과 일관됨). `to_world_coord`/`canvas_coord_to_css_coord`는 호출 0건 재확인(삭제 유지). `changeCanvasTransform`(main.tsx:158)은 카메라 수식이 아닌 단일 CSS 스케일 — 비대상.
7. **비범위 메모**: `view.ts`의 `positionHandles`(207-232 ≡ 298-323 바이트 동일 중복)는 오버레이 구조 리팩토링(별도 작업) 몫 — 이번엔 변환식만 교체. `history.ts:44`의 `screenHeight/scale - height - y`는 코어 GL Y-flip(`toWebglCoord3`)의 역변환으로 코어 좌표 규약과 엮여 있어 이번 범위에서 제외.

## Global Constraints

- `spec.test.ts` 파일은 절대 수정 금지 (이 계획은 어떤 spec.test.ts도 건드리지 않는다).
- 기존 외부 API 시그니처 유지: `position.x/y/scale/width/height/bouncingRect`, 모든 세터, `to_screen_coord`, `to_canvas_coord`, `to_pixel_canvas_coord(_round)`, `setMagification`, `setCameraPosition`, `setDefaultPosition`, `changeCanvasSize`, `getPixelRatio`, `MIN_SCALE`, `MAX_SCALE`.
- **사전 고지된 인터페이스 변경 (이 계획 승인 = 사용자 승인)**:
  1. `position.ts` 신규 export: `getCamera()`, `getViewport()`.
  2. `position.ts` 죽은 export 삭제: `canvas_coord_to_css_coord` (+ 내부 `to_world_coord`, `canvas_coord_to_screen_coord`) — 호출 0건, `/dpr` 누락으로 역함수도 아님.
  3. `PositionState.dpr` 필드 삭제 — 죽은 상태(쓰기 1·읽기 0).
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

주의: `vi.mock("./ui/elements", ...)`는 필수다 — 실제 elements.ts는 import 즉시 `document.getElementById`를 실행해 node 환경에서 throw한다.

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
  });
});
```

- [ ] **Step 2: 실행 — 현재 코드에서 통과 확인**

Run: `pnpm vitest run src/app/position.golden.test.ts`
Expected: PASS 5/5 (특성화 테스트이므로 현재 코드에서 바로 통과해야 함. 실패 시 기대값이 아니라 **테스트의 수치 계산**을 의심하고 현재 코드 기준으로 정정)

- [ ] **Step 3: 전체 테스트 확인 후 커밋**

Run: `pnpm test`
Expected: 기존 전부(59) + 신규 5 PASS

```bash
git add src/app/position.golden.test.ts
git commit -m "test: position.ts 카메라 공식 골든(특성화) 테스트 추가"
```

---

### Task 2: cameraMath 순수 모듈 (TDD)

**Files:**
- Create: `src/app/utils/cameraMath.ts`
- Test(Create): `src/app/utils/cameraMath.test.ts`

**Interfaces:**
- Consumes: 없음 (순수, 의존성 0)
- Produces (이후 태스크가 사용하는 정확한 시그니처 — 길이/델타 함수는 ISP에 따라 `scale`만 받는다):

```ts
export type Camera = { x: number; y: number; scale: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type Viewport = { dpr: number; rect: Rect };
export type DocSize = { width: number; height: number };

export function clientToScene(clientX: number, clientY: number, cam: Camera, vp: Viewport): { x: number; y: number };
export function sceneToClient(sceneX: number, sceneY: number, cam: Camera, vp: Viewport): { x: number; y: number };
export function sceneToContainer(sceneX: number, sceneY: number, cam: Camera, dpr: number): { x: number; y: number };
export function sceneLengthToCss(length: number, scale: number, dpr: number): number;
export function cssDeltaToScene(delta: number, scale: number, dpr: number): number;
export function sceneRectToContainer(rect: Rect, cam: Camera, dpr: number): Rect;
export function zoomAround(cam: Camera, anchorScene: { x: number; y: number }, nextScale: number): Camera;
export function clampOffset(cam: Camera, doc: DocSize, vp: Viewport): Camera;
export function fitDocument(vp: Viewport, percent?: number, ratio?: number): { doc: DocSize; camera: Camera };
```

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/app/utils/cameraMath.test.ts
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
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `pnpm vitest run src/app/utils/cameraMath.test.ts`
Expected: FAIL — "Cannot find module './cameraMath'"

- [ ] **Step 3: 구현**

```ts
// src/app/utils/cameraMath.ts
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

export function sceneLengthToCss(length: number, scale: number, dpr: number): number {
  return (length * scale) / dpr;
}

// CSS px 델타(휠/드래그 이동량) → scene 델타. sceneLengthToCss의 역변환.
export function cssDeltaToScene(delta: number, scale: number, dpr: number): number {
  return (delta / scale) * dpr;
}

export function sceneRectToContainer(rect: Rect, cam: Camera, dpr: number): Rect {
  const p = sceneToContainer(rect.x, rect.y, cam, dpr);
  return {
    x: p.x,
    y: p.y,
    width: sceneLengthToCss(rect.width, cam.scale, dpr),
    height: sceneLengthToCss(rect.height, cam.scale, dpr),
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

Run: `pnpm vitest run src/app/utils/cameraMath.test.ts`
Expected: PASS 11/11

- [ ] **Step 5: 커밋**

```bash
git add src/app/utils/cameraMath.ts src/app/utils/cameraMath.test.ts
git commit -m "feat: cameraMath 순수 모듈 추가 (변환·줌·클램프 단일 원천)"
```

---

### Task 3: position.ts를 cameraMath에 위임 + 죽은 상태/코드 삭제

외부 API는 그대로, 내부 계산만 위임. 골든 테스트가 계속 green이어야 한다.

**Files:**
- Modify: `src/app/position.ts`

**Interfaces:**
- Consumes: Task 2의 `cameraMath` 전체
- Produces (신규 export — Task 4가 사용):
  - `getCamera(): Camera` — `{ x: position.x, y: position.y, scale: position.scale }`
  - `getViewport(): Viewport` — `{ dpr: getPixelRatio(), rect: position.bouncingRect }`
- 삭제 (사전 고지 완료):
  - `canvas_coord_to_css_coord` export (+ 내부 `to_world_coord`, `canvas_coord_to_screen_coord`) — 호출 0건
  - `PositionState.dpr` 필드 (15행 `dpr = 3;`) 및 유일한 쓰기(136행 `position.dpr = dpr;`) — 읽기 0건인 죽은 상태

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
} from "./utils/cameraMath";
```

`PositionState` 클래스에서 `dpr = 3;` 필드(15행) 삭제.

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

`setDefaultPosition` (기존 104-155행) — 맞춤 계산을 `fitDocument`로 (`position.dpr` 쓰기 제거):

```ts
export function setDefaultPosition() {
  updateBouncingRect();

  MAX_SCALE = 120 * getPixelRatio();

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
git commit -m "refactor: position.ts 카메라 계산을 cameraMath로 위임, 죽은 dpr 필드/변환함수 삭제"
```

---

### Task 4: 변환 공식 중복 제거 (8곳)

scene→screen 4곳(view.ts / selectionHitTest / shapeHitTest / resizeGeometry) + CSS델타→scene 4곳(PanTool / wheelEvent / ZoomTool / main.tsx). hit-test는 리팩토링 **전에** 특성화 테스트부터 작성한다.

**Files:**
- Test(Create): `src/app/utils/hitTest.test.ts`
- Modify: `src/app/utils/selectionHitTest.ts`, `src/app/utils/shapeHitTest.ts`, `src/app/utils/resizeGeometry.ts`, `src/app/ui/view.ts`, `src/app/tools/PanTool.ts`, `src/app/events/wheelEvent.ts`, `src/app/tools/ZoomTool.ts`, `src/app/main.tsx`

**Interfaces:**
- Consumes: `cameraMath.sceneToContainer/sceneLengthToCss/cssDeltaToScene/sceneRectToContainer`, `position.getCamera/getViewport/getPixelRatio`
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
import { sceneLengthToCss, sceneToContainer } from "./cameraMath";
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
  const w = sceneLengthToCss(cW, cam.scale, dpr);
  const h = sceneLengthToCss(cH, cam.scale, dpr);
```

나머지(핸들 사각형 계산 이하)는 무변경.

- [ ] **Step 5: shapeHitTest.ts 인라인 공식 교체**

import 교체:

```ts
import { getCamera, getPixelRatio, position } from "../position";
import { sceneLengthToCss, sceneToContainer } from "./cameraMath";
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
  const w = sceneLengthToCss(rect.width, cam.scale, dpr);
  const h = sceneLengthToCss(rect.height, cam.scale, dpr);
```

나머지(핸들 사각형 계산 이하)는 무변경.

- [ ] **Step 6: resizeGeometry.ts 교체**

import 추가:

```ts
import { getCamera, getPixelRatio, position, to_canvas_coord } from "../position";
import { sceneRectToContainer } from "./cameraMath";
```

`hitTestOutsideCanvasResizeCorner`의 left/top/width/height 계산(기존 35-44행):

```ts
  const size = sceneRectToContainer(
    { x: 0, y: 0, width: position.width, height: position.height },
    getCamera(),
    getPixelRatio(),
  );
  const left = size.x;
  const top = size.y + position.bouncingRect.y - position.bottomNavHeight;
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
import { sceneLengthToCss, sceneRectToContainer, sceneToContainer } from "../utils/cameraMath";
```

교체 지점 6곳 (전부 검증된 현재 행번호):

- 131행: `const scaled = (brushSize * position.scale) / dpr;`
  → `const scaled = sceneLengthToCss(brushSize, position.scale, dpr);`
- 155행: `(paintState.getBrushSize() * position.scale) / getPixelRatio() > 16`
  → `sceneLengthToCss(paintState.getBrushSize(), position.scale, getPixelRatio()) > 16`
- 196-197행 (freeform 프리뷰 점 변환):
  ```ts
  const p = sceneToContainer(point.x, point.y, getCamera(), dpr);
  return `${p.x},${p.y}`;
  ```
- 217-220행 (`bindSelectionUI`의 `positionHandles`):
  ```ts
  const s = sceneRectToContainer(rect, getCamera(), dpr);
  // 이후 sLeft→s.x, sTop→s.y, sWidth→s.width, sHeight→s.height 로 치환
  ```
- 253-256행 (selectionArea): 동일 패턴 (`scaledLeft→s.x` 등으로 치환)
- 308-311행 (`bindShapeUI`의 `positionHandles`) / 343-346행 (shapeArea): 동일 패턴

참고(비범위): `positionHandles`가 selection/shape에 바이트 동일 중복돼 있으나 오버레이 구조 정리는 별도 작업 — 이번엔 변환식만 교체.

- [ ] **Step 8: CSS델타→scene 4곳 교체 (cssDeltaToScene)**

`PanTool.ts` 36-40행:

```ts
    const dpr = getPixelRatio();
    const newX = position.x - cssDeltaToScene(this.lastClientX - e.clientX, position.scale, dpr);
    const newY = position.y - cssDeltaToScene(this.lastClientY - e.clientY, position.scale, dpr);
```

`wheelEvent.ts` 48-55행:

```ts
        const dpr = getPixelRatio();
        if (event.shiftKey && event.deltaX === 0) {
          position.setX(position.x - cssDeltaToScene(event.deltaY, position.scale, dpr));
          position.setY(position.y - cssDeltaToScene(event.deltaX, position.scale, dpr));
        } else {
          position.setX(position.x - cssDeltaToScene(event.deltaX, position.scale, dpr));
          position.setY(position.y - cssDeltaToScene(event.deltaY, position.scale, dpr));
        }
```

`ZoomTool.ts` 92-93행 (`(x/dpr - d/scale)*dpr` = `x - d*dpr/scale` 동일식):

```ts
      position.setX(position.x - cssDeltaToScene(dx, position.scale, dpr));
      position.setY(position.y - cssDeltaToScene(dy, position.scale, dpr));
```

`main.tsx` 121-122행 (리사이즈 시 AppBar 높이 변화 보정):

```ts
      let diffY = cssDeltaToScene(lastY - position.bouncingRect.y, position.scale, getPixelRatio());
```

각 파일에 `import { cssDeltaToScene } from "…/utils/cameraMath";` 추가 (경로는 파일 위치 기준).

- [ ] **Step 9: 실행 — 전체 green 확인**

Run: `pnpm test && npx tsc --noEmit`
Expected: 특성화 13개 + 골든 5개 포함 전체 PASS. tsc 기존 1건만.

- [ ] **Step 10: 커밋**

```bash
git add src/app/utils/selectionHitTest.ts src/app/utils/shapeHitTest.ts src/app/utils/resizeGeometry.ts src/app/ui/view.ts src/app/tools/PanTool.ts src/app/events/wheelEvent.ts src/app/tools/ZoomTool.ts src/app/main.tsx
git commit -m "refactor: scene↔screen/델타 변환 중복 8곳을 cameraMath로 통합"
```

---

### Task 5: 최종 검증

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 테스트 + 타입체크**

Run: `pnpm test && npx tsc --noEmit`
Expected: 테스트 전부 PASS (기존 59 + 신규 약 29). tsc는 example.ts TS2440 1건만.

- [ ] **Step 2: 수동 검증 (dev 서버)**

Run: `pnpm dev` 후 브라우저에서:
1. 휠(ctrl+휠) 줌·휠 팬·스페이스 드래그 팬이 이전과 동일한 속도/방향
2. 돋보기 탭줌·박스줌 동일 (레티나 포함)
3. 선택 영역 생성·이동·리사이즈 핸들 히트/표시 동일, 도형도 동일
4. 캔버스 리사이즈 핸들 표시·드래그 동일
5. 브러시 커서 크기 표시 동일, 커서 좌표 박스 동일
6. 창 리사이즈 시 캔버스 위치 보정 동일 (main.tsx 리사이즈 핸들러)
7. 핀치(이미 수정됨): 휠줌 후 핀치 시작 시 튐 없음 유지

- [ ] **Step 3: 잔여 변경 없는지 확인**

```bash
git status  # 잔여 변경 없어야 함
```
