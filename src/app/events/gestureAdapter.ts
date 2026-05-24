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
  let gestureScale = position.scale / pixelRatio;
  let gestureX = position.x * gestureScale;
  let gestureY = position.y * gestureScale;

  return new GestureModule({
    element,
    position: {
      x: gestureX,
      y: gestureY,
      scale: gestureScale,
    },
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
      gestureX = x;
      gestureY = y;
      gestureScale = scale;

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
