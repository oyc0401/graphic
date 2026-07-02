import { paintState, ToolId } from "../paintState";
import {
  getPixelRatio,
  MAX_SCALE,
  MIN_SCALE,
  position,
  renderChangedPosition,
  setMagification,
  to_screen_coord,
} from "../position";
import { cssDeltaToScene } from "../utils/cameraMath";
import { clamp } from "../utils/math";

export function addWheelListener() {
  window.addEventListener(
    "wheel",
    (event) => {
      const ctrlKey = event.ctrlKey || event.metaKey;

      if (ctrlKey) {
        event.preventDefault();

        const clampedDelta = clamp(event.deltaY, -12, 12);
        const percent = -clampedDelta * 0.01 + 1;
        const new_mag = position.scale * percent;

        const clamped_scale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, new_mag),
        );
        setMagification(
          clamped_scale,
          to_screen_coord(event.clientX, event.clientY),
        );
      } else if (event.altKey) {
        const brushSize = paintState.getBrushSize();
        if (paintState.getSelectedToolId() === ToolId.FloodFill) {
          const delta = event.deltaY > 0 ? -1 : 1;
          paintState.setBrushSize(clamp(brushSize + delta, 0, 100));
          renderChangedPosition();
          return;
        }

        const percent =
          event.deltaY > 0 ? (brushSize - 1) / 1.1 : (brushSize + 1) * 1.1;
        const newSize = Math.round(clamp(percent, 1, 3000));
        paintState.setBrushSize(newSize);
      } else {
        const dpr = getPixelRatio();
        if (event.shiftKey && event.deltaX === 0) {
          position.setX(position.x - cssDeltaToScene(event.deltaY, position.scale, dpr));
          position.setY(position.y - cssDeltaToScene(event.deltaX, position.scale, dpr));
        } else {
          position.setX(position.x - cssDeltaToScene(event.deltaX, position.scale, dpr));
          position.setY(position.y - cssDeltaToScene(event.deltaY, position.scale, dpr));
        }
      }

      renderChangedPosition();
    },
    { passive: false },
  );
}
