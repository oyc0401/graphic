import { initDraw } from "./draw";

let container = document.querySelector("#container");
let layer_area = document.querySelector("#layer-area");
let bouncingRect = container.getBoundingClientRect();
const brushSize = 10; // 고정된 브러시 크기

export let layer = {
    canvas: document.querySelector("#canvas"),
    draw_canvas: document.querySelector("#draw-canvas"),
    ctx: document.querySelector("#canvas").getContext("2d"),
    draw_ctx: document.querySelector("#draw-canvas").getContext("2d"),
    width: 300,
    height: 300,
};

let positionState = {
    x: 0,
    y: 0,
    width: 300,
    height: 300,
    magnification: 1,
};

export let paintState = {
    action: "BRUSH",
};

const MIN_MAGNIFICATION = 0.1;
const MAX_MAGNIFICATION = 20;

window.onload = function () {
    bouncingRect = container.getBoundingClientRect();

    layer.canvas.width = positionState.width;
    layer.canvas.height = positionState.height;

    layer.draw_canvas.width = positionState.width;
    layer.draw_canvas.height = positionState.height;

    layer.draw_ctx.lineJoin = "round";
    layer.draw_ctx.lineCap = "round";
    layer.draw_ctx.lineWidth = brushSize; // 고정된 브러시 크기
    layer.draw_ctx.strokeStyle = "rgba(255,0,0,0.5)"; // 브러시 색상 설정

    resizeScreen();
};

window.addEventListener("resize", function () {
    resizeScreen();
});

// 캔버스 상의 좌표로 변환.
export function to_canvas_coord(x, y) {
    let p = to_screen_coord(x, y);
    let px = p.x + positionState.width / 2;
    let py = p.y + positionState.height / 2;
    return { x: px, y: py };
}

// 스크롤시의 좌표로 변환.
export function to_screen_coord(x, y) {
    let px =
        (x - bouncingRect.width / 2 - bouncingRect.x) /
            positionState.magnification +
        positionState.x;
    let py =
        (y - bouncingRect.height / 2 - bouncingRect.y) /
            positionState.magnification +
        positionState.y;
    return { x: px, y: py };
}

function resizeScreen() {
    bouncingRect = container.getBoundingClientRect();

    // 스크롤 범위 제한!
    let maxW =
        (bouncingRect.width / positionState.magnification +
            positionState.width) /
            2 -
        2;
    let clampPositionX = Math.min(maxW, Math.max(-maxW, positionState.x));
    let maxH =
        (bouncingRect.height / positionState.magnification +
            positionState.height) /
            2 -
        2;
    let clampPositionY = Math.min(maxH, Math.max(-maxH, positionState.y));

    positionState.x = clampPositionX;
    positionState.y = clampPositionY;

    //console.log("pos:", positionState.x, positionState.y);
    let canvas_css_w = positionState.width * positionState.magnification;
    let canvas_css_h = positionState.height * positionState.magnification;
    let cal_posX = positionState.x * positionState.magnification;
    let cal_posY = positionState.y * positionState.magnification;
    let css_left = (bouncingRect.width - canvas_css_w) / 2;
    let css_top = (bouncingRect.height - canvas_css_h) / 2;

    layer_area.style.left = css_left - cal_posX + "px";
    layer_area.style.top = css_top - cal_posY + "px";
    layer_area.style.width = canvas_css_w + "px";
    layer_area.style.height = canvas_css_h + "px";
}

document.addEventListener("keydown", (event) => {
    //console.log(event);
    if (event.code == "KeyZ") {
        event.preventDefault();
        paintState.action = "ZOOM";
    }
    if (event.code === "Space") {
        event.preventDefault();
        //console.log("스페이스바 눌림!");
        paintState.action = "PAN";
    }
    // if (event.code == "ControlLeft") {
    //     event.preventDefault();
    //     //paintState.action = "ZOOM";
    // }
});

document.addEventListener("keyup", (event) => {
    if (event.code == "KeyZ") {
        event.preventDefault();
        if (paintState.action != "ZOOM") return;
        paintState.action = "BRUSH";
    }
    if (event.code === "Space") {
        if (paintState.action != "PAN") return;
        paintState.action = "BRUSH";
    }
    // if (event.code == "ControlLeft") {
    //     event.preventDefault();
    //     paintState.action = "BRUSH";
    // }
});

/**
 * 휠 줌, 휠스크롤 영역
 */
function setMagification(new_scale, anchor_point) {
    let factor = 1 - positionState.magnification / new_scale;

    let diff_x = anchor_point.x - positionState.x;
    let diff_y = anchor_point.y - positionState.y;
    positionState.x += diff_x * factor;
    positionState.y += diff_y * factor;

    console.log("배율:", new_scale);
    positionState.magnification = new_scale;
}

window.addEventListener(
    "wheel",
    (event) => {
        // console.log("wheel", event);

        if (event.ctrlKey) {
            event.preventDefault();
            let new_mag;
            if (event.deltaY > 0) {
                new_mag = positionState.magnification / 1.2;
            } else {
                new_mag = positionState.magnification * 1.2;
            }
            const clamped_magnification = Math.min(
                MAX_MAGNIFICATION,
                Math.max(MIN_MAGNIFICATION, new_mag),
            );
            setMagification(
                clamped_magnification,
                to_screen_coord(event.clientX, event.clientY),
            );
        } else {
            if (event.shiftKey) {
                let delta = event.deltaY;
                positionState.x += delta / positionState.magnification;
            } else {
                let delta = event.deltaY;
                positionState.y += delta / positionState.magnification;
            }

            //console.log(positionState.x, positionState.y);
        }

        resizeScreen();
    },
    { passive: false },
);

/**
 * 핀지줌 영역
 */
let lastPinchDistance;
let lastPinchCenterPos;
let first_pointer_time = 0;
let discard_quick_undo_period = 200;

function cancel() {
    layer.draw_ctx.clearRect(0, 0, positionState.width, positionState.height);
}

function average_touches(points) {
    const average = { x: 0, y: 0 };
    for (const pointer of points) {
        average.x += pointer.clientX;
        average.y += pointer.clientY;
    }
    average.x /= points.length;
    average.y /= points.length;
    return average;
}

document.addEventListener("gesturestart", function (event) {
    event.preventDefault();
});

window.addEventListener(
    "touchstart",
    (event) => {
        console.log("$canvas_area.touchstart - captured");
        // 이때 0-> 2, 1->3 이렇게 1프레임 안에 두개의 손가락 터치 되는거 예외처리 해야함.
        if (event.touches.length > 2) {
            // 세번째 손가락은 무시
            return;
        }
        if (event.touches.length === 1) {
            first_pointer_time = performance.now();
        }

        if (event.touches.length == 2) {
            const elapsed = performance.now() - first_pointer_time;

            // 일정시간 이내에 그리면 지우기
            if (elapsed <= discard_quick_undo_period) {
                cancel();
            }
            window.dispatchEvent(new Event("pointerup"));
            console.log("두손가락이면 핀치줌 시작");
            paintState.action = "PINCH";

            lastPinchCenterPos = average_touches(event.touches);

            lastPinchDistance = Math.hypot(
                event.touches[0].clientX - event.touches[1].clientX,
                event.touches[0].clientY - event.touches[1].clientY,
            );
        }
    },
    true,
);

window.addEventListener("touchmove", (event) => {
    if (paintState.action != "PINCH") return;

    // 핀치 팬
    const pinchCenterPos = average_touches(event.touches);
    const dx = lastPinchCenterPos.x - pinchCenterPos.x;
    const dy = lastPinchCenterPos.y - pinchCenterPos.y;
    positionState.x += dx / positionState.magnification; // 이게 new_magnification이여야하는지 아징 못정함.
    positionState.y += dy / positionState.magnification;

    lastPinchCenterPos = pinchCenterPos;

    // 핀지줌
    const distance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY,
    );

    const scaleFactor = distance / lastPinchDistance;
    let new_magnification = positionState.magnification * scaleFactor;

    const clamped_magnification = Math.min(
        MAX_MAGNIFICATION,
        Math.max(MIN_MAGNIFICATION, new_magnification),
    );

    setMagification(
        clamped_magnification,
        to_screen_coord(pinchCenterPos.x, pinchCenterPos.y),
    );

    lastPinchDistance = distance;

    // 렌더링
    resizeScreen();
});

window.addEventListener("touchend", (event) => {
    console.log("touchend");
    if (paintState.action != "PINCH") return;
    if (event.touches.length >= 2) {
        // 세번째 손가락 뗀거임.
        return;
    }

    // // 핀치줌을 하다가 떼면 핀치줌 꺼지게 하기
    if (event.touches === undefined || event.touches.length < 2) {
        paintState.action = "BRUSH";
    }
});

/**
 * 마우스 팬 영역
 */
let lastClientX;
let lastClientY;
let panmoveStart = false; // 이건 팬도구 마우스가 클릭 되었는지 여부
window.addEventListener("pointerdown", (e) => {
    if (paintState.action != "PAN") return;
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    //let pointer = to_screen_coord(e.clientX, e.clientY);
    //lastPointer = pointer;
    panmoveStart = true;
});

window.addEventListener("pointermove", (e) => {
    if (!panmoveStart) return;

    let dx = lastClientX - e.clientX;
    let dy = lastClientY - e.clientY;
    positionState.x += dx / positionState.magnification;
    positionState.y += dy / positionState.magnification;

    lastClientX = e.clientX;
    lastClientY = e.clientY;
    resizeScreen();
});

window.addEventListener("pointerup", (e) => {
    if (!panmoveStart) return;
    panmoveStart = false;
});
////////////////////////////////

initDraw();
