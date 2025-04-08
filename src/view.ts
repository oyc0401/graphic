import { paintState } from "./main";
import { autorun } from "mobx";
import { els } from "./elements";

export function bindView() {
    bindToolButtonUI();
    bindSliderUI();
    bindCursorUI();
}

function bindToolButtonUI() {
    autorun(() => {
        const active = paintState.toolId;
        els.selectBrushBtn.classList.toggle(
            "selected",
            active === "brush",
        );
        els.selectEraserBtn.classList.toggle(
            "selected",
            active === "eraser",
        );
        els.selectLiquifyBtn.classList.toggle(
            "selected",
            active === "liquify",
        );
        els.selectSelectionBtn.classList.toggle(
            "selected",
            active === "select" || active === "selection",
        );
    });
}

function bindSliderUI() {
    autorun(() => {
        els.sizeValue.innerText = `${paintState.brushSize}px`;
        els.sizeSlider.value = `${paintState.brushSize}`;
    });

    autorun(() => {
        els.opacityValue.innerText = `${paintState.brushAlpha}%`;
        els.opacitySlider.value = `${paintState.brushAlpha}`;
    });
}

function bindCursorUI() {
    const container = els.container;

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

    const cursor = els.brushCursor;

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
