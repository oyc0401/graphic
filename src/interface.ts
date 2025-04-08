import { paintState } from "./main";
import { cancel, toolManager } from "./draw";
import { position } from "./position";
import BrushSvg from "../public/brush.svg?raw";
import EraserSvg from "../public/eraser.svg?raw";
import SelectionSvg from "../public/select_rectangle.svg?raw";
import LiquifySvg from "../public/liquify.svg?raw";
import { action, autorun } from "mobx";

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
    sizeValue: HTMLElement;
    opacityValue: HTMLElement;
    sizeSlider: HTMLInputElement;
    opacitySlider: HTMLInputElement;
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

        sizeValue: document.getElementById("size-value")!,
        opacityValue: document.getElementById("opacity-value")!,
        sizeSlider: document.getElementById("size-slider")!,
        opacitySlider: document.getElementById("opacity-slider")!,
    };

    document.getElementById("selection-icon").innerHTML = SelectionSvg;
    document.getElementById("brush-icon").innerHTML = BrushSvg;
    document.getElementById("eraser-icon").innerHTML = EraserSvg;
    document.getElementById("liquify-icon").innerHTML = LiquifySvg;
}

function bindToolButtonUI() {
    autorun(() => {
        const active = paintState.toolId;
        elementStore.selectBrushBtn.classList.toggle(
            "selected",
            active === "brush",
        );
        elementStore.selectEraserBtn.classList.toggle(
            "selected",
            active === "eraser",
        );
        elementStore.selectLiquifyBtn.classList.toggle(
            "selected",
            active === "liquify",
        );
        elementStore.selectSelectionBtn.classList.toggle(
            "selected",
            active === "select" || active === "selection",
        );
    });
}

function bindSliderUI() {
    autorun(() => {
        elementStore.sizeValue.innerText = `${paintState.brushSize}px`;
        elementStore.sizeSlider.value = `${paintState.brushSize}`;
    });

    autorun(() => {
        elementStore.opacityValue.innerText = `${paintState.brushAlpha}%`;
        elementStore.opacitySlider.value = `${paintState.brushAlpha}`;
    });
}

export function addInteractionEvent() {
    bindToolButtonUI();
    bindSliderUI();
    bindCursorUI();

    elementStore.selectBrushBtn.addEventListener("click", () => {
        toolManager.setBrushTool();
    });

    elementStore.selectEraserBtn.addEventListener("click", () => {
        toolManager.setEraserTool();
    });

    elementStore.selectLiquifyBtn.addEventListener("click", () => {
        toolManager.setLiquifyTool();
    });

    elementStore.selectSelectionBtn.addEventListener("click", () => {
        toolManager.setSelectTool();
    });

    // 슬라이더 이벤트
    (function () {
        elementStore.sizeSlider.addEventListener("input", (event) => {
            const size = Math.round(Number(elementStore.sizeSlider.value));
            console.log("브러시 크기:", size);
            paintState.setBrushSize(size);
        });

        elementStore.opacitySlider.addEventListener("input", (event) => {
            const alpha = Math.round(Number(elementStore.opacitySlider.value));
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
                pressedKeys["KeyZ"] = true;
                // 이때 마우스가 클릭되어있는 상태면 바로 팬이 작동되게 하고, 확대 축소는 또 한번 클릭해야지 되는걸로 하자.

                applyKeyAction();
            }
            if (event.code === "Space") {
                event.preventDefault();
                pressedKeys["Space"] = true;

                applyKeyAction();
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
            }
            if (event.code === "Space") {
                event.preventDefault();
                pressedKeys["Space"] = false;

                applyKeyAction();
            }
        });
    })();

    // 커서 위치 이벤트
    (function () {
        elementStore.container.addEventListener(
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

    window.addEventListener("contextmenu", (event) => event.preventDefault());
}

/**
 * 단축키
 */
export let pressedKeys = {
    Space: false,
    KeyZ: false,
};

function bindCursorUI() {
    const container = elementStore.container;

    // 1. PAN
    autorun(() => {
        const isPan = paintState.action === "PAN";
        container.classList.toggle("grab", isPan && !paintState.pointerdown);
        container.classList.toggle("grabbing", isPan && paintState.pointerdown);
    });

    // 2. ZOOM
    autorun(() => {
        container.classList.toggle("zoom", paintState.action === "ZOOM");
    });

    // 3. SELECT 툴 (BRUSH 모드 + select 툴)
    autorun(() => {
        const isBrush = paintState.action === "BRUSH";
        const isSelectTool = paintState.toolId === "select";
        container.classList.toggle("select", isBrush && isSelectTool);
    });

    const cursor = elementStore.brushCursor;

    autorun(() => {
        const isBrush = paintState.action === "BRUSH";

        const isDrawingTool =
            paintState.toolId === "brush" ||
            paintState.toolId === "eraser" ||
            paintState.toolId === "liquify";
        const isValid = isBrush && isDrawingTool;

        const isDesktop = !("ontouchstart" in window);

        const scaled = paintState.brushSize * paintState.brushCursorScale;
        const isBigSize = scaled > 50;

        // ───────────── container 클래스
        container.classList.toggle("largeBrush", isValid && isBigSize);
        container.classList.toggle("brush", isValid && !isBigSize);

        // ───────────── 브러시 커서 스타일
        if (isValid && isBigSize) {
            cursor.style.visibility = "visible";
            cursor.style.left = `${paintState.cursorX - scaled / 2 - 1}px`;
            cursor.style.top = `${paintState.cursorY - scaled / 2 - 1}px`;
            cursor.style.width = `${scaled}px`;
            cursor.style.height = `${scaled}px`;
        } else {
            cursor.style.visibility = "hidden";
        }
    });
}

// 누르고 있는 키에 따라서 도구를 바꿈
export function applyKeyAction() {
    if (paintState.pointerdown) {
        return;
    }
    console.log(paintState.action);

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
