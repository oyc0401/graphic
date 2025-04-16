/** clickEvent.ts */
import { paintState } from "../main";
import { toolManager } from "../draw";
import { els } from "../ui/elements";

export function addClickEvent() {
    addClickEventListener();

    // 슬라이더 이벤트
    (function () {
        els.sizeSlider.addEventListener("input", (event) => {
            const size = Number(els.sizeSlider.value);
            let realSize = positionToSize(size / 1000);
            console.log("브러시 크기:", realSize);
            paintState.setBrushSize(realSize);
        });

        els.opacitySlider.addEventListener("input", (event) => {
            const alpha = Math.round(Number(els.opacitySlider.value));
            console.log("투명도:", alpha);
            paintState.setBrushAlpha(alpha);
        });
    })();
    function positionToSize(pos: number): number {
        const min = 1;
        const max = 3000;
        const logMin = Math.log(min);
        const logMax = Math.log(max);
        const logValue = logMin + (logMax - logMin) * pos;
        return Math.exp(logValue);
    }

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
    window.addEventListener("contextmenu", (event) => event.preventDefault());
}

function addClickEventListener() {
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

    const hexColors = [
        "#000000",
        "#FFFFFF",
        "#FF6F61",
        "#98FF98",
        "#FFA75F",
        "#ACE7FF",
        "#FFED65",
        "#E5B5FF",
    ];

    els.colorElements.forEach((selectDiv, index) => {
        const hexColor = hexColors[index];
        const circle = selectDiv.querySelector(
            ".circle-shape",
        ) as HTMLDivElement;

        if (!circle) return;

        // 배경색 적용
        circle.style.backgroundColor = hexColor;

        // 흰색일 경우 테두리 추가
        if (hexColor.toUpperCase() === "#FFFFFF") {
            circle.style.border = "1px solid #E3E3E3";
        }

        // 클릭 시 색상 설정
        selectDiv.addEventListener("click", () => {
            let { r, g, b } = hexToRgb(hexColor);
            paintState.setColor(r, g, b);
        });
    });

    els.titleArea.addEventListener("click", () => {
        toolManager.setResizeTool();
    });
}

function hexToRgb(hex) {
    hex = hex.replace("#", "");

    // 3자리 짧은 hex (#fff) → 확장
    if (hex.length === 3) {
        hex = hex
            .split("")
            .map((c) => c + c)
            .join("");
    }

    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    return { r, g, b };
}
