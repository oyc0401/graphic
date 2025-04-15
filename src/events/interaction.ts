/** interaction.ts */
import { paintState } from "../main";
import { cancel, toolManager } from "../draw";
import { els } from "../ui/elements";
import {
    applySelection,
    canvasSelect,
    selection,
    selectionDelete,
} from "../selection";
import {
    MAX_SCALE,
    MIN_SCALE,
    position,
    renderChangedPosition,
    setMagification,
    to_screen_coord,
} from "../position";
import { clamp } from "../utils";

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

    els.titleArea.addEventListener("pointerup", () => {
        // paintState.setShowSizeHandle(true);
        selection.setWidth(position.width);
        selection.setHeight(position.height);
        selection.setX(0);
        selection.setY(0);

        paintState.setToolId("resize");
        console.log("title click!");
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

export function addInteractionEvent() {
    addClickEventListener();
    addKeyActionChangeEventListener();
    addWheelListener();
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

    // 키보드 이벤트
    (function () {
        document.addEventListener("keydown", (event) => {
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

function addWheelListener() {
    /**
     * 휠 스크롤 영역
     */
    (function () {
        window.addEventListener(
            "wheel",
            (event) => {
                // console.log("wheel", event);

                if (event.ctrlKey) {
                    event.preventDefault();
                    let new_mag;
                    if (event.deltaY > 0) {
                        new_mag = position.scale / 1.2;
                    } else {
                        new_mag = position.scale * 1.2;
                    }
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
                        event.deltaY > 0
                            ? (brushSize - 1) / 1.1
                            : (brushSize + 1) * 1.1;
                    let newSize = Math.round(clamp(percent, 1, 3000));
                    paintState.setBrushSize(newSize);
                } else {
                    if (event.shiftKey) {
                        let delta = event.deltaY;
                        position.setX(position.x - delta / position.scale);
                    } else {
                        let delta = event.deltaY;
                        position.setY(position.y - delta / position.scale);
                    }
                }

                renderChangedPosition();
            },
            { passive: false },
        );
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
        e.preventDefault();

        // 키보드를 떼면 눌려있는 키가 적용되어야 한다.
        setTimeout(() => {
            applyKeyAction(); // 가장 마지막에 작동하게 함
            console.log("apply");
        }, 0);
    });
}
