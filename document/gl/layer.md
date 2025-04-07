# 🎨 LayerManager 구조 완벽 해설 (히스토리 연동용 분석)

이 문서는 **캔버스의 최종 이미지 출력 결과를 담는 레이어 시스템**인 `LayerManager`의 구조를  
히스토리 기능 개발자가 정확히 이해할 수 있도록 상세히 설명합니다.

---

## 🧠 LayerManager의 핵심 역할

`LayerManager`는 **최종 브러시 결과가 저장되는 텍스처(`layerTex`)와**  
**거기에 렌더링하기 위한 프레임버퍼(`layerFBO`)를 관리**합니다.

---

## 🔁 getLayerManager(canvas, gl)

```ts
const manager = getManager(gl, "layer", () => makeLayerManager(canvas, gl));
```

- **싱글톤 패턴**입니다. `gl`마다 `"layer"` 키로 한 번만 생성됩니다.
- 내부적으로 `makeLayerManager()`를 호출하여 텍스처와 FBO를 생성합니다.

---

## 🧱 makeLayerManager(canvas, gl)

이 함수의 역할은 딱 두 가지입니다:

1. **최종 이미지가 저장될 레이어 텍스처 생성**
2. **이 텍스처에 렌더링할 수 있도록 FBO(FrameBuffer Object) 생성**

---

## 🔹 레이어 텍스처 (`layerTex`) 설정

```ts
let layerTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, layerTex);
```

### 🧩 텍스처 파라미터 설정

```ts
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
```

- **MIN_FILTER: LINEAR** → 축소 시 부드럽게 보간
- **MAG_FILTER: NEAREST** → 확대 시 뭉개짐 없이 날카롭게

```ts
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
```

- **테두리 좌표가 0~1을 벗어나도 에지 반복 없음**

### 🧩 텍스처 이미지 초기화

```ts
gl.texImage2D(..., paintOptions.width, paintOptions.height, ..., null);
```

- **RGBA** 텍스처, `UNSIGNED_BYTE` 타입, **초기 내용 없음**
- 이 텍스처가 **실제 사용자 브러시 결과가 저장되는 최종 레이어**가 됨

---

## 🔹 레이어 프레임버퍼 (`layerFBO`) 설정

```ts
let layerFBO = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, layerFBO);
gl.framebufferTexture2D(..., layerTex, ...);
```

- `layerFBO`는 `layerTex`를 렌더링 타겟으로 바인딩한 FBO입니다.
- 즉, 이 프레임버퍼에 그리면 결과는 곧바로 `layerTex`에 반영됩니다.

---

## 🧼 초기화

```ts
gl.viewport(0, 0, paintOptions.width, paintOptions.height);
gl.clearColor(0, 0, 0, 0.0);
gl.clear(gl.COLOR_BUFFER_BIT);
```

- 캔버스 영역을 초기화
- 초기 `layerTex` 내용은 투명한 상태 (RGBA = [0, 0, 0, 0])

---

## ✅ 반환 객체

```ts
return {
  layerTex,  // 최종 이미지가 담긴 텍스처
  layerFBO,  // 여기에 그리면 위 텍스처가 갱신됨
};
```

- 이 객체는 `drawManager`, `LiquifyManager`, `renderingManager` 등에서 사용됩니다.
- 브러시나 유동화 등 모든 결과는 **이 `layerFBO`를 타겟으로 렌더링됩니다.**

---

## 🧠 히스토리 개발자가 알아야 할 포인트

### ✅ 어디에 그려지나?
→ 브러시나 유동화 등 도구는 최종적으로 `layerFBO`에 `gl.drawArrays()`로 결과를 렌더링합니다.

### ✅ 무엇을 저장해야 하나?
→ 히스토리 저장 시에는 `layerTex`의 내용을 캡처하여 저장하면 됩니다.

- WebGL에서는 `gl.readPixels()` 또는 `gl.copyTexImage2D()`를 사용해 복사 가능
- 또는 `layerTex` 자체를 백업용 텍스처에 `blitFramebuffer()`로 복사할 수도 있음

### ✅ 복원은 어떻게 하나?
→ 저장해둔 `layerTex` 백업을 다시 `layerFBO`에 붙이거나, 복사해서 덮어씌우면 됩니다.

---

## ✨ 한 줄 요약

> **LayerManager는 최종 이미지 결과가 저장되는 렌더 타겟(FBO + 텍스처)이며, 히스토리 기능은 이 텍스처를 저장하고 복원하면 완성됩니다.**

🎉 이제 이 구조를 이해하면, 이미지 상태 저장/복원 히스토리를 완벽하게 구현할 수 있습니다!
