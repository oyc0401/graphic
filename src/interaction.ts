import { paintState } from "./main";
import { cancel, toolManager } from "./draw";
import { els } from "./elements";

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



export function addInteractionEvent() {
    els.selectBrushBtn.addEventListener("click", () => {
        toolManager.setBrushTool();
    });

    els.selectEraserBtn.addEventListener("click", () => {
        toolManager.setEraserTool();
    });

    els.selectLiquifyBtn.addEventListener("click", () => {
        toolManager.setLiquifyTool();
    });

    els.selectSelectionBtn.addEventListener("click", () => {
        toolManager.setSelectTool();
    });

    // 슬라이더 이벤트
    (function () {
        els.sizeSlider.addEventListener("input", (event) => {
            const size = Math.round(Number(els.sizeSlider.value));
            console.log("브러시 크기:", size);
            paintState.setBrushSize(size);
        });

        els.opacitySlider.addEventListener("input", (event) => {
            const alpha = Math.round(Number(els.opacitySlider.value));
            console.log("투명도:", alpha);
            paintState.setBrushAlpha(alpha);
        });
    })();

    // 키보드 이벤트
    (function () {
        document.addEventListener("keydown", (event) => {
            if (
                event.code === "Space" ||
                event.code === "Tab" ||
                event.code == "Enter"
            )
                event.preventDefault();

            if (event.repeat) return; // OS 기본 딜레이 방지

            if (event.code == "KeyZ") {
                event.preventDefault();
                pressedKeys.setKeyZ(true);
                // 이때 마우스가 클릭되어있는 상태면 바로 팬이 작동되게 하고, 확대 축소는 또 한번 클릭해야지 되는걸로 하자.
            }
            if (event.code === "Space") {
                event.preventDefault();

                pressedKeys.setSpace(true);
            }

            if (event.code === "Escape") {
                //console.log("취소!");
                cancel();
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
        });
    })();

    // 커서 위치 이벤트
    (function () {
        els.container.addEventListener(
            "pointerdown",
            (_) => {
                paintState.setPointerdown(true);
                // 이 안에서 도구가 변하면 안됌!! 여기서 변하면 투터치때 위험함
            },
            true,
        );

        window.addEventListener(
            "pointerup",
            (_) => {
                paintState.setPointerdown(false);
                // 이 안에서 도구가 변하면 안됌!! 여기서 변하면 드로우 잘 작동 안됌!
            },
            true,
        );

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
    })();

    addKeyActionChangeEvent();

    window.addEventListener("contextmenu", (event) => event.preventDefault());
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

function addKeyActionChangeEvent() {
    // 이건 다른 pointerup이 모두 실행 된 이후.
    window.addEventListener("pointerup", (e) => {
        e.preventDefault();

        // 키보드를 떼면 눌려있는 키가 적용되어야 한다.
        setTimeout(() => {
            applyKeyAction(); // 가장 마지막에 작동하게 함
        }, 0);
    });
}
