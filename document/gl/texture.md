# 🎯 **`SourceTextureManager` 구조 완벽 가이드 (히스토리 연동용 분석)**

이 문서는 그림판의 핵심인 **원본 텍스처 관리 로직(`SourceTextureManager`)**을  
히스토리 기능을 개발할 때 완벽히 이해할 수 있도록 작성되었습니다.

---

## 🚩 **`SourceTextureManager`의 핵심 역할**

- **캔버스에서 현재 그림 상태를 복사**하여 원본 이미지를 저장해 둡니다.
- 작업 취소(`cancel`) 시, 저장된 원본 이미지를 복원하여 상태를 되돌립니다.

즉, 히스토리 구현 시 **이미지 복구의 핵심 역할**을 담당하는 매니저입니다.

---

## 🔑 **주요 데이터와 텍스처**

| 이름 | 설명 |
|------|------|
| `sourceTexture` | **현재 레이어의 이미지를 저장하는 원본 텍스처** |

- 이 텍스처는 항상 레이어의 최신 상태를 담고 있습니다.
- 이 상태를 히스토리에 저장하거나 복구할 때 사용됩니다.

---

## 🚧 **주요 함수 분석**

### 🔸 **`uploadCurrent()`**

```ts
function uploadCurrent() {
  gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.layerFBO);
  gl.bindTexture(gl.TEXTURE_2D, sourceTexture);

  // 텍스처를 빈 상태로 초기화 (메모리 확보용)
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    paintOptions.width,
    paintOptions.height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );

  // 현재 캔버스(layerFBO) 내용을 그대로 복사하여 sourceTexture에 저장
  gl.copyTexSubImage2D(
    gl.TEXTURE_2D,
    0,
    0, 0, // 저장할 위치 (좌측 상단)
    0, 0, // 복사 시작 좌표
    paintOptions.width,
    paintOptions.height,
  );
}
```

- 현재 캔버스의 모든 픽셀을 즉시 복사해서 원본 텍스처에 저장합니다.
- 이 작업은 **브러시나 유동화 작업 종료 시** 호출되어야 합니다. (히스토리 저장 시점)

### **언제 호출해야 하나?**
- 모든 **브러시나 liquify 작업 완료(`end()`) 후** 호출되어야 합니다.
- 히스토리에 저장하는 이미지 상태가 바로 이 시점에 `sourceTexture`에 담깁니다.

---

### 🔸 **`restore()`**

```ts
function restore() {
  gl.disable(gl.SCISSOR_TEST);
  gl.useProgram(cancelProgram);

  // 원본 텍스처 내용을 다시 레이어FBO에 렌더링하여 복원
  gl.bindFramebuffer(gl.FRAMEBUFFER, layerManager.layerFBO);
  gl.viewport(0, 0, paintOptions.width, paintOptions.height);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}
```

- 저장된 `sourceTexture`의 이미지를 현재 캔버스(layerFBO)에 다시 그려서 복구합니다.
- 이 함수는 사용자가 작업 취소(`cancel`)를 했을 때 호출됩니다.

### **언제 호출해야 하나?**
- 사용자가 **취소**(undo) 기능을 호출했을 때.
- 히스토리 스택에서 이전 상태를 복구해야 할 때.

---

## 🚨 **`cancelShader`의 용도**

- `cancelShader`는 간단한 역할로, `sourceTexture`의 이미지를 **단순히 화면으로 복사**하는 셰이더입니다.
- 따라서 특별한 연산 없이 단순히 텍스처 내용을 복원하는 역할입니다.

```glsl
// cancelShader의 핵심 로직
void main() {
  outColor = texture(u_sourse, v_texCoord);
}
```

---

## ♻️ **히스토리 구현 시 정확한 사용법 (중요!)**

히스토리 기능을 구현할 때는 이 매니저를 정확히 다음과 같이 활용합니다.

### 🔹 **히스토리 저장 (undo stack push)**

```ts
sourceTextureManager.uploadCurrent();
```

- 매 작업(브러시, 유동화 등)이 끝났을 때 호출합니다.
- 이때의 `sourceTexture`를 히스토리 스택에 별도의 텍스처로 복사하여 저장해도 됩니다.

### 🔹 **히스토리 복구 (undo stack pop)**

```ts
sourceTextureManager.restore();
```

- 이전 상태로 돌아갈 때 호출하여 레이어 상태를 복원합니다.

---

## 🖥️ **텍스처 유닛 정의**

`TEXTURE_UNIT`은 다음과 같이 정의되어 있습니다.

```ts
export const TEXTURE_UNIT = {
  TEMP: 0,
  LAYER: 1,
  SOURCE: 2, // 원본 텍스처
  PATHMAP: 3,
  DISPLACEMENT: 5,
  SOURCE_DISPLACEMENT: 6,
  EASE_INTEGRAL: 7,
  EASE_MIRROR: 8,
  SOURCE_SELECTION: 9,
  RENDERED_SELECTION: 10
};
```

- 원본 텍스처(`sourceTexture`)는 항상 **텍스처 유닛 2번**을 사용합니다.

---

## ✅ **최종 요약 (히스토리 연동을 위한 간단한 흐름)**

히스토리를 간단히 구현하려면 이 흐름만 기억하세요:

```
작업 완료(end) → sourceTextureManager.uploadCurrent() → 히스토리에 저장
취소 요청(cancel) → sourceTextureManager.restore() → 이전 상태 복원
```

- 이 구조를 그대로 사용하면, 브러시/유동화 등의 도구 변경과 관계없이  
  히스토리 기능을 완벽하고 쉽게 구현할 수 있습니다.

🎉 **이제 `SourceTextureManager`의 구조와 사용법을 완벽히 이해했습니다!**
