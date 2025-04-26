/** keyboard.ts */
import { paintState } from "../paintState";
import { cancel, toolManager } from "../draw";
import { applySelection, canvasSelect, selectionDelete } from "../selection";
import {
  MAX_SCALE,
  MIN_SCALE,
  position,
  renderChangedPosition,
  setMagification,
  to_screen_coord,
} from "../position";
import { clamp } from "../utils/math";

function addWheelListener() {
  /**
   * 휠 스크롤 영역
   */
  (function () {
    window.addEventListener(
      "wheel",
      (event) => {
        console.log("wheel", event);

        if (event.ctrlKey || event.metaKey) {
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

          // updateCursorShape();
        } else if (event.altKey) {
          let brushSize = paintState.getBrushSize();
          let percent =
            event.deltaY > 0 ? (brushSize - 1) / 1.1 : (brushSize + 1) * 1.1;
          let newSize = Math.round(clamp(percent, 1, 3000));
          paintState.setBrushSize(newSize);
        } else {
          if (event.shiftKey && event.deltaX === 0) {
            position.setX(position.x - event.deltaY / position.scale);
            position.setY(position.y - event.deltaX / position.scale);
          } else {
            position.setX(position.x - event.deltaX / position.scale);
            position.setY(position.y - event.deltaY / position.scale);
          }
        }

        renderChangedPosition();
      },
      { passive: false },
    );
  })();
}

/**
 * 단축키
 */
const pressedKeys = {
  Space: false,
  KeyZ: false,
  setSpace(value) {
    this.Space = value;
    applyKeyAction();
  },
  setKeyZ(value) {
    this.KeyZ = value;
    applyKeyAction();
  },
};

export function addKeyboardEvent() {
  addKeyActionChangeEventListener();
  addWheelListener();

  // 키보드 이벤트
  (function () {
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;
      // console.log(target);
      if (isInput) return; // 인풋창이면 기본 이벤트 허용

      if (
        event.code === "Space" ||
        event.code === "Tab" ||
        event.code == "Enter"
      ) {
        event.preventDefault();
      }

      if (event.code === "Space") {
        event.preventDefault();

        pressedKeys.setSpace(true);
      }

      if (event.code == "KeyZ") {
        event.preventDefault();
        pressedKeys.setKeyZ(true);
        // 이때 마우스가 클릭되어있는 상태면 바로 팬이 작동되게 하고, 확대 축소는 또 한번 클릭해야지 되는걸로 하자.
      }

      //console.log("키다운");
      if (event.repeat) return; // OS 기본 딜레이 방지

      if (event.code === "AltLeft") {
        paintState.setShowCircle(true);
      }

      if (event.code === "Escape") {
        event.preventDefault();

        cancel();
      }

      if (event.code === "Delete") {
        selectionDelete();
      }

      if ((event.ctrlKey || event.metaKey) && event.code === "KeyA") {
        event.preventDefault();
        applySelection();

        canvasSelect(0, 0, position.width, position.height);
      }
      if (event.code === "KeyB") {
        toolManager.setBrushTool();
      }
      if (event.code === "KeyE") {
        toolManager.setEraserTool();
      }
      if (event.code === "KeyL") {
        toolManager.setLiquifyTool();
      }
      if (event.code === "KeyS") {
        toolManager.setSelectTool();
      }
    });

    document.addEventListener("keyup", (event) => {
      if (event.code == "KeyZ") {
        event.preventDefault();
        pressedKeys.setKeyZ(false);
      }
      if (event.code === "Space") {
        event.preventDefault();
        pressedKeys.setSpace(false);
      }
      if (event.code === "AltLeft") {
        event.preventDefault();
        //console.log("알트 업", event);
        paintState.setShowCircle(false);
      }
    });
  })();
}

// 누르고 있는 키에 따라서 도구를 바꿈
function applyKeyAction() {
  if (paintState.pointerdown) {
    return;
  }
  paintState.setAction("BRUSH");

  // 이전에 뭔가 작동중이면 안바꿈
  if (pressedKeys.Space) {
    paintState.setAction("PAN");
  }
  if (pressedKeys.KeyZ) {
    console.log("zoom 누르는중");
    paintState.setAction("ZOOM");
  }
}

function addKeyActionChangeEventListener() {
  // 이건 다른 pointerup이 모두 실행 된 이후.
  window.addEventListener("pointerup", (e) => {
    // 키보드를 떼면 눌려있는 키가 적용되어야 한다.
    setTimeout(() => {
      applyKeyAction(); // 가장 마지막에 작동하게 함
      //console.log("apply");
    }, 0);
  });
}
