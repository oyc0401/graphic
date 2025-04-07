# 📖 **완벽 문서**  
이 문서는 지금까지 우리가 논의했던 **모든 WebGL 기반 페인트 에디터 코드 구조와 동작 원리**를  
히스토리 관점에 국한되지 않고 **전반적으로** 설명하여,  
**새로운 팀원이 이 코드를 보고 곧바로 실전에 투입될 수 있도록** 작성한 종합 가이드입니다.

> **목표 독자**:  
> - WebGL을 어느 정도 알고 있지만, 이 프로젝트 코드 구조는 처음인 분  
> - 히스토리 외에도 **툴(브러시, 선택, 유동화) 시스템**, **렌더링 파이프라인**, **레이어 & 텍스처 관리** 등 전부 빠르게 이해 필요

---

## 1. **전체 아키텍처 개요**

### 1.1 **파일 / 모듈 구조**

- **`texture.ts`**:  
  페인트 관련 **공통 옵션(`paintOptions`)**과 **원본 텍스처(`SourceTextureManager`)** 관리  
- **`layer.ts`**:  
  **최종 그림이 담기는 레이어 텍스처**와 **프레임버퍼**를 생성/관리  
- **`tool/brushTool.ts`**, **`tool/liquify.ts`**:  
  각각 **브러시**와 **유동화** 기능의 매니저(로직)와 인터페이스 제공  
- **`selection.ts`**:  
  **선택 영역**(잘라내기, 붙여넣기 등)을 담당하는 매니저  
- **`render.ts`** / **`renderingManager.ts`**:  
  **최종 스크린에 렌더링**하는 파이프라인 제어  
- **`utils` 폴더**:  
  WebGL 셰이더 프로그램 생성, 싱글톤 캐싱(`getManager`) 등 **공통 유틸** 모음  
- **`main.ts`** (또는 `index.ts` 등 진입점):  
  캔버스를 생성하고, **각 매니저를 설치**(`installTools`, etc) 후, UI 이벤트 연결

### 1.2 **매니저(Manager) 개념**

> **각 기능을 책임지는 "매니저"**들이 모여,  
> **도메인별(브러시, 유동화, 선택, 레이어, 렌더링)** 로직을 관리한다.

- **초기화**: `installXxxManager(...)` → **캐싱** → `getXxxManager(...)`  
  - 싱글톤 형태로 WebGL context(`gl`)마다 한 번만 생성
- **함수**: `start()`, `stroke()`, `render()`, `end()` 등 상황별 호출
- **상호 작용**:  
  - 예: 브러시 작업 → 알파맵 업데이트 → 실제 레이어에 블렌딩 → 렌더링  
  - 예: 선택 작업 → 선택 텍스처에 복사 → 레이어에 적용

---

## 2. **핵심 로직별 상세**

### 2.1 **레이어 시스템 (`layer.ts`)**

```ts
function makeLayerManager(canvas, gl) {
  let layerTex = ...
  let layerFBO = ...
  ...
  return { layerTex, layerFBO };
}
```

- **`layerTex`**: 최종 그림 데이터가 담기는 텍스처 (RGBA)  
- **`layerFBO`**: 이 텍스처에 그릴 수 있도록 묶은 프레임버퍼  
- **특징**:  
  - 브러시, 유동화, 선택 등 모든 그리기 연산의 최종 결과가 `layerTex`에 저장됨  
  - 히스토리, 취소, 리사이즈 시 이 텍스처에서 데이터를 읽고 쓴다

### 2.2 **원본 텍스처(`SourceTextureManager`, `texture.ts`)**

```ts
function makeSourceTextureManager(canvas, gl) {
  let sourceTexture = ...
  function uploadCurrent() { ... }
  function restore() { ... }
  ...
  return { texture: sourceTexture, uploadCurrent, restore };
}
```

- **`sourceTexture`**: 작업 완료 시점의 레이어 상태를 복사해두는 텍스처
- **`uploadCurrent()`**: `layerFBO`의 내용을 `sourceTexture`에 복사
- **`restore()`**: `sourceTexture` → `layerFBO`로 복원 (취소/Undo 등에 사용)

### 2.3 **브러시(`brushTool.ts`)**

```ts
class BrushTool implements Tool {
  stroke(p1, p2) {
    this.drawManager.stroke(p1, p2);
    this.drawManager.brush(); // 알파맵 → 레이어에 컬러 적용
  }
  ...
}
```

- 내부적으로 **`drawManager`**를 사용
  - `strokeShader`: 픽셀과 선분 거리 계산 → 브러시 알파맵 생성(AA 포함)
  - `brushShader`: 알파맵을 레이어에 실제 색으로 반영
- **특징**:  
  - MSAA/SSAA 기법, 거리 기반 feather, 알파맵 누적 등 **정교한 안티에일리어싱** 구현  
  - `end()` 시점을 통해 “브러시 확정” → `uploadCurrent()`로 원본 텍스처 갱신

### 2.4 **유동화(`liquify.ts`)**

```ts
class LiquifyTool implements Tool {
  stroke(p1, p2) {
    this.liquifyManager.push(p1, p2);
    this.liquifyManager.render();
  }
  ...
}
```

- **변위맵(`displacementTex`)**을 사용  
- `push()`: 사용자의 입력(마우스 이동)으로 변위 정보를 업데이트  
- `render()`: 변위맵을 레이어에 적용하여 픽셀 이동  
- **특징**:  
  - “브러시”와는 별개로, **픽셀 이동 변형**을 하는 복잡 로직  
  - 히스토리나 취소 시에는 변위맵을 **backup**(`sourceDisplacementTex`) → 복원

### 2.5 **선택(`selection.ts`)**

```ts
function createSelectionManager(...) {
  function select(...) { ... }
  function paste(...) { ... }
  function applySelection(...) { ... }
  function getPixelData(...) { ... }
  ...
  return { select, paste, applySelection, getPixelData, ... };
}
```

- 선택된 영역을 `selectionTex`에 복사 후, 레이어에선 지움
- (원본 크기, 혹은 변경된 크기) → `renderedSelectionTex`에 저장해서 배치
- **특징**:  
  - **UI에서 직접 드래그**해 선택 영역 조절  
  - 히스토리 복원 시, **위치(x, y) / 크기(width, height) / 텍스처 데이터** 모두 복원  
  - 붙여넣기(paste)도 외부 이미지 → `selectionTex` → `renderedSelectionTex`

### 2.6 **렌더링(`renderingManager.ts`)**

```ts
function render() {
  renderDisplay();    // 배경 격자
  renderBackground(); // 캔버스 내부 흰배경
  renderTexture();    // layerTex 표시
  if (paintOptions.showSelection) {
    renderSelection();
  }
}
```

- 여러 셰이더를 이용해 **단계별로** 화면에 그려준다.
- **겹치는 순서**:
  1. **Display**: 전체 격자  
  2. **Background**: 캔버스 내부 영역  
  3. **Texture**: 최종 레이어 (그림)  
  4. **Selection**: 선택 영역 이미지 (있다면)  
- **`renderScreen(...)`**: 사이즈/배율 설정, 레이어 리사이즈 등도 함께 처리

---

## 3. **주요 GL 개념 및 데이터 흐름**

### 3.1 **프레임버퍼(FBO) → 텍스처 → 스크린**

1. **FBO** + **텍스처**  
   - `layerFBO`에 그리면 → `layerTex`가 업데이트  
2. **RenderingManager**  
   - 최종 단계에서 **화면(기본 Framebuffer)** 에 **`layerTex`**를 그려준다.  
   - 필요 시 **선택 텍스처** 등도 겹쳐 그림

### 3.2 **텍스처 유닛(`TEXTURE_UNIT`)**

```ts
export const TEXTURE_UNIT = {
  TEMP: 0,
  LAYER: 1, // layerTex
  SOURCE: 2, // sourceTexture
  ...
}
```

- GPU가 텍스처를 여러 장 동시에 다룰 수 있도록, **"슬롯"**을 구분  
- 각 매니저는 **고유 번호**를 사용해 텍스처를 바인딩함

### 3.3 **매니저 간 협업**

- **LayerManager**: 최종 그림이 담길 텍스처  
- **SourceTextureManager**: 현재 그림 스냅샷/복원용 텍스처  
- **SelectionManager**: 선택된 영역 텍스처, 붙여넣기 등  
- **BrushManager**: 브러시 알파맵 → 레이어에 블렌딩  
- **LiquifyManager**: 변위맵 → 레이어 픽셀 이동  
- **RenderingManager**: 최종 단계(디스플레이 + 배경 + 레이어 + 선택) 스크린에 렌더

---

## 4. **실전 사용 흐름 (예시)**

1. **사용자가 브러시 도구로 그림**  
   - `BrushTool.start()` → `stroke()`(여러 번) → `end()`  
   - 내부적으로 **알파맵 생성** + **레이어에 색 적용**  
   - 마지막에 `uploadCurrent()` → **원본 텍스처 스냅샷** 저장  
2. **선택창 활성화**  
   - `SelectionManager.select(...)` → 특정 부분을 떼어 `selectionTex`에 복사  
   - `applySelection()` → 레이어 병합 시점에 다시 그려넣음  
3. **유동화(Liquify)**  
   - `LiquifyTool.start()` → `push()`(여러 번) → `end()`  
   - 변위맵에 사용자 입력 누적 → `render()`로 레이어 변형  
   - `uploadCurrent()`로 스냅샷 갱신  
4. **렌더**  
   - `renderingManager.render()`  
   - 순서: Display(격자) → Background(흰배경) → Texture(layerTex) → 선택창(있다면)

---

## 5. **확대/축소 & 이동**

- `paintOptions.magnification` (배율)  
- `paintOptions.x, y` (캔버스 화면 위치)  
- **RenderingManager** 셰이더에서 `(0~1)` 정규화 좌표 → 스크린 픽셀로 변환 → 영역 안인지 체크  
  - `discard`로 경계 밖은 그리지 않음
- **나중**에 UI 이벤트(마우스 휠, 드래그 등)와 연결 가능

---

## 6. **응용 & 확장 포인트**

1. **히스토리/Undo/Redo**  
   - 지금까지 **모든 매니저**는 “현재 상태”를 유지하는 구조  
   - Undo/Redo = 이전 상태를 텍스처나 데이터로 **저장**하고 **복원**  
   - **핵심**:  
     - 레이어Tex (`layerFBO`) → **이미지 픽셀**  
     - 변위맵(`displacementTex`)  
     - 선택창 위치/크기/이미지  
     - 브러시 알파맵은 실시간 생성이므로, Undo 시에는 레이어 상태만 복원

2. **여러 레이어**  
   - 지금은 `layerTex` 하나만.  
   - 여러 레이어를 만들려면 `layerTex`를 **배열**로 관리 + 레이어별 blending

3. **고급 브러시**  
   - 텍스처 브러시, 동적 브러시, 압력 대응 → MSAA 기법 + distance field + custom 셰이더

4. **고급 유동화**  
   - FFT 기반 흐림 or GPU buffer 연산 → 성능 우려  
   - **현재** 구조도 변위맵만 교체하면 다른 변형도 시도 가능

5. **Selection 2.0**  
   - 자유곡선 라소, 다각형 선택, 알파 마스크 등 확장

---

## 7. **주의 & 팁**

- **반드시 프레임버퍼 상태**(bindFramebuffer)와 **텍스처 활성**(activeTexture)에 주의  
- `copyTexSubImage2D`나 `blitFramebuffer` 시 **소스/목적 FBO** 변경을 잘 관리  
- **오버드로우**(blend) 시 성능 문제 발생 가능 → 필요하다면 scissor test 활용
- **동적 해상도 변경** 시 `resizeTexture()`처럼 **임시 텍스처**를 이용해 안전하게 복사해야 기존 데이터 안 날아감

---

## 8. **결론: 정리**

이 코드베이스는 **매니저(Manager) 구조**를 통해 모듈별 책임을 분리하고,  
**WebGL 텍스처/FBO**를 중심으로 **픽셀 데이터**를 주고받으며,  
**렌더링 시 단계별 셰이더**로 출력한다.

- **브러시**: 알파맵 → 레이어  
- **유동화**: 변위맵 → 레이어  
- **선택**: 부분 픽셀 떼어내어 텍스처 저장, 재배치  
- **레이어**: 최종 그림, FBO  
- **원본 텍스처**: 업로드/복원  
- **렌더링**: 배경 + 레이어 + 선택창까지 화면 표시

**히스토리 외에도**,  
**툴 확장, UI 개선, 성능 최적화** 등 모든 기능을 손쉽게 이어나갈 수 있는 구조임.

---

## 9. **마무리**

**이 문서를 통해**:

1. **Manager**간 협력 구조와 싱글톤 패턴을 이해  
2. **텍스처 & FBO** 흐름, **셰이더** 역할 파악  
3. **브러시, 유동화, 선택, 레이어, 렌더링**의 세부 로직  
4. **확대/축소, Undo/Redo, 리사이즈** 등 실무 기능 구현 방법

를 전부 알 수 있습니다.

**환영합니다!**  
이제 이 코드베이스에 추가 기능이나 개선을 하더라도,  
해당 모듈 및 매니저의 **역할**과 **데이터 흐름**만 파악하면  
곧바로 투입되어 고품질 개발을 할 수 있을 것입니다. 🎉

