import { paintState } from "./main";
import { cancel, toolManager } from "./draw";
import { position } from "./position";
import BrushSvg from "../public/brush.svg?raw";
import EraserSvg from "../public/eraser.svg?raw";
import SelectionSvg from "../public/select_rectangle.svg?raw";
import LiquifySvg from "../public/liquify.svg?raw";

interface Elements {
    canvas: HTMLCanvasElement;
    container: HTMLElement;
    brushCursor: HTMLElement;
    selectSelectionBtn: HTMLElement;
    selectBrushBtn: HTMLElement;
    selectEraserBtn: HTMLElement;
    selectLiquifyBtn: HTMLElement;
    zoomArea: HTMLElement;
    selectionArea: HTMLElement;
}
export let elementStore: Elements = {} as Elements;

export function getElements() {
    elementStore = {
        canvas: document.querySelector("#canvas")!,
        container: document.querySelector("#container")!,
        brushCursor: document.querySelector("#brush-cursor")!,

        selectSelectionBtn: document.getElementById("select-selection")!,
        selectBrushBtn: document.querySelector("#select-brush")!,
        selectEraserBtn: document.querySelector("#select-eraser")!,
        selectLiquifyBtn: document.querySelector("#select-liquify")!,

        zoomArea: document.querySelector("#zoom-area")!,
        selectionArea: document.querySelector("#selection-area")!,
    };

    document.getElementById("selection-icon").innerHTML = SelectionSvg;
    document.getElementById("brush-icon").innerHTML = BrushSvg;
    document.getElementById("eraser-icon").innerHTML = EraserSvg;
    document.getElementById("liquify-icon").innerHTML = LiquifySvg;
}

function updateMenubarUI() {
    elementStore.selectBrushBtn.classList.remove("selected");
    elementStore.selectEraserBtn.classList.remove("selected");
    elementStore.selectLiquifyBtn.classList.remove("selected");
    elementStore.selectSelectionBtn.classList.remove("selected");

    if (paintState.toolId == "brush") {
        elementStore.selectBrushBtn.classList.add("selected");
    } else if (paintState.toolId == "eraser") {
        elementStore.selectEraserBtn.classList.add("selected");
    } else if (paintState.toolId == "liquify") {
        elementStore.selectLiquifyBtn.classList.add("selected");
    } else if (paintState.toolId == "select") {
        elementStore.selectSelectionBtn.classList.add("selected");
    }
}

export function addInteractionEvent() {
    updateMenubarUI();

    updateCursorShape();

    elementStore.selectBrushBtn.addEventListener("click", () => {
        toolManager.setBrushTool();
        updateMenubarUI();
    });

    elementStore.selectEraserBtn.addEventListener("click", () => {
        toolManager.setEraserTool();
        updateMenubarUI();
    });

    elementStore.selectLiquifyBtn.addEventListener("click", () => {
        toolManager.setLiquifyTool();
        updateMenubarUI();
    });

    elementStore.selectSelectionBtn.addEventListener("click", () => {
        toolManager.setSelectTool();
        updateMenubarUI();
    });

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

    elementStore.container.addEventListener(
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

const MANAGED_CLASSES = [
    "grab",
    "grabbing",
    "brush",
    "zoom",
    "select",
    "largeBrush",
];

export function updateCursorShape2() {
    const { container, brushCursor } = elementStore;
    const containerClassList = container.classList;

    // 1) 어떤 클래스(또는 없음)를 적용할지 결정
    let nextClass = "";

    if (paintState.action === "PAN") {
        nextClass = paintState.pointerdown ? "grabbing" : "grab";
    } else if (paintState.action === "BRUSH") {
        // BRUSH + selection이면 아무것도 안 함 (클래스 없음)
        if (paintState.toolId === "select") {
            // BRUSH + select 툴 -> select 클래스
            nextClass = "select";
        } else if (paintState.toolId !== "selection") {
            // BRUSH + 그 외 툴 -> brush/largeBrush
            const scaledBrushSize = paintState.brushSize * position.scale;
            // 데스크탑 + 브러시 크기 큰 경우 largeBrush, 아니면 brush
            if (!("ontouchstart" in window) && scaledBrushSize > 50) {
                nextClass = "largeBrush";
            } else {
                nextClass = "brush";
            }
        }
    } else if (paintState.action === "ZOOM") {
        nextClass = "zoom";
    }

    // 2) container에 이미 있는 '관리 대상 클래스'들을 지우고,
    //    새로 필요한 클래스를 달라졌을 때만 추가
    for (const c of MANAGED_CLASSES) {
        if (c !== nextClass && containerClassList.contains(c)) {
            containerClassList.remove(c);
        }
    }
    if (nextClass && !containerClassList.contains(nextClass)) {
        containerClassList.add(nextClass);
    }

    // 3) brushCursor 표시 여부/스타일 계산
    let shouldShowBrush = false;
    let newLeft = "";
    let newTop = "";
    let newWidth = "";
    let newHeight = "";

    if (
        paintState.action === "BRUSH" &&
        paintState.toolId !== "selection" &&
        paintState.toolId !== "select"
    ) {
        // 실제 그리는 툴만 커서 표시
        // 브러시 크기 계산
        const scaledBrushSize = paintState.brushSize * position.scale;

        // 커서가 충분히 크고 데스크탑 환경이면 원형 커서 표시
        // (대신 largeBrush 클래스가 적용되어 있을 것이므로)
        // 나머지는 그냥 brush 아이콘만
        shouldShowBrush = !("ontouchstart" in window) && scaledBrushSize > 50;

        // 커서 위치/사이즈 계산
        newLeft = `${paintState.cursorX - scaledBrushSize / 2 - 1}px`;
        newTop = `${paintState.cursorY - scaledBrushSize / 2 - 1}px`;
        newWidth = `${scaledBrushSize}px`;
        newHeight = `${scaledBrushSize}px`;
    }

    // 4) brushCursor DOM 업데이트 (기존 상태와 다를 때만)
    const newVisibility = shouldShowBrush ? "visible" : "hidden";
    if (brushCursor.style.visibility !== newVisibility) {
        brushCursor.style.visibility = newVisibility;
    }

    if (shouldShowBrush) {
        if (brushCursor.style.left !== newLeft) {
            brushCursor.style.left = newLeft;
        }
        if (brushCursor.style.top !== newTop) {
            brushCursor.style.top = newTop;
        }
        if (brushCursor.style.width !== newWidth) {
            brushCursor.style.width = newWidth;
        }
        if (brushCursor.style.height !== newHeight) {
            brushCursor.style.height = newHeight;
        }
    }
}


export function updateCursorShape() {
    // 모든 상태 초기화
    elementStore.container.classList.remove(
        "grab",
        "grabbing",
        "brush",
        "zoom",
        "select",
        "largeBrush",
    );
    elementStore.brushCursor.style.visibility = "hidden";

    // ────────────────────────────────
    // PAN 모드
    if (paintState.action === "PAN") {
        elementStore.container.classList.add(
            paintState.pointerdown ? "grabbing" : "grab",
        );
        return;
    }

    // ────────────────────────────────
    // BRUSH 모드: selection 툴이면 아무것도 안 함
    if (paintState.action === "BRUSH" && paintState.toolId === "selection") {
        return;
    }

    // BRUSH 모드: select 툴이면 select 커서 적용
    if (paintState.action === "BRUSH" && paintState.toolId === "select") {
        elementStore.container.classList.add("select");
        return;
    }

    // BRUSH 모드: 실제 브러시 커서 표시
    if (paintState.action === "BRUSH") {
        const scaledBrushSize = paintState.brushSize * position.scale;

        // 데스크탑에서만 원형 커서 표시
        if (!("ontouchstart" in window) && scaledBrushSize > 50) {
            elementStore.brushCursor.style.visibility = "visible";
            elementStore.container.classList.add("largeBrush");
        } else {
            elementStore.container.classList.add("brush");
        }

        elementStore.brushCursor.style.left = `${paintState.cursorX - scaledBrushSize / 2 - 1}px`;
        elementStore.brushCursor.style.top = `${paintState.cursorY - scaledBrushSize / 2 - 1}px`;
        elementStore.brushCursor.style.width = `${scaledBrushSize}px`;
        elementStore.brushCursor.style.height = `${scaledBrushSize}px`;
        return;
    }
    // ────────────────────────────────
    // ZOOM 모드
    if (paintState.action === "ZOOM") {
        elementStore.container.classList.add("zoom");
        return;
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
