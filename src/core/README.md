# WebGL2Controller

`PaintApplication.install()`이 반환하는 객체입니다. 그리기, 선택, 히스토리 등 모든 페인트 작업을 이 controller를 통해 호출합니다.

좌표는 별도 명시가 없는 한 **이미지 좌표계**(픽셀 단위, 좌상단이 원점)를 사용합니다.

---

## Lifecycle

### destroy

Controller가 사용하는 리소스를 정리합니다. 더 이상 사용하지 않을 때 호출하세요.

```ts
destroy(): void
```

### isInitialized

Controller가 사용 가능한 상태인지 반환합니다.

```ts
isInitialized(): boolean
```

---

## Rendering

### render

현재 상태를 화면에 다시 그립니다. 상태를 바꾸는 API를 호출한 뒤 화면을 갱신하려면 이 메서드를 호출해야 합니다.

```ts
render(): void
```

### resizeScreenSize

화면에 보이는 작업 영역의 크기를 변경합니다. CSS 크기가 아닌 실제 픽셀 크기(CSS 크기 × dpr)를 넘기세요.

```ts
resizeScreenSize(screenWidth: number, screenHeight: number): void
```

- `screenWidth` — 화면의 실제 픽셀 너비.
- `screenHeight` — 화면의 실제 픽셀 높이.

### setCameraPosition

카메라의 위치와 확대 비율을 변경합니다.

```ts
setCameraPosition(px: number, py: number, magnification: number): void
```

- `px`, `py` — 카메라가 바라보는 위치 (이미지 좌표계).
- `magnification` — 확대 비율. 값이 클수록 크게 보입니다.

---

## Layer

### setLayerId

이후 그리기와 편집이 적용될 레이어를 선택합니다.

```ts
setLayerId(layerId: string | number): void
```

### resizeLayer

현재 레이어의 위치와 크기를 변경합니다.

```ts
resizeLayer(px: number, py: number, width: number, height: number): void
```

- `px`, `py` — 새 좌상단 위치 (이미지 좌표계).
- `width`, `height` — 새 픽셀 크기.

### resetImage

작업 이미지를 비우고 지정한 크기로 새로 시작합니다.

```ts
resetImage(width: number, height: number): void
```

---

## Tool

### setTool

현재 사용 도구를 변경합니다 (브러시, 지우개, 선택 등).

```ts
setTool(toolId: CoreTool): void
```

### setStrokeColor

브러시 색상을 설정합니다. 각 채널은 0–255 범위입니다.

```ts
setStrokeColor(r: number, g: number, b: number): void
```

### setStrokeSize

브러시 두께를 픽셀 단위로 설정합니다.

```ts
setStrokeSize(size: number): void
```

### setAlpha

브러시 불투명도를 0–100 범위로 설정합니다.

```ts
setAlpha(alpha: number): void
```

---

## Stroke

포인터 이벤트를 controller에 그대로 전달해 한 번의 획(stroke)을 만듭니다.  
일반적인 흐름: `start` → `strokeTo` (반복) → `end` 또는 `cancel`.

### start

획을 시작합니다.

```ts
start(p: Pointer): void
```

### strokeTo

현재 획을 새 위치까지 이어갑니다.

```ts
strokeTo(p: Pointer): void
```

### end

현재 획을 완료하고 이미지에 확정합니다.

```ts
end(): void
```

### cancel

현재 획을 버리고 종료합니다.

```ts
cancel(): void
```

---

## Session

세션은 픽셀 유동화처럼 **확정 전까지 미리보기로 편집**하는 작업 모드입니다.  
`openSession` → 편집 → `commitSession` 또는 `discardSession`.

### openSession

세션을 시작합니다.

```ts
openSession(toolId: CoreSessionTool): void
```

### commitSession

세션의 편집 결과를 이미지에 확정합니다.

```ts
commitSession(): void
```

### discardSession

세션의 편집 결과를 버립니다.

```ts
discardSession(): void
```

---

## Selection

선택 영역에 대한 작업 흐름:  
`createSelection` → (선택사항) `transformSelection` → `completeTransformSelection` → `commitSelection`.

### createSelection

이미지의 사각형 영역을 선택합니다.

```ts
createSelection(px: number, py: number, w: number, h: number): void
```

- `px`, `py` — 좌상단 위치 (이미지 좌표계).
- `w`, `h` — 영역의 픽셀 크기.

### transformSelection

선택 영역의 위치와 크기를 변경하거나 뒤집습니다. 호출할 때마다 미리보기가 갱신됩니다.

```ts
transformSelection(
  px: number,
  py: number,
  width: number,
  height: number,
  flipH?: boolean,
  flipV?: boolean,
): void
```

- `flipH`, `flipV` — 좌우/상하 반전. 기본값 `false`.

### completeTransformSelection

진행 중인 변형 작업을 마치고 선택 영역의 상태를 고정합니다.

```ts
completeTransformSelection(): void
```

### commitSelection

선택 영역에 적용된 모든 변경(이동, 변형, 붙여넣기 등)을 이미지에 확정합니다.

```ts
commitSelection(): void
```

### deleteSelection

선택 영역의 픽셀을 지웁니다.

```ts
deleteSelection(): void
```

---

## Image I/O

### uploadImage

외부 이미지를 현재 작업 이미지로 불러옵니다.

```ts
uploadImage(bitmap: ImageBitmap): void
```

### downloadImage

전체 이미지의 픽셀 데이터를 가져옵니다. 저장이나 내보내기에 사용합니다.

```ts
downloadImage(): PixelData
```

### paste

외부 이미지를 지정한 영역에 붙여넣습니다. 결과는 선택 영역으로 다뤄지므로 `commitSelection`을 호출해야 확정됩니다.

```ts
paste(
  px: number,
  py: number,
  width: number,
  height: number,
  imageBitmap: ImageBitmap,
): void
```

### cut

현재 선택 영역을 이미지에서 잘라내고 그 픽셀 데이터를 반환합니다.

```ts
cut(): PixelData
```

### getSelectionPixel

현재 선택 영역의 픽셀 데이터를 복사해 반환합니다 (이미지는 변경되지 않습니다).

```ts
getSelectionPixel(): PixelData
```

### sampleColor

이미지의 지정한 픽셀 위치에서 색상을 가져옵니다.

```ts
sampleColor(px: number, py: number): { r: number; g: number; b: number }
```

---

## History

### undo

마지막으로 확정한 작업을 되돌립니다. 되돌릴 작업이 없으면 `null`을 반환합니다.

```ts
undo(): Promise<HistoryResponse | null>
```

### redo

되돌렸던 작업을 다시 적용합니다. 다시 적용할 작업이 없으면 `null`을 반환합니다.

```ts
redo(): Promise<HistoryResponse | null>
```

### getHistoryCount

되돌리기/다시 적용 가능한 작업 개수를 반환합니다.

```ts
getHistoryCount(): { undoCount: number; redoCount: number }
```

---

## Types

```ts
interface PixelData {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}

interface HistoryResponse {
  undoCount: number;
  redoCount: number;
  selection?: {
    show: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    flipH?: boolean;
    flipV?: boolean;
  };
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

type CoreTool = "brush" | "eraser" | "selection" | /* ... */;
type CoreSessionTool = "liquify" | /* ... */;
```
