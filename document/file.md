# 📋 클립보드 시스템 전체 흐름 (Clipboard Integration System)

이 모듈은 브라우저의 `Clipboard API`, `Drag and Drop`, `createImageBitmap`, `OffscreenCanvas`, `WebWorker`, `WebGL2`까지 **다양한 브라우저 기능을 통합**하여, **복사/붙여넣기/잘라내기/드래그앤드롭** 등 이미지 데이터를 완전하게 다루도록 구성되어 있습니다.

---

## 💡 전체 흐름 요약

```
[사용자 조작: Drag | Ctrl+V | Ctrl+C | Ctrl+X]
      ↓
[createImageBitmap 또는 WebWorker 호출]
      ↓
[makeSelectionFromBitmap or worker.copy()]
      ↓
[Selection창 반영 or 픽셀 전송]
      ↓
[copyPixelsToClipboard() → PNG → Clipboard API로 이미지 복사]
```

---

## 🧲 기능별 핵심 로직

### 1. Drag & Drop

```ts
elementStore.container.addEventListener("drop", async (e) => {
  const file = e.dataTransfer.files[0];
  const bitmap = await createImageBitmap(file, ...);
  makeSelectionFromBitmap(bitmap);
});
```

- 이미지 파일만 허용 (`image/`)
- `ImageBitmap`으로 변환 후 붙여넣기 처리

---

### 2. 붙여넣기 (`Ctrl+V`, ⌘+V)

```ts
window.addEventListener("paste", async (e) => {
  const bitmap = await createImageBitmap(blob);
  makeSelectionFromBitmap(bitmap);
});
```

- `clipboardData.items`에서 이미지 Blob 추출
- 붙여넣기 시 `selectionArea`에 자동 배치

---

### 3. 복사 (`Ctrl+C`, ⌘+C)

```ts
window.addEventListener("copy", () => {
  getLayerWorker().copy(); // WebWorker에서 선택된 픽셀 추출
});
```

### 4. 잘라내기 (`Ctrl+X`, ⌘+X)

```ts
window.addEventListener("cut", () => {
  getLayerWorker().cut();         // 픽셀 추출 후 잘라냄
  cutSelection();                 // selection 창 숨김 처리
});
```

---

## 🚀 핵심 전송 흐름

### 1. WebWorker → Main Thread

```ts
// paintService.ts 내부
self.postMessage({
  type: "copy",
  payload: { pixels, width, height },
}, [pixels.buffer]);
```

### 2. Main Thread 처리

```ts
worker.onmessage = (e) => {
  if (e.data.type === "copy") {
    copyPixelsToClipboard(e.data.payload.pixels, width, height);
  }
};
```

---

## 🧪 이미지 클립보드 복사 방식

### 1. PNG 인코딩

```ts
const pngData = encode({ width, height, data: pixels });
```

- `fast-png` 라이브러리를 사용한 **raw RGBA → PNG 변환**

### 2. Clipboard API 사용

```ts
const blob = new Blob([pngData], { type: "image/png" });
await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
```

> **지원 조건:** HTTPS 환경 + 유저 제스처 내에서 실행

---

## 📦 기능 모듈화 구조

| 기능           | 처리 위치                     |
|----------------|------------------------------|
| drop / paste   | Main Thread (DOM 이벤트)     |
| copy / cut     | WebWorker 내부 수행           |
| 이미지 붙여넣기 | `makeSelectionFromBitmap()` |
| 클립보드 복사   | `copyPixelsToClipboard()`    |

---

## ✅ 요약

| 이벤트 | 처리 내용 |
|--------|-----------|
| `drop` | 이미지 Drag → 붙여넣기 |
| `paste` | 클립보드 이미지 붙여넣기 |
| `copy` | 선택된 영역 PNG로 클립보드 복사 |
| `cut` | 선택된 영역 잘라내고 클립보드 복사 |
| `ImageBitmap` | `flipY + premultiplyAlpha` 설정으로 정확한 GPU 표시 일치 |
| `ClipboardItem` | 이미지 클립보드 붙여넣기 완벽 지원 (크롬/엣지/사파리 최신) |

---

## 🧠 확장 아이디어

- [ ] 텍스트도 클립보드로 넣거나 추출하는 기능
- [ ] `dragstart`, `dragend`로 외부 드래그 지원 (파일로 추출)
- [ ] 붙여넣은 이미지 자동 레이어 생성

---

이 시스템은 앞으로 **히스토리 복원, 선택창 붙여넣기, 이미지 삽입 API** 등과 자연스럽게 연결되며, **전문적인 이미지 편집기**의 기반으로 확장 가능합니다.
