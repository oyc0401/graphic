import { GestureModule } from "./gesture";
import { dispatchPointer } from "./dispatchPointer";
import { redo, undo } from "../history";
import { InputMode, paintState } from "../paintState";
import {
  getPixelRatio,
  MAX_SCALE,
  MIN_SCALE,
  position,
  renderChangedPosition,
} from "../position";

export function installGestureAdapter(element: HTMLElement) {
  const pixelRatio = getPixelRatio();

  // app 카메라(scene px, dpr 배율) → gesture 좌표계(컨테이너 CSS px) 변환.
  // gesture 공간: local = scene * gScale + gXY, gScale = scale/dpr
  const toGesturePosition = () => {
    const gestureScale = position.scale / pixelRatio;
    return {
      x: position.x * gestureScale,
      y: position.y * gestureScale,
      scale: gestureScale,
    };
  };

  return new GestureModule({
    element,
    getPosition: toGesturePosition,
    minScale: MIN_SCALE / pixelRatio,
    maxScale: MAX_SCALE / pixelRatio,
    onPointerdown: (event) => {
      paintState.setPointerdown(true);
      dispatchPointer(event, "down");
    },
    onPointermove: (event) => {
      dispatchPointer(event, "move");
    },
    onPointerup: (event) => {
      paintState.setPointerdown(false);
      dispatchPointer(event, "up");
    },
    onPointercancel: (event) => {
      paintState.setPointerdown(false);
      dispatchPointer(event, "cancel");
    },
    sceneChanged: (x, y, scale) => {
      position.setX(x / scale);
      position.setY(y / scale);
      position.setScale(scale * pixelRatio);
      renderChangedPosition();
    },
    onPinchStart: () => {
      paintState.setPointerdown(false);
      paintState.setShowBrushCursor(false);
      paintState.setInputMode(InputMode.Pinch);
    },
    onPinchEnd: () => {
      if (paintState.getInputMode() === InputMode.Pinch) {
        paintState.setInputMode(InputMode.DEFAULT);
      }
    },
    onTwoFingerTap: () => {
      undo();
    },
    onThreeFingerTap: () => {
      redo();
    },
    onTwoFingerDoubleTap: () => {},
    onThreeFingerDoubleTap: () => {},
  });
}
