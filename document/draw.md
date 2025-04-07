# 🖱️ JS 단: 메인 스레드와 WebGL 워커의 인터페이스, 이벤트 시스템 완전 정리

이 문서는 브라우저 메인 스레드에서 사용자 입력을 처리하고 WebWorker를 통해 WebGL 도구(`brush`, `eraser`, `liquify`, `select`)로 연결하는 전체 흐름을 **100% 명확히 정리**합니다.

---

## 📐 전체 흐름 요약

```text
[사용자 포인터 이벤트]
        │
        ▼
[addDrawEvent()] 내부 로직
        │
        ▼
→ 도구 설정: toolManager
→ 브러시 stroke: worker.strokeTo(point)
→ 선택 영역: DOM + to_pixel_canvas_coord
        │
        ▼
[workerApi.* 호출] → PaintService
```

---

## 🧰 1. 도구 선택: `toolManager`

```ts
toolManager.setBrushTool();
toolManager.setEraserTool();
toolManager.setLiquifyTool();
toolManager.setSelectTool();
```

- `paintState.toolId` 설정
- 각 도구별 기본 설정값 (`brushSize`, `alpha`)
- `applySelection()` 호출 → 선택 영역이 적용되지 않은 상태면 먼저 적용
- `worker.setTool(...)` 호출

---

## 🧱 2. `initDraw()` – WebWorker 초기화

```ts
const offscreen = canvas.transferControlToOffscreen();
worker.makeLayer(Comlink.transfer(offscreen), width, height, ...);
```

- 캔버스를 워커로 넘김
- `OffscreenCanvas`는 `Comlink.transfer`로 버퍼 공유 가능
- 워커에서는 `PaintService` 내부에서 초기화됨

---

## 🖊️ 3. 포인터 기반 브러시 동작

### pointerdown

```ts
worker.setStrokeColor(0, 255, 255);
worker.setStrokeSize(paintState.brushSize);
worker.setAlpha(paintState.brushAlpha);
worker.start(point);
```

- 현재 도구 설정값 전달
- `brush`, `eraser`, `liquify`는 공통으로 `start(point)` 호출

### pointermove

```ts
worker.strokeTo(point);
```

- `liquify`는 거리 체크 후 일정 거리 이상일 때만 호출 (최적화)
- `brush`, `eraser`는 모두 호출

### pointerup

```ts
worker.strokeTo(point);
endDrawing(); // 내부적으로 worker.end()
```

- `strokeTo` 한 번 더 호출 후 종료
- 커서 모양, 단축키 상태 업데이트

---

## 🔲 4. 선택 도구 흐름: `select`

### 시작 (`pointerdown`)

```ts
sx = e.clientX; sy = e.clientY;
zoomArea.style.visibility = "visible";
```

- DOM 상의 `zoomArea` (선택 박스) 표시 시작

### 드래그 (`pointermove`)

```ts
elementStore.zoomArea.style.left = ...
elementStore.zoomArea.style.width = ...
```

- 선택 박스를 실시간으로 DOM에서 위치 조절

### 종료 (`pointerup`)

```ts
let p1 = to_pixel_canvas_coord(sx, sy);
let p2 = to_pixel_canvas_coord(ex, ey);
canvasSelect(startX, startY, zoomW, zoomH);
```

- 실제 캔버스 기준 좌표로 변환
- 내부적으로 `workerApi.select(x, y, w, h)` 호출됨
- 렌더링 매니저에서 선택 텍스처 설정 + 알파 영역 초기화됨

---

## ✍️ 5. 유틸 함수

### `cancel()`

```ts
if (paintState.toolId == "selection") {
  selectionCancel();
  return;
}
worker.cancel();
```

- 선택 영역이면 취소 전용 로직
- 도구 작업이면 `worker.cancel()` 호출

### `endDrawing()`

```ts
worker.end();
```

- 모든 도구의 완료 처리 호출
- 대부분 `uploadCurrent()` 또는 결과 저장이 여기서 처리됨

---

## 🧪 6. 테스트 유틸

```ts
globalThis.drawLine = () => {
  worker.start({ x: 50, y: 50 });
  worker.strokeTo({ x: 630.2, y: 300 });
};
```

- 디버깅용: 고정된 선을 그려줌

---

## 🧭 이벤트 흐름 종합도

```
[pointerdown]
  ├─ brush/liquify/eraser → worker.start(point)
  └─ select → DOM zoomArea 표시

[pointermove]
  ├─ worker.strokeTo(point)
  └─ select → zoomArea 실시간 이동

[pointerup]
  ├─ worker.strokeTo(point) → endDrawing()
  └─ select → pixel좌표 변환 → canvasSelect → worker.select()
```

---

## 🎓 핵심 요약

| 구성 요소 | 역할 |
|-----------|------|
| `toolManager` | 도구 설정 및 초기값 설정 |
| `initDraw()` | WebWorker 초기 생성 |
| `addDrawEvent()` | 전체 pointer 이벤트 핸들링 |
| `OffscreenCanvas` | 메인 → 워커로 넘기는 GPU 자원 |
| `Comlink` | 메인 ↔ 워커 함수 호출 추상화 |
| `zoomArea` | 선택 영역 시각화용 DOM 요소 |
| `canvasSelect()` | 선택 영역 적용 (워커 API 호출) |

---

이제 이 코드를 기반으로 JS ↔ WebWorker ↔ WebGL의 연계, 도구 시스템, 렌더링 트리거링 흐름까지 완벽히 꿰뚫어볼 수 있다.  
이 구조를 100% 이해했으면, **히스토리뿐 아니라 UI 툴바/툴 단축키/선택툴 기능 확장 등 모든 프론트엔드 도구 구현이 가능하다.**

🔥 **실전 투입 바로 가능. 준비 완료.**
