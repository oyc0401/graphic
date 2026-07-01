# 카메라/뷰 상태 리팩토링 설계

- 날짜: 2026-07-02
- 접근법: **A — 순수 코어 + 얇은 observable 래퍼** (점진적)
- 범위: 카메라 + 선택 + 도형의 **상태/로직**. 오버레이 렌더링(view.ts) 선언형 전환은 **비범위(별도 작업)**.

## Context (왜 하는가)

뷰/카메라 상태가 여러 곳에 분산돼 있고, 그로 인해 실제 사용자 버그(핀치 튐)가 발생한다.

- `position`(MobX 싱글톤, `position.ts`)이 `x,y`(scene px)·`scale`·`dpr`·`width,height`·`bouncingRect`(CSS px)·`screen*`(device px)를 **단위 섞어** 보관하고, 카메라 함수(`setCameraPosition`/`setMagification`/`to_screen_coord`/`changeCanvasSize`)가 전역을 **직접 읽고 쓴다**.
- scene↔screen 변환 공식 `(coord + x)*scale/dpr + rect`가 `view.ts`·`utils/resizeGeometry.ts`·`utils/selectionHitTest.ts`·`utils/shapeHitTest.ts` **4곳에 복붙**돼 있다.
- **핀치 튐 버그**: `GestureModule`(`events/gesture/index.ts`)이 생성 시점의 카메라를 자기 `this.position` 사본으로 복사해 **제2의 진실원천**으로 삼는다. 이후 휠·돋보기·팬·리사이즈가 싱글톤만 바꿔 사본이 stale → 핀치 시작 시 튄다. 동기화용 `setPosition`은 있으나 `installGestureAdapter`의 반환값을 `main.tsx:77`에서 버려 호출 불가. 게다가 `gestureAdapter`는 좌표를 스케일 공간(`x*scale`)으로 저장하는데 `updatePinch`/`zoomAtClientPoint`는 비스케일 오프셋으로 취급하는 **단위 불일치**까지 있다.
- 카메라 로직이 싱글톤 + `window.devicePixelRatio`(`getPixelRatio`) + `els.getBoundingClientRect` + `getLayerWorker`에 묶여 **격리 유닛테스트가 불가능**하다. 반면 순수함수(`selectionResize`/`shapeResize`/`canvasResize`/코어 `coordinate.ts`)만 테스트가 존재한다.

## Goals

1. 뷰/카메라 상태를 **단일 진실원천 + DI 가능한 순수 로직**으로 재구성한다.
2. **핀치 튐**을 근본 해결한다 (양방향 sync가 아니라 DI로).
3. 변환 공식 **중복 4곳 → 1곳**.
4. 순수 로직을 **유닛테스트**로 덮고, 리팩토링이 동작을 바꾸지 않음을 **골든 테스트**로 보장한다.
5. 외부 인터페이스(`position` API)를 유지해 consumer 무수정 → 위험 통제.

## Non-goals (이번엔 안 함)

- 오버레이/핸들 렌더링의 선언형(React) 전환 — 별도 작업.
- 싱글톤 완전 제거 / 전면 DI 주입 재배선(접근법 B) — 과범위.
- 멀티레이어(WIP), 그 외 버그, 코어 WebGL 변경.

## 설계 원칙 (사용자 스타일 반영)

- **DI > 양방향 간선**: 순수 코어는 `camera`·`viewport`·`dpr`을 전부 인자로 받는다(DIP). 핀치는 `getCamera` 주입으로 해결(양방향 `setPosition` 금지).
- **SOLID / SRP**: `cameraMath`=변환·줌 계산만 / `CameraState`(기존 `PositionState`)=관측가능 상태 보관만 / `GestureModule`=입력→의도만 / `gestureAdapter`=배선만.
- **성급한 추상화 지양**: 새 추상은 "중복 제거·테스트 가능·핀치 해결"이라는 구체적 필요가 있는 곳에만.

---

## 컴포넌트 설계

### 1. `src/app/camera/cameraMath.ts` (신규, 순수·DOM 없음)

```ts
type Rect     = { x: number; y: number; width: number; height: number };
type Camera   = { x: number; y: number; scale: number };  // x,y = scene px
type Viewport = { dpr: number; rect: Rect };               // rect = 컨테이너 CSS px
type DocSize  = { width: number; height: number };

// 유일한 변환 (현재 공식과 동일하게 유지 — 골든 테스트로 고정)
//   sceneToScreen: (s + cam.{x}) * cam.scale / vp.dpr + vp.rect.{x}
//   screenToScene: (p - vp.rect.{x}) * vp.dpr / cam.scale - cam.{x}
sceneToScreen(sx, sy, cam, vp): { x, y }
screenToScene(px, py, cam, vp): { x, y }

zoomAround(cam, anchorClient, targetScale, vp): Camera   // setMagification 로직 (앵커 고정)
clampOffset(cam, doc, vp): Camera                        // setCameraPosition 클램프
fitDocument(doc, vp): Camera                             // setDefaultPosition 초기맞춤
```

- 완전 순수: 같은 입력 → 같은 출력, window/DOM/싱글톤 접근 없음.
- 스케일 클램프 상수(`MIN_SCALE`/`MAX_SCALE`)는 인자 또는 별도 순수 상수로 주입.

### 2. `src/app/position.ts` (`PositionState`) — 얇은 위임층

- **외부 API 100% 유지**: `position.x/y/scale/width/height`, 모든 세터, `to_screen_coord`, `to_pixel_canvas_coord`, `setMagification`, `setCameraPosition`, `setDefaultPosition`, `changeCanvasSize` 등 시그니처 그대로.
- 내부 계산만 `cameraMath`에 위임: `to_screen_coord`→`screenToScene`, `setMagification`→`zoomAround`, `setCameraPosition` 클램프→`clampOffset`, `setDefaultPosition`→`fitDocument`.
- `getPixelRatio()`(window)·`updateBouncingRect()`(DOM)는 "환경값을 상태로 주입"하는 어댑터로 유지. 순수 수식은 이들을 통해 받은 `dpr`/`rect`만 사용.
- 현재 관측가능 필드에 대한 비-액션 직접대입(`position.dpr = dpr`)은 세터로 정리(선언 추가는 상태 스토어 변경이므로 구현 계획 단계에서 사용자 확인).

### 3. 변환 중복 제거

`view.ts` / `utils/resizeGeometry.ts` / `utils/selectionHitTest.ts` / `utils/shapeHitTest.ts`의 인라인 `(coord+x)*scale/dpr+rect`를 `cameraMath.sceneToScreen`/`screenToScene` 호출로 교체. hit-test 기하는 카메라/뷰포트를 **인자로 받는** 순수 함수로 유지.

### 4. 핀치 해결 — `GestureModule` 단일 진실원천 종속

- `GestureModuleOptions`에 `getCamera: () => Camera` 추가.
- `GestureModule`이 카메라를 **소유하지 않게** 함: 지속 `this.position` SoT 제거. `startPinch`/팬 시작 시 `getCamera()`로 **그 순간의 live 카메라**를 base로 캡처. 제스처 진행 중엔 `base + 포인터 델타`로 계산해 `sceneChanged`로만 내보냄.
- 단위 일치: gesture 계산이 쓰는 좌표계(비스케일 scene 오프셋 + scale)로 통일. `gestureAdapter`가 `getCamera: () => ({ x: position.x, y: position.y, scale: position.scale })` 주입(스케일 공간 저장 제거).
- `setPosition`(되먹임 위험 sync-in) **제거** → 되먹임 루프 원천 차단. `installGestureAdapter`는 정리용 `destroy()`를 위해 인스턴스를 반환하고 `main.tsx`가 보관(선택). 양방향 간선 없음.

### 5. 선택/도형 (상태/로직만)

- **상태**(`selection`/`shape` observable): 기하값(x,y,w,h,flip)만 보관 — 얇게 유지(SRP).
- **기하 로직**: `selectionResize`/`shapeResize`(이미 순수·테스트 있음) 유지. `selectionHitTest`/`shapeHitTest`의 변환 중복을 `cameraMath`로 흡수하고 카메라/뷰포트 DI. 유닛테스트 확장.
- **렌더링**(view.ts 오버레이): 이번엔 명령형 유지(비범위). 단, 변환은 `cameraMath` 경유.

---

## 테스트 전략

- **골든/특성화 테스트 선행(TDD)**: 리팩토링 전에 현재 `to_screen_coord`·`setMagification`·`setCameraPosition`·`setDefaultPosition`의 대표 입력→출력을 캡처해 고정. 순수화가 동작을 바꾸지 않음을 보장.
- **신규 유닛테스트**
  - `camera/cameraMath.test.ts`: `sceneToScreen`↔`screenToScene` 왕복, `zoomAround` 앵커 고정, `clampOffset` 경계, `fitDocument` 초기맞춤.
  - 제스처 델타 수식: 외부 줌 후 핀치 시작이 **live 카메라를 base로** 삼아 튐이 없음(getCamera stub 주입으로 검증).
  - hit-test 기하: 선택/도형 핸들 hit이 카메라/뷰포트 주입 하에 정확.
- **회귀**: 기존 테스트(coordinate/selectionResize/shapeResize/canvasResize) 계속 green, `pnpm test` 전체 통과, `tsc` 0에러(복구된 데모 `example.ts` 제외) 유지.

## 블라스트 반경 / 위험

- 건드리는 파일: `camera/cameraMath.ts`(신규+테스트), `position.ts`, `events/gesture/index.ts`, `events/gestureAdapter.ts`, `main.tsx`, `ui/view.ts`, `utils/resizeGeometry.ts`, `utils/selectionHitTest.ts`, `utils/shapeHitTest.ts`.
- 외부 `position` API 유지 → 20+ 툴 consumer 무수정.
- **주요 위험**: 변환 부호/단위 실수. **완화**: 골든 테스트 선행 + 왕복 테스트.
- **상태 스토어 선언 변경**(세터 추가 등)은 CLAUDE.md상 사용자 확인 후 진행.

## 검증 방법 (구현 후)

1. `pnpm test` — 신규 + 기존 테스트 전부 통과.
2. `npx tsc --noEmit` — 0에러(데모 `example.ts` 제외).
3. `pnpm dev`로 실제 앱: 휠/돋보기로 확대 → 핀치 시작 시 **튐 없음** 확인(레티나 포함), 팬·리사이즈·undo 후에도 동일.
4. 선택/도형 핸들 드래그·리사이즈가 회귀 없이 동작.
