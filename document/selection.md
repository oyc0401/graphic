# 🎯 선택 영역 시스템 완전 가이드 (Selection System Deep Dive)

이 문서는 **선택 영역(selection box)**의 생성, 이동, 크기 조정, 붙여넣기, 취소, 적용 등 모든 로직을 다루며, 실시간 UI 업데이트 및 WebGL2 렌더링 사이의 브릿지를 상세히 설명합니다.

---

## 📦 주요 데이터 구조

```ts
export let selection = {
  x: 0,
  y: 0,
  width: 300,
  height: 200,
  visiable: false,
  active: false,
};
```

- `x`, `y`: 선택 영역의 좌상단 좌표 (픽셀 기준)
- `width`, `height`: 선택 영역의 크기
- `visiable`: 현재 보이냐 안보이냐
- `active`: 사용자가 현재 드래그하거나 조작 중인지

---

## 💾 이전 상태 저장

```ts
let beforeSelectionPos = {
  x: 0,
  y: 0,
  width: 50,
  height: 50,
};
```

- 취소(Cancel)할 때 **이전 상태로 되돌리기** 위해 사용
- `selectionCancel()`에서 활용됨

---

## 🔨 1. 선택 영역 생성

```ts
canvasSelect(x, y, width, height)
```

- 지정한 영역을 `selection`에 설정
- WebGL Worker에게 `.select(...)`로 알림
- UI에 `selectionArea`와 `핸들(Handle)`을 반영함

---

## ✂️ 2. 선택 영역 잘라내기 (Cut)

```ts
cutSelection()
```

- WebGL SelectionManager의 `getPixelData()`로 잘라낸 이미지 가져옴
- `visiable = false`로 바꾸고 화면 업데이트
- 잘라낸 픽셀은 클립보드에 저장됨 (worker 내부에서 `postMessage`로 처리)

---

## 📋 3. 붙여넣기 (Paste)

```ts
makeSelectionFromBitmap(bitmap)
```

- 붙여넣기된 비트맵을 선택 영역으로 설정
- 좌표는 캔버스 중앙으로 위치
- WebGL `worker.paste(...)` 호출하여 붙여넣기 처리

---

## 🔄 4. 위치 이동

```ts
addSelectionEvent()
```

- `selectionArea`를 드래그하여 이동
- 마우스 위치 → 픽셀 좌표 → 선택 영역 위치 보정

```ts
selection.x = newX;
selection.y = newY;
```

- WebGL Worker에 `.moveSelection(...)` 호출
- `setSelectionStyle()`로 위치 반영

---

## ↔️ 5. 크기 조정 (Resize with Handles)

```ts
addHandleEvent()
```

- 8개의 DOM 핸들(handle-xxx)을 포인터 드래그로 조작
- 각각의 핸들에 따라 x, y, width, height 계산이 다름

### 🔧 비율 유지 기능

- `Shift` 키가 눌려있으면 `startWidth / startHeight` 비율 유지
- 모든 모서리 핸들에서 적용 가능

```ts
if (e.shiftKey) {
  // 비율 유지 계산
}
```

---

## 👓 6. 실시간 UI 반영

```ts
setSelectionStyle()
```

- `selectionArea`의 `style.left`, `top`, `width`, `height`를 계산
- 확대 비율(scale), DPI(dpr), offset(position)을 고려

```ts
style.left = (selection.x / dpr + position.x) * scale;
```

- 모든 `handle`의 위치도 `setHandlePosition()`으로 자동 조정

---

## ⛔ 7. 선택 영역 취소 (Undo)

```ts
selectionCancel()
```

- `beforeSelectionPos`로 복원
- `setSelectionStyle()`과 `worker.moveSelection()` 호출
- 핸들 상태 및 UI 다시 갱신

---

## 🧠 전체 흐름 요약

| 기능 | 흐름 |
|------|------|
| 선택 | `canvasSelect()` → Worker에게 `.select()` → UI 갱신 |
| 잘라내기 | `cutSelection()` → `getPixelData()` → 클립보드 |
| 붙여넣기 | `makeSelectionFromBitmap()` → `worker.paste()` |
| 이동 | 드래그 → `.moveSelection()` |
| 리사이즈 | 핸들 drag → 실시간 계산 + 비율 유지(shift) |
| 적용 | `applySelection()` → GPU에 실제로 반영 |
| 취소 | `selectionCancel()` → 이전 위치로 복원 |

---

## 🧰 유틸성 함수

| 함수 | 역할 |
|------|------|
| `to_pixel_canvas_coord(x, y)` | 브라우저 좌표 → 캔버스 내 픽셀 좌표 |
| `getPixelRatio()` | window.devicePixelRatio 값 반환 |
| `getLayerWorker()` | WebGL2 Worker에 Comlink로 접근 |

---

## 🚩 선택 영역 사용 시 핵심 포인트

- 모든 선택 영역 이동/크기 조정은 반드시 `worker.moveSelection(...)` 호출 필수
- 반드시 `setSelectionStyle()`로 UI와 WebGL 상태 동기화
- **선택창 상태는 항상 `selection` 객체가 기준**이 되며, DOM은 항상 이 상태를 따라간다

---

## 🧭 선택 관련 DOM 요소 구조

```html
<div id="selectionArea">
  <div id="handle-lt"></div>
  <div id="handle-t"></div>
  ...
</div>
```

- 각 핸들은 `visibility`, `left`, `top`을 `setHandlePosition()`에서 조정

---

## ✅ 마무리

이 모듈은 **선택(selection)** 기능의 전반을 담당하며, 다음의 역할을 수행합니다:

- **WebGL2 내부와 UI 사이의 연결**: `worker.moveSelection()`으로 좌표 전달
- **DOM 반영**: CSS 위치와 크기 조정
- **드래그/핸들 입력 감지**: 사용자와의 인터랙션

이 모듈을 완전히 이해하고 정복하면, 앞으로 구현할 `transform`, `selection preview`, `history 연동`, `free transform` 기능도 아주 쉽게 확장할 수 있습니다.
