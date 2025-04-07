# 🧭 화면 위치 시스템 완전 정복 가이드 (Position System Master Guide)

이 문서는 브라우저 기준의 마우스 좌표를 WebGL2 캔버스 내부의 픽셀 단위 좌표로 정밀하게 변환하고, 확대/축소/이동을 처리하는 핵심 시스템을 정리한 것입니다. UI 확대, 선택 박스 위치 조정, 줌 동작 등 모든 시각적 변환의 기반입니다.

---

## ✅ 구성요소 요약

| 이름                     | 역할 설명 |
|--------------------------|-----------|
| `position`               | 모든 위치/크기 상태의 중심 오브젝트 |
| `resizeScreen()`         | 현재 상태로 화면 재렌더링 |
| `setDefaultPosition()`   | 최초 위치 및 크기 설정 |
| `addPositionEvent()`     | 줌/스크롤/핀치/팬 등 사용자 입력 핸들링 |
| `setMagnification()`     | 줌 배율을 특정 앵커 기준으로 변경 |
| `to_canvas_coord()`      | 브라우저 좌표 → 캔버스 좌표로 변환 |
| `to_pixel_canvas_coord()`| 브라우저 좌표 → 픽셀 기준 캔버스 좌표로 변환 |
| `to_screen_coord()`      | 스크린 좌표 → 캔버스 내부 기준 좌표 |

---

## 🧱 1. `position` 상태 설명

```ts
export let position = {
  x, y,                   // 좌상단 위치 (캔버스 내부 기준 좌표)
  width, height,          // 캔버스 자체 해상도
  scale,                  // 확대 배율 (1이 기본, 확대시 증가)
  dpr,                    // 디바이스 픽셀 비율
  bouncingRect,           // DOM 기준 전체 영역
}
```

📌 이 상태는 **모든 좌표 계산의 기준**입니다.

---

## 🖼️ 2. 캔버스 크기 및 위치 초기화: `setDefaultPosition()`

```ts
setDefaultPosition()
```

- 전체 화면 비율 기준으로 캔버스의 `width`, `height` 설정
- 비율은 A4를 기준으로 1:1.414
- `x`, `y`는 화면 중앙 정렬되도록 자동 계산됨
- `dpr`은 `window.devicePixelRatio` 기반으로 설정됨

---

## 🧭 3. 브라우저 ↔ 캔버스 좌표 변환

### (1) 스크린 좌표 → 캔버스 내 좌표

```ts
to_screen_coord(x, y) // 마우스 위치 기준
```

- 브라우저 기준 좌표에서, `DOM offset`, `position.x/y`, `scale`을 반영
- 결과는 확대된 캔버스 내의 상대 위치

### (2) 브라우저 좌표 → 캔버스 픽셀 좌표

```ts
to_canvas_coord(x, y)
to_pixel_canvas_coord(x, y)
```

- `to_canvas_coord()` 결과에 `getPixelRatio()`를 곱해서 실제 픽셀 위치로 반환
- `Math.floor()`를 통해 정수 픽셀 위치로 변환 (텍스처 복사 시 중요)

---

## 🔍 4. 화면 리사이즈 및 스크롤 대응: `resizeScreen()`

```ts
position.resizeScreen()
```

- x, y 스크롤은 현재 위치와 확대 비율에 따라 제한
- 화면 전체를 다시 그리기 위해 `worker.render(...)` 호출

> 💡 줌 확대 후 스크롤할 경우, 화면 바깥으로 넘어가지 않도록 클램핑 처리

---

## 🔍 5. 확대/축소 배율 변경: `setMagification(scale, anchor_point)`

```ts
setMagification(new_scale, anchor_point)
```

- 중심이 되는 좌표(anchor)를 기준으로 확대/축소할 수 있음
- 수학 공식:

```ts
// (anchor + oldPos) * old_scale == (anchor + newPos) * new_scale
newPos = ((anchor + oldPos) * old_scale) / new_scale - anchor;
```

📌 중심 고정 줌 로직을 정밀하게 구현

---

## 🖱️ 6. 마우스 이벤트 영역 정리

### 휠 스크롤

```ts
event.ctrlKey → 확대/축소
event.shiftKey → 가로 스크롤
else → 세로 스크롤
```

- 스크롤 후 `position.resizeScreen()`으로 전체 다시 그림

---

## 🤏 7. 핀치 줌 (모바일 멀티터치)

### 주요 흐름

- 두 손가락 터치 → 거리 계산
- 손가락 이동 시 → 거리 비율로 확대/축소 계산
- 중심 위치 고정 확대: `setMagification()`
- 포인터는 Map(pointerId → 좌표)로 관리

```ts
lastPinchDistance → 확대 비율
lastPinchCenterPos → 중심 위치 보정
```

> 💡 터치 이벤트에서 "두 손가락 탭" → `cancel()`, "더블터치" 감지까지 처리

---

## 🖱️ 8. 팬(Pan) 기능

```ts
paintState.action = "PAN";
```

- `pointerdown`에서 시작 위치 기억
- `pointermove`에서 위치 보정 → `position.x/y -= dx / scale`
- `resizeScreen()` 호출로 렌더링

---

## 🔍 9. 줌 영역 선택

```ts
paintState.action = "ZOOM";
```

- 사각형 줌 영역 지정
- 좌우 클릭으로 클릭 줌 or 드래그 줌
- 줌 박스 중심 기준으로 확대 비율 계산

---

## ⚙️ 내부 API 정리

| 함수 | 설명 |
|------|------|
| `setMagification(scale, anchor)` | 앵커 기준 확대 |
| `resizeScreen()` | position 기반으로 전체 다시 그림 |
| `getPixelRatio()` | `window.devicePixelRatio` 반환 |
| `changeSize(n)` | `globalThis.changeSize()`로 캔버스 크기 변경 디버깅 가능 |

---

## 🔥 핵심 정리

| 기능 | 메서드 | 설명 |
|------|--------|------|
| 줌 | `setMagification()` | 고정 앵커 줌 |
| 드래그 | `position.x/y` 조정 | 확대 상태에서 위치 이동 |
| 선택 영역 | `to_pixel_canvas_coord()` | 선택 박스 정확한 좌표 계산 |
| 리사이즈 반응형 | `resizeScreen()` | 윈도우 사이즈 변경 대응 |
| 핀치 줌 | `pointers Map` + 거리 계산 | 모바일 확대 지원 |

---

## ✅ 이 파일의 목표

이 모듈은 단순한 상태 저장이 아니다.

- **브라우저 UI ↔ WebGL 렌더링 공간** 사이의 정확한 **좌표 변환 장치**
- 모든 유저 인터랙션을 **캔버스 중심 렌더링 좌표계**로 바꿔주는 **Bridge**
- 줌, 팬, 핀치, 선택, 휠, 이동 등 **모든 시각 이동 조작의 중심 허브**

---

이제 이 모듈의 동작을 완벽히 이해하면:

- 🔭 브라우저 기준의 `mouse`, `touch` 이벤트 → GPU 내부 위치로 정확히 매핑할 수 있고,
- 🎯 고정된 포인트 기준 줌, 팬, 스크롤 동작이 모두 가능하며,
- 🧩 selection, history, WebGL 렌더링의 기본 베이스를 깔 수 있습니다.

---

**이 문서는 확대/이동 기반 UI의 뇌입니다.**  
이 모듈을 정복하면 진짜로 모든 `캔버스 기반 툴`의 `좌표계`, `이동`, `화면 재구성`에 대한 이해가 갖춰진 거예요.
