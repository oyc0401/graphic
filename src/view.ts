import { paintState } from "./main";
import { autorun } from "mobx";
import { els } from "./elements";
import { selection } from "./selection";
import { getPixelRatio, position } from "./position";

export function bindView() {
    bindToolButtonUI();
    bindSliderUI();
    bindColorUI();
    bindCursorUI();
    bindSelectionUI();
}

function bindToolButtonUI() {
    autorun(() => {
        const brushId = paintState.brushId;
        const toolId = paintState.toolId;
        els.selectBrushBtn.classList.toggle(
            "selected",
            toolId === "brush" && brushId === "brush",
        );
        els.selectEraserBtn.classList.toggle(
            "selected",
            toolId === "brush" && brushId === "eraser",
        );
        els.selectLiquifyBtn.classList.toggle(
            "selected",
            toolId === "brush" && brushId === "liquify",
        );
        els.selectSelectionBtn.classList.toggle(
            "selected",
            toolId === "select" || toolId === "selection",
        );
    });
}

function bindSliderUI() {
    autorun(() => {
        const brushSize = paintState.getBrushSize();

        els.sizeValue.innerText = `${brushSize}px`;
        els.sizeSlider.value = `${brushSize}`;
    });

    autorun(() => {
        const brushAlpha = paintState.getBrushAlpha();

        els.opacityValue.innerText = `${brushAlpha}%`;
        els.opacitySlider.value = `${brushAlpha}`;
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

        const isDrawingTool = paintState.toolId == "brush";
        const isValid = isBrush && isDrawingTool;

        const isDesktop = !("ontouchstart" in window);

        const brushSize = paintState.getBrushSize();
        const dpr = getPixelRatio();

        const scaled = (brushSize * position.scale) / dpr;
        const isBigSize = scaled > 50;
        const showCircle = paintState.showCircle;

        // ───────────── container 클래스
        container.classList.toggle(
            "largeBrush",
            isValid && !showCircle && isBigSize,
        );
        container.classList.toggle(
            "brush",
            isValid && !showCircle && !isBigSize,
        );
        container.classList.toggle("noCursor", isValid && showCircle);

        // ───────────── 브러시 커서 스타일
        if (isValid && (isBigSize || showCircle)) {
            if (isDesktop || paintState.drawdownAndMoved) {
                cursor.style.visibility = "visible";
            } else {
                cursor.style.visibility = "hidden";
            }
            cursor.style.left = `${paintState.cursorX - scaled / 2 - 1}px`;
            cursor.style.top = `${paintState.cursorY - scaled / 2 - 1}px`;
            cursor.style.width = `${scaled}px`;
            cursor.style.height = `${scaled}px`;
        } else {
            cursor.style.visibility = "hidden";
        }
    });
}

function bindSelectionUI() {
    // 1) selectionArea 스타일 갱신
    autorun(() => {
        const visible = selection.visible;
        let selectionSizeBox = document.getElementById("selection-size")!;
        let selectionText = document.getElementById("selection-text")!;

        els.selectionArea.style.visibility = visible ? "visible" : "hidden";
        selectionSizeBox.style.visibility = visible ? "visible" : "hidden";

        const dpr = getPixelRatio();
        const scaledLeft = (selection.x / dpr + position.x) * position.scale;
        const scaledTop = (selection.y / dpr + position.y) * position.scale;
        const scaledWidth = (selection.width * position.scale) / dpr;
        const scaledHeight = (selection.height * position.scale) / dpr;

        if (visible) {
            els.selectionArea.style.left = `${scaledLeft}px`;
            els.selectionArea.style.top = `${scaledTop}px`;
            els.selectionArea.style.width = `${scaledWidth}px`;
            els.selectionArea.style.height = `${scaledHeight}px`;

            selectionSizeBox.style.left = `${scaledLeft}px`;
            selectionSizeBox.style.top = `${scaledTop + scaledHeight + 24}px`;
            selectionSizeBox.style.width = `${scaledWidth}px`;

            selectionText.innerText = `${selection.width} x ${selection.height}`;
        }
    });

    // 2) 핸들 위치 및 표시
    autorun(() => {
        const visible = selection.visible;
        const dpr = getPixelRatio();
        const sLeft = (selection.x / dpr + position.x) * position.scale;
        const sTop = (selection.y / dpr + position.y) * position.scale;
        const sWidth = (selection.width * position.scale) / dpr;
        const sHeight = (selection.height * position.scale) / dpr;

        // 핸들 표시/숨김
        const handles = [
            els.handleLT,
            els.handleT,
            els.handleRT,
            els.handleR,
            els.handleRB,
            els.handleB,
            els.handleLB,
            els.handleL,
        ];

        for (const h of handles) {
            h.style.visibility = visible ? "visible" : "hidden";
        }

        // 위치 계산
        const offset = 22;
        const setPos = (handle: HTMLElement, left: number, top: number) => {
            handle.style.left = `${left - offset}px`;
            handle.style.top = `${top - offset}px`;
        };

        if ((selection.height * position.scale) / dpr < 100) {
            for (const h of [els.handleL, els.handleR]) {
                h.style.visibility = "hidden";
            }
        }
        if ((selection.width * position.scale) / dpr < 100) {
            for (const h of [els.handleT, els.handleB]) {
                h.style.visibility = "hidden";
            }
        }

        if (visible) {
            setPos(els.handleLT, sLeft, sTop);
            setPos(els.handleT, sLeft + sWidth / 2, sTop);
            setPos(els.handleRT, sLeft + sWidth, sTop);
            setPos(els.handleR, sLeft + sWidth, sTop + sHeight / 2);
            setPos(els.handleRB, sLeft + sWidth, sTop + sHeight);
            setPos(els.handleB, sLeft + sWidth / 2, sTop + sHeight);
            setPos(els.handleLB, sLeft, sTop + sHeight);
            setPos(els.handleL, sLeft, sTop + sHeight / 2);
        }
    });
}

function bindResizeHandleUI() {}

function bindColorUI() {
    autorun(() => {
        const color = paintState.getColor();
        els.colorIcon.style.background = rgbToHex(color);
    });
}

function rgbToHex({ r, g, b }) {
    const toHex = (v) => v.toString(16).padStart(2, "0").toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
