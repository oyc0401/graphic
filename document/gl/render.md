# 🖥️ RenderingManager 완벽 설명서 (히스토리 연동 및 전체 UI 컨텍스트 렌더링 포함)

이 문서는 WebGL 기반 페인팅 툴에서 **캔버스, 확대/축소, 선택창, 배경 격자, 유저 작업 결과까지 모두 그려주는 핵심 모듈**  
`RenderingManager`에 대해 히스토리 구현자와 UI/툴 시스템 통합 개발자를 위한 전부를 설명합니다.

---

## 📌 RenderingManager의 핵심 역할

`RenderingManager`는 다음 요소를 실제 스크린(Canvas)에 그려주는 최상단 렌더링 컨트롤러입니다.

| 렌더링 요소        | 설명 |
|------------------|------|
| Display (격자 배경) | 확대/축소 가능한 체스판 스타일 배경 |
| Background       | 캔버스 뒷배경 (흰색/불투명/연한 회색 등) |
| Texture (Layer)  | 실제 사용자 작업 결과 (brush, liquify 등) |
| Selection        | 현재 선택창에 담긴 이미지 |

---

## 🎯 render() 호출 시 전체 흐름

```ts
render() {
  renderDisplay();
  renderBackground();
  renderTexture();
  if (paintOptions.showSelection) {
    renderSelection();
  }
}
```

각 함수의 역할은 아래에서 설명합니다.

---

## 🧱 1. renderDisplay() – 격자 배경

- 화면 전체에 확대 가능한 격자 (그리드 셀) 표시
- 백그라운드 체크무늬를 표시하거나, 사용자가 아무 것도 안 그렸을 때의 시각적 안내

```glsl
float modX = mod(px, cellSize);
if (modX < borderSize) {
  outColor = 밝은 테두리 색상
} else {
  outColor = 기본 셀 배경 색상
}
```

---

## 🧱 2. renderBackground() – 캔버스 뒷배경

- **캔버스 범위에만** 흰색 배경을 칠함 (`discard`로 경계 밖 무시)
- 화면 전체가 아니라 **캔버스 크기만** 대상으로 함

```glsl
if (scaledFragCoord.x < min.x || ...) discard;

outColor = vec4(1.0, 1.0, 1.0, 1.0); // 완전 흰색
```

---

## 🧱 3. renderTexture() – 실제 레이어 출력

- **사용자가 그린 모든 결과**가 들어있는 `layerTex`를 화면에 표시
- 확대/축소, 위치 이동을 지원하는 월드 좌표 매핑이 핵심
- `TEXTURE_UNIT.LAYER`의 내용을 화면 중심에 표시

```glsl
vec2 local = (scaledFragCoord - min) / size;
vec4 imageColor = texture(u_sourse, local);
```

---

## 🧱 4. renderSelection() – 선택창 렌더링

- 현재 선택된 이미지가 존재한다면 `renderedSelectionTex`를 그대로 렌더링
- 캔버스 위 특정 위치에 선택 영역을 배치
- 투명도 및 알파 채널 포함된 정확한 결과를 화면에 보여줌

```glsl
if (scaledFragCoord not inside selection) discard;
vec2 local = (scaledFragCoord - min) / size;
outColor = texture(u_selection, local);
```

---

## 🔧 renderScreen(...) – 화면 크기 및 캔버스 크기 변경 시 호출

- `paintOptions` 설정 갱신
- `resizeTexture()`로 기존 텍스처 크기를 재조정
- 텍스처를 새로 만든 후 기존 레이어 내용을 **보존한 채로** 붙여넣음 (blit + copy)

```ts
resizeTexture(canvas, gl, oldWidth, oldHeight, newWidth, newHeight);
```

내부적으로 다음을 처리:
- TEMP 텍스처 생성
- FBO로 연결 후 `layerTex` 내용을 blit 복사
- `layerTex`를 새 크기로 할당
- `copyTexSubImage2D`로 내용 복사 후 TEMP 텍스처 삭제

---

## ✅ 히스토리 구현자가 알아야 할 포인트

### ✅ 어떤 텍스처가 화면에 보이는가?

- **최종 출력은 `layerTex`**
  → 유저가 브러시, 유동화, 붙여넣기 등으로 작업한 모든 결과가 여기에 저장됨

- **선택창이 있을 경우 `renderedSelectionTex`**가 `layerTex` 위에 렌더링됨

---

### ✅ 선택 영역이 포함된 상태에서 Undo/Redo?

- **`paintOptions.showSelection`**이 `true`일 때만 선택창이 표시됩니다.
- 히스토리에는 반드시 `renderedSelectionTex`에 들어있는 이미지 데이터, 위치(`x, y`), 크기(`width, height`)를 함께 저장해야 함

---

### ✅ 리사이즈 처리의 핵심

- 캔버스 크기 변경 시, 기존 데이터를 잃지 않고 **새 텍스처로 복사해서 유지**해야 합니다.
- 단순 `gl.texImage2D()`만 하면 데이터가 날아가기 때문에, `resizeTexture()`에서 `blitFramebuffer + copyTexSubImage2D`를 이용해 유지하고 있음.

---

## 📦 텍스처 정리

| 텍스처명             | 내용                                |
|----------------------|-------------------------------------|
| `layerTex`           | 최종 그려진 사용자 작업 결과        |
| `renderedSelectionTex` | 화면에 보여지는 선택창 이미지        |
| `selectionTex`       | 선택 원본 이미지                    |
| `sourceTexture`      | 원본 레이어 (히스토리나 취소용)     |

---

## 🧠 한줄 요약

> `RenderingManager`는 격자 배경, 캔버스 배경, 실제 작업 이미지, 선택창까지 모든 화면 요소를 정확히 계산하여 화면에 출력하는 핵심 컨트롤러이다. 히스토리 복원 시 `layerTex`, 선택 이미지(`renderedSelectionTex`), 위치, 크기를 기반으로 완벽히 복원 가능하다.

```ts
render(); // 위 4가지 요소를 순서대로 스크린에 렌더링함
```

--- 

🎉 **이제 렌더링 구조를 완벽하게 이해했으니, 화면 복원, Undo/Redo 구현, 확대/이동 대응까지 완벽히 구현할 수 있습니다!**
