````markdown
# install

Core 엔진을 초기화하고 paint controller를 반환합니다. 다른 API를 호출하기 전에 반드시 한 번 호출해야 합니다.

## Signature

```ts
PaintApplication.install(
  main_canvas: OffscreenCanvas,
  screenWidth: number,
  screenHeight: number,
  dpr: number,
  width: number,
  height: number,
  px: number,
  py: number,
  scale: number,
): Promise<WebGL2Controller>
```

## Parameters

| Name | Type | Description |
| --- | --- | --- |
| `main_canvas` | `OffscreenCanvas` | 렌더링에 사용할 캔버스. `<canvas>`에서 `transferControlToOffscreen()`으로 생성합니다. |
| `screenWidth` | `number` | 화면의 실제 픽셀 너비 (CSS 너비 × dpr). |
| `screenHeight` | `number` | 화면의 실제 픽셀 높이 (CSS 높이 × dpr). |
| `dpr` | `number` | 디스플레이 픽셀 비율. 보통 `window.devicePixelRatio`. |
| `width` | `number` | 작업 이미지의 픽셀 너비. |
| `height` | `number` | 작업 이미지의 픽셀 높이. |
| `px` | `number` | 초기 카메라 X 위치 (이미지 좌표계). |
| `py` | `number` | 초기 카메라 Y 위치 (이미지 좌표계). |
| `scale` | `number` | 초기 확대 비율. 값이 클수록 크게 보입니다. |

## Returns

`Promise<WebGL2Controller>` — 그리기, 선택, 히스토리 등을 제어하는 controller. Promise가 resolve된 후에 사용하세요.

## Example

```ts
import { PaintApplication } from "@/core/PaintApplication";

const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!;
const dpr = window.devicePixelRatio || 1;

const paint = await PaintApplication.install(
  canvas.transferControlToOffscreen(),
  Math.round(canvas.clientWidth * dpr),
  Math.round(canvas.clientHeight * dpr),
  dpr,
  1024, 768,  // image size
  0, 0, 1,    // camera x, y, scale
);

paint.setTool("brush");
paint.setStrokeColor(0, 0, 0);
paint.render();
```

## Notes

- `main_canvas.width/height`는 내부에서 `screenWidth/screenHeight`로 설정됩니다.
- 초기화 이후 카메라는 `paint.setCameraPosition(px, py, scale)`로 변경할 수 있습니다.
````