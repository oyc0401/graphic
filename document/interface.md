# 🧠 UI 상호작용 및 도구 전환 시스템 총정리

이 문서는 사용자 인터랙션(`click`, `keydown`, `pointer`)을 기반으로 도구 변경, 커서 모양 변경, UI 클래스 갱신까지 **전체 UI-UX 흐름을 책임지는 핵심 로직**을 설명합니다.

---

## 🌐 전체 시스템의 흐름

```
[버튼 클릭 / 키 입력 / 마우스 이벤트]
       ↓
[paintState / pressedKeys 변경]
       ↓
[toolManager / applyKeyAction()]
       ↓
[getLayerWorker().setTool(), WebGL 도구 설정]
       ↓
[updateCursorShape(), UI 업데이트]
```

---

## 🔧 주요 상태 및 객체

### `paintState`

- `toolId`: 현재 선택된 도구 ID
- `pointerdown`: 마우스나 손가락이 눌렸는지 여부
- `cursorX`, `cursorY`: 마우스 커서 위치
- `action`: `"BRUSH"`, `"PAN"`, `"ZOOM"` 등 현재 사용자의 액션

### `pressedKeys`

```ts
export let pressedKeys = {
  Space: false,
  KeyZ: false,
};
```

---

## 🖱 도구 전환 버튼

### `getElements()`

HTML 요소를 전부 캐싱함.

### 각 버튼과 도구 연결

```ts
elementStore.selectBrushBtn.addEventListener("click", () => {
  toolManager.setBrushTool();
  updateMenubarUI();
});
```

- 버튼 클릭 시 `toolManager`에서 `setBrushTool()` 실행
- `paintState.toolId = 'brush'` 설정
- WebWorker에도 `.setTool('brush')` 요청

---

## 🎛 단축키 처리

```ts
document.addEventListener("keydown", (event) => {
  if (event.code === "Space") pressedKeys.Space = true;
  if (event.code === "KeyZ") pressedKeys.KeyZ = true;
  applyKeyAction();
  updateCursorShape();
});
```

- `applyKeyAction()`으로 현재 `action` 설정 (BRUSH, PAN, ZOOM)
- `updateCursorShape()`로 마우스 커서 모양 변경

---

## 🔁 커서 상태 업데이트: `updateCursorShape()`

### 커서 동작

```ts
// action이 PAN이면 grab/grabbing
// action이 BRUSH + tool이 select면 select 커서
// action이 BRUSH + brush/eraser/liquify면 원형 브러시 표시
// action이 ZOOM이면 zoom 커서
```

```ts
brushCursor.style.left = `${cursorX - size / 2 - 1}px`;
brushCursor.style.width = `${size}px`;
```

- 스케일(scale), 위치(x, y), dpr 기반으로 CSS 위치 자동 계산
- 데스크탑에서만 `brushCursor` 사용

---

## 🎨 클래스 기반 UI 스타일 전환

```ts
const MANAGED_CLASSES = ["grab", "grabbing", "brush", "zoom", "select", "largeBrush"];
```

- 마우스 상태에 따라 해당 클래스를 `#container`에 적용
- CSS에서 각 클래스별 커서와 마우스 인터랙션 정의

---

## 📥 pointer 이벤트 흐름

- pointerdown: `paintState.pointerdown = true`
- pointerup: `paintState.pointerdown = false`
- pointermove: `cursorX`, `cursorY` 업데이트 후 커서 갱신
- `pointerdown` 상태는 ZOOM, PAN, BRUSH 상태 유지의 핵심

---

## 🛠 toolManager와의 연결

```ts
toolManager.setBrushTool(); // 내부적으로 paintState 설정 + Worker에 명령
```

모든 도구 선택은 **UI → toolManager → Worker → paintState** 흐름으로 제어됨.

---

## 🖼 zoomArea / selectionArea 제어

```ts
elementStore.zoomArea.style.visibility = "visible";
elementStore.selectionArea.style.left = `${x}px`;
```

- 모든 좌표 및 크기는 `position.scale`, `getPixelRatio()` 기준으로 CSS 조정

---

## ✅ 핵심 정리

| 기능 | 연결 흐름 |
|------|-----------|
| 툴 버튼 클릭 | UI → toolManager → paintState → Worker |
| 키보드 입력 | keydown → pressedKeys → applyKeyAction |
| 커서 모양 변경 | paintState.action + toolId → updateCursorShape |
| 커서 스타일 | DOM 클래스 + brushCursor 위치 동기화 |
| WebGL 도구 | `getLayerWorker().setTool(...)` |
| Zoom / Pan / Selection | `paintState.action`과 포인터 상태에 따라 구분 |

---

## 🧠 추가 팁

- 모바일 환경과 데스크탑을 구분하려면 `ontouchstart in window` 체크
- `scaledBrushSize > 50`은 브러시 커서 시각화 기준
- `paintState.pointerdown`은 도중에 도구가 바뀌는 걸 막아줌 (안정성 확보)

---

이 모듈은 **도구 선택부터 WebGL Worker 명령 실행, UI 커서 변화까지** 전체 UX 흐름을 제어합니다. 이 구조를 잘 이해하면, 앞으로 **새 도구 추가**, **다중 커서 시스템**, **UI 상태 싱크** 구현 시에도 쉽게 확장할 수 있습니다.
