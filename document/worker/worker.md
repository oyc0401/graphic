# 🧠 WebWorker 통신 구조 완전 분석

이 문서는 WebGL 기반 페인트 툴 프로젝트에서 사용 중인 **WebWorker 통신 구조**를 설명합니다.  
브라우저 메인 스레드의 부하를 줄이고, **브러시, 유동화, 선택 등 모든 렌더링을 워커에서 수행**하도록 분리된 구조이며,  
이 문서를 통해 워커의 구조적 흐름과 **Comlink**, **OffscreenCanvas**, **클립보드 통신**까지 완벽히 이해할 수 있습니다.

---

## 📦 구조 요약

```text
           [Main Thread]
                │
                ▼
        import { getLayerWorker } from "workerpool"
                │
                ▼
       Comlink.wrap(worker) → 호출
                │
                ▼
     ┌──────────────────────────────┐
     │    paintController.ts       │
     │  workerApi = { ... }        │ ◀─── Comlink exposes this
     └──────────────────────────────┘
                │
                ▼
     ┌──────────────────────────────┐
     │      paintService.ts        │
     │ class PaintService { ... }  │
     └──────────────────────────────┘
                │
                ▼
          WebGL 캔버스 렌더링
```

---

## 🧱 1. WebWorker 통로 구성 요소

### 🔹 `workerpool.ts` – 메인에서 워커 연결

```ts
import WorkerModule from "./worker?worker";
import * as Comlink from "comlink";
import { workerApi } from "./paintController";

const worker = new WorkerModule();
const api = Comlink.wrap<WorkerApi>(worker);
```

- `?worker`: Vite/Webpack의 WebWorker loader 사용
- `Comlink.wrap(...)`: postMessage 수동 처리 없이 **함수 호출처럼 워커 메서드를 사용** 가능

### 🔹 `paintController.ts` – 워커에서 외부로 노출할 API 정의

```ts
export const workerApi = {
  makeLayer(...): void,
  render(...): void,
  setStrokeColor(...): void,
  ...
};
```

- `Comlink.expose(workerApi)` → `Comlink.wrap()`으로 감싸진 쪽에서 호출 가능
- 이 파일은 워커 내부에서 import되고, **메인 스레드에서 직접 접근 불가**

### 🔹 `paintService.ts` – 실질적인 로직

```ts
export class PaintService {
  constructor(canvas: OffscreenCanvas, ...) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2");
    ...
  }

  render(...) {
    renderScreen(this.canvas, this.gl, ...);
  }

  start(pointer) {
    this.getTool().start(pointer);
  }

  ...
}
```

- `PaintService`는 WebGL 전반을 컨트롤하며,  
  브러시, 유동화, 선택 등 모든 기능은 이 내부에서 매니저들을 호출해 처리함
- `paintController.ts`는 단지 이 클래스의 **Wrapper**

---

## 🖼️ 2. 캔버스 흐름 - OffscreenCanvas

```ts
paint.makeLayer(main_canvas, ...);
```

- 메인 스레드에서 `OffscreenCanvas`를 생성 → 워커에게 전달  
- 워커는 그걸 바탕으로 WebGL2 컨텍스트를 만들고, 모든 도구 초기화

```ts
let gl = canvas.getContext("webgl2");
await installTools(canvas, gl); // brush, eraser, liquify...
```

- 메인 스레드는 직접 렌더하지 않음
- **렌더링도 `workerApi.render()`를 통해 호출**

---

## 🧠 3. 렌더링 호출 흐름

### 예시: 사용자가 드래그하면...

```ts
workerApi.start({x, y});
workerApi.strokeTo({x2, y2});
workerApi.end();
```

- 내부적으로는
  - `getTool().start()`  
  - `getTool().stroke()`  
  - `getTool().end()` 가 호출됨
- `getTool()`은 현재 선택된 도구(`brush`, `eraser`, `liquify`)에 따라 매니저 선택

---

## ✂️ 4. 선택 영역: 클립보드 복사까지

### 예: 잘라내기 `cut()`

```ts
const { pixels, width, height } = selectionManager.getPixelData();
self.postMessage({ type: "copy", payload: { pixels, width, height } }, [pixels.buffer]);
```

- 워커는 **픽셀 데이터만 postMessage** → 메인 스레드에서 처리
- **워커 내부에서는 클립보드 API 접근 불가**
- 메인에서 `worker.onmessage = ...`을 통해 후처리

### 메인에서 받은 후:

```ts
// workerpool.ts
worker.onmessage = (e) => {
  if (e.data.type === "copy") {
    copyPixelsToClipboard(...);
  }
};
```

---

## 🛠️ 5. 도구 선택 로직

```ts
setTool(toolId: string) {
  if (this.toolId != toolId) {
    this.getTool().exit(); // 기존 도구 종료
  }
  this.toolId = toolId;
  this.getTool().enter(); // 새 도구 시작
}
```

- 유일하게 `select`는 제외 (`if (toolId == 'select') return`)
- 선택은 **별도 시스템**으로 구분되어 있어 Tool로 등록되어 있지 않음

---

## 🔌 6. 메인 스레드 호출 예시

```ts
const api = getLayerWorker();
await api.makeLayer(offscreen, ...); // 초기화
api.setTool("brush");
api.start({x: 100, y: 100});
api.strokeTo({x: 120, y: 110});
api.end();
api.render(...);
```

---

## 📍 7. 메모리 및 데이터 흐름 요약

| 항목 | 위치 | 설명 |
|------|------|------|
| `OffscreenCanvas` | Main → Worker 전달 | WebGL 컨텍스트 생성용 |
| `workerApi` | `paintController.ts` | 메인과 워커의 통신 인터페이스 |
| `PaintService` | `paintService.ts` | WebGL 전체 컨트롤 |
| `Tool`들 | `gl/tool/` | 각각 브러시, 유동화 등 구현 |
| `renderScreen` | `render.ts` | 확대/이동/선택 렌더링 |
| 픽셀 복사 | `getPixelData()` | 선택 영역을 읽어 Uint8Array로 복사 |
| 클립보드 저장 | Main에서 `copyPixelsToClipboard` 호출 | 워커에서는 못함 |

---

## 🚨 워커 개발 시 주의점

- 워커는 **DOM 접근 불가**
  - `document`, `canvas.toDataURL()` 사용 불가
- 클립보드는 **메인 스레드만**
- 워커 내에서도 `OffscreenCanvas`는 반드시 `webgl2` 컨텍스트로 생성
- `ImageBitmap` 등은 transferable 객체 (복사 없이 전달 가능)

---

## 🎯 정리: WebWorker 구조 키워드

| 키워드 | 요약 |
|--------|------|
| **Comlink** | postMessage → 함수 호출처럼 추상화 |
| **OffscreenCanvas** | 워커에서 WebGL 동작 가능 |
| **PaintService** | 렌더링 전체 책임 |
| **workerApi** | 메인 ↔ 워커 인터페이스 |
| **텍스처 & 프레임버퍼** | 모든 그림/선택은 GPU에서 처리 |
| **클립보드** | 픽셀 데이터만 워커 → 메인 전달 |

---

## 💡 추천 확장 방향

1. **멀티캔버스/멀티워커**  
   - 워커 풀을 확장해 레이어별로 별도 워커 처리 가능
2. **워커 히스토리 저장소 분리**  
   - 렌더/픽셀 처리만 워커 → 히스토리는 별도 워커 분기
3. **선택영역 외부연동**  
   - bitmap → base64 or Blob → 저장/공유 등

---

## 🧭 요약 로드맵

```
[Main Thread]
   └─ WorkerModule 생성
   └─ Comlink.wrap(worker) → workerApi

[Worker Thread]
   └─ paintController.ts → workerApi 노출
   └─ paintService.ts 내부에서 실제 WebGL 렌더 수행
   └─ 선택된 픽셀 전달은 postMessage

[픽셀 흐름]
   └─ 레이어/선택 → getPixelData()
   └─ pixels → postMessage → 메인 → 클립보드 저장
```

---

**이 문서로 WebWorker 구조도 완전히 마스터 완료.**  
이제 Worker를 기반으로한 툴 구현, 렌더, 클립보드까지 완벽히 만들 수 있다!  
곧바로 실전에 투입 가능합니다. 🔥
