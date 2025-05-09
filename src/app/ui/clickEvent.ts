/** clickEvent.ts */
import { paintState } from "../paintState";
import { toolManager } from "../draw";
import { els } from "./elements";

export function addClickEvent() {

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
            e.preventDefault(); // Safari 방지
        },
        { passive: false },
    );
    //
    els.container.addEventListener(
        "touchstart",
        (e) => {
            // prevent swipe to navigate gesture
            e.preventDefault();
        },
        { passive: false },
    );
    els.container.addEventListener(
        "touchmove",
        (e) => {
            // prevent swipe to navigate gesture
            e.preventDefault();
        },
        { passive: false },
    );
    window.addEventListener("contextmenu", (event) => event.preventDefault());
}
