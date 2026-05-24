/** clickEvent.ts */
import { paintState } from "../paintState";
import { toolManager } from "../tools/toolManager";
import { els } from "./elements";

export function addClickEvent() {
  const preventDefaultIfCancelable = (event: Event) => {
    if (event.cancelable) {
      event.preventDefault();
    }
  };

  // 커서 위치 이벤트
  window.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerType == "mouse") {
        // 이건 절대절대 모바일이 되는 작업에선 쓰면 안됌!!
        paintState.setCursorPosition(event.clientX, event.clientY);
      }
    },
    true,
  );

  document.addEventListener(
    "gesturestart",
    (e) => {
      preventDefaultIfCancelable(e); // Safari 방지
    },
    { passive: false },
  );
  //
  els.container.addEventListener(
    "touchstart",
    (e) => {
      // prevent swipe to navigate gesture
      preventDefaultIfCancelable(e);
    },
    { passive: false },
  );
  els.container.addEventListener(
    "touchmove",
    (e) => {
      // prevent swipe to navigate gesture
      preventDefaultIfCancelable(e);
    },
    { passive: false },
  );
  window.addEventListener("contextmenu", preventDefaultIfCancelable);
}
