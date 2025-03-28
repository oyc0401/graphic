import { paintState } from "./main";
import { cancel, toolManager } from "./draw";
import { position } from "./position";

const selectBrushBtn: HTMLElement = document.querySelector("#select-brush")!;
const selectEraserBtn: HTMLElement = document.querySelector("#select-eraser")!;
const selectLiquifyBtn: HTMLElement =
    document.querySelector("#select-liquify")!;
const container: HTMLElement = document.querySelector("#container")!;
const brushCursor: HTMLElement = document.querySelector("#brush-cursor")!;

function updateMenubarUI() {
    selectBrushBtn.classList.remove("selected");
    selectEraserBtn.classList.remove("selected");

    if (paintState.toolId == "brush") {
        selectBrushBtn.classList.add("selected");
    } else if (paintState.toolId == "eraser") {
        selectEraserBtn.classList.add("selected");
    } else if (paintState.toolId == "liquify") {
    }
}

export function addInteractionEvent() {
    updateMenubarUI();

    updateCursorShape();

    selectBrushBtn.addEventListener("click", () => {
        toolManager.setBrushTool();
        updateMenubarUI();
    });

    selectEraserBtn.addEventListener("click", () => {
        toolManager.setEraserTool();
        updateMenubarUI();
    });

    selectLiquifyBtn.addEventListener("click", () => {
        toolManager.setLiquifyTool();
        updateMenubarUI();
    });

    (function () {
        document.addEventListener("keydown", (event) => {
            if (event.repeat) return; // OS 기본 딜레이 방지

            if (event.code == "KeyZ") {
                event.preventDefault();
                pressedKeys["KeyZ"] = true;
                // 이때 마우스가 클릭되어있는 상태면 바로 팬이 작동되게 하고, 확대 축소는 또 한번 클릭해야지 되는걸로 하자.

                applyKeyAction();
                updateCursorShape();
            }
            if (event.code === "Space") {
                event.preventDefault();
                pressedKeys["Space"] = true;

                applyKeyAction();
                updateCursorShape();
            }

            if (event.code === "Escape") {
                //console.log("취소!");
                cancel();
            }
        });

        document.addEventListener("keyup", (event) => {
            if (event.code == "KeyZ") {
                event.preventDefault();
                pressedKeys["KeyZ"] = false;

                applyKeyAction();
                updateCursorShape();
            }
            if (event.code === "Space") {
                event.preventDefault();
                pressedKeys["Space"] = false;

                applyKeyAction();
                updateCursorShape();
            }
        });
    })();

    container.addEventListener(
        "pointerdown",
        (_) => {
            paintState.pointerdown = true;
            updateCursorShape();
            // 이 안에서 도구가 변하면 안됌!! 여기서 변하면 투터치때 위험함
        },
        true,
    );

    window.addEventListener(
        "pointerup",
        (_) => {
            paintState.pointerdown = false;
            updateCursorShape();
            // 이 안에서 도구가 변하면 안됌!! 여기서 변하면 드로우 잘 작동 안됌!
        },
        true,
    );

    window.addEventListener(
        "pointermove",
        (event) => {
            if (event.pointerType == "mouse") {
                // 이건 절대절대 모바일이 되는 작업에선 쓰면 안됌!!
                paintState.cursorX = event.clientX;
                paintState.cursorY = event.clientY;
                updateCursorShape();
            }
        },
        true,
    );

    window.addEventListener("contextmenu", (event) => event.preventDefault());
}

/**
 * 단축키
 */
export let pressedKeys = {
    Space: false,
    KeyZ: false,
};

export function updateCursorShape() {
    if (!container) return;

    // 모든 상태 초기화
    container.classList.remove("grab", "grabbing", "brush", "zoom");
    brushCursor.style.visibility = "hidden";
    if (paintState.action === "PAN") {
        if (paintState.pointerdown) {
            container.classList.add("grabbing");
        } else {
            container.classList.add("grab");
        }
    } else if (paintState.action === "BRUSH") {
        let scaledBrushSize = paintState.brushSize * position.scale;
        container.classList.add("brush");
        if (!("ontouchstart" in window)) {
            brushCursor.style.visibility = "visible";
        }
        brushCursor.style.left = `${paintState.cursorX - scaledBrushSize / 2 - 1}px`;
        brushCursor.style.top = `${paintState.cursorY - scaledBrushSize / 2 - 1}px`;
        brushCursor.style.width = `${scaledBrushSize}px`;
        brushCursor.style.height = `${scaledBrushSize}px`;
    } else if (paintState.action === "ZOOM") {
        container.classList.add("zoom");
    }
}

// 누르고 있는 키에 따라서 도구를 바꿈
export function applyKeyAction() {
    if (paintState.pointerdown) {
        return;
    }
    paintState.action = "BRUSH";
    // 이전에 뭔가 작동중이면 안바꿈
    if (pressedKeys.Space) {
        paintState.action = "PAN";
    }
    if (pressedKeys.KeyZ) {
        console.log("zoom 누르는중");
        paintState.action = "ZOOM";
    }
}
