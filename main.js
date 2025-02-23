let container = document.querySelector("#container");

let canvas = document.querySelector("#canvas");
let ctx = canvas.getContext("2d");
let canvas_w = 300;
let canvas_h = 300;
let canvas_css_w = canvas_w;
let canvas_css_h = canvas_h;
let css_left = 0;
let css_top = 0;

let magnification = 1;
let MIN_MAGNIFICATION = 0.1;
let MAX_MAGNIFICATION = 20;

let posX = 0;
let posY = 0;

const brushSize = 10; // 고정된 브러시 크기
window.onload = function () {
    canvas.width = canvas_w;
    canvas.height = canvas_h;

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = brushSize; // 고정된 브러시 크기
    ctx.strokeStyle = "rgba(255,0,0,0.5)"; // 브러시 색상 설정

    resizeScreen();
};

window.addEventListener("resize", function () {
    resizeScreen();
});

// 캔버스 상의 좌표로 변환.
function to_canvas_coord(x, y) {
    let p = to_screen_coord(x, y);
    let px = p.x + canvas_w / 2;
    let py = p.y + canvas_h / 2;
    return { x: px, y: py };
}

// 스크롤시의 좌표로 변환.
function to_screen_coord(x, y) {
    let px = (x - window.innerWidth / 2) / magnification + posX;
    let py = (y - window.innerHeight / 2) / magnification + posY;
    return { x: px, y: py };
}

function resizeScreen() {
    // 스크롤 범위 제한!
    let maxW = (window.innerWidth / magnification + canvas_w) / 2 - 2;
    let clampPositionX = Math.min(maxW, Math.max(-maxW, posX));
    let maxH = (window.innerHeight / magnification + canvas_h) / 2 - 2;
    let clampPositionY = Math.min(maxH, Math.max(-maxH, posY));

    posX = clampPositionX;
    posY = clampPositionY;

    //console.log("pos:", posX, posY);
    canvas_css_w = canvas_w * magnification;
    canvas_css_h = canvas_h * magnification;
    let cal_posX = posX * magnification;
    let cal_posY = posY * magnification;
    css_left = (window.innerWidth - canvas_css_w) / 2;
    css_top = (window.innerHeight - canvas_css_h) / 2;

    canvas.style.left = css_left - cal_posX + "px";
    canvas.style.top = css_top - cal_posY + "px";
    canvas.style.width = canvas_css_w + "px";
    canvas.style.height = canvas_css_h + "px";
}

window.addEventListener(
    "wheel",
    (event) => {
        console.log("wheel", event);

        if (event.ctrlKey) {
            event.preventDefault();
            let new_mag;
            if (event.deltaY > 0) {
                new_mag = magnification / 1.2;
            } else {
                new_mag = magnification * 1.2;
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
                posX += delta / magnification;
            } else {
                let delta = event.deltaY;
                posY += delta / magnification;
            }

            console.log(posX, posY);
        }

        resizeScreen();
    },
    { passive: false },
);

document.addEventListener("gesturestart", function (event) {
    event.preventDefault();
});

let last_zoom_pointer_distance;
let pan_last_pos;
let first_pointer_time;
let discard_quick_undo_period = 200;
let pointer_active = false;
let pinchAllowed = true;

function cancel() {
    //alert("cancel!");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

window.addEventListener(
    "touchstart",
    (event) => {
        console.log("$canvas_area.touchstart - captured");

        if (event.touches.length === 1) {
            first_pointer_time = performance.now();
        }
        if (event.touches.length === 2) {
            last_zoom_pointer_distance = Math.hypot(
                event.touches[0].clientX - event.touches[1].clientX,
                event.touches[0].clientY - event.touches[1].clientY,
            );

            pan_last_pos = average_touches(event.touches);
        }

        if (event.touches.length == 2) {
            const elapsed = performance.now() - first_pointer_time;

            // 일정시간 이내에 그리면 지우기
            if (elapsed <= discard_quick_undo_period) {
                window.dispatchEvent(new Event("touchend"));

                // 500ms 이내 => 그림 cancel + pinchAllowed = true
                cancel();
            }
            window.dispatchEvent(new Event("pointerup"));
            console.log("두손가락이면 핀치줌 허용");
            // 그림그리기 완료
            // pinchAllowed가 false일때만 그리기 완료됌..

            pointer_active = false;
            // ---- [중요 수정 2] 그림 그리기를 중단하려면 pointer_active = false
            // 핀치 줌은 허용
            pinchAllowed = true;
        }
    },
    true,
);

window.addEventListener("touchend", (event) => {
    console.log("touchend");

    // // 핀치줌을 하다가 떼면 핀치줌 꺼지게 하기
    if (event.touches === undefined || event.touches.length < 2) {
        pinchAllowed = false;
    }
});

function setMagification(new_scale, anchor_point) {
    let factor = 1 - magnification / new_scale;

    let diff_x = anchor_point.x - posX;
    let diff_y = anchor_point.y - posY;
    posX += diff_x * factor;
    posY += diff_y * factor;

    console.log("배율:", new_scale);
    magnification = new_scale;
}

window.addEventListener("touchmove", (event) => {
    if (pinchAllowed) {
        const current_pos = average_touches(event.touches);
        const distance = Math.hypot(
            event.touches[0].clientX - event.touches[1].clientX,
            event.touches[0].clientY - event.touches[1].clientY,
        );

        // (A) 배율 계산
        const scaleFactor = distance / last_zoom_pointer_distance;
        let new_magnification = magnification * scaleFactor;

        last_zoom_pointer_distance = distance;

        // console.log(magnification, current_pos);

        const clamped_magnification = Math.min(
            MAX_MAGNIFICATION,
            Math.max(MIN_MAGNIFICATION, new_magnification),
        );
        const dx = pan_last_pos.x - current_pos.x;
        const dy = pan_last_pos.y - current_pos.y;
        posX += dx / clamped_magnification; // 이게 new_magnification이여야하는지 아징 못정함.
        posY += dy / clamped_magnification;

        setMagification(
            clamped_magnification,
            to_screen_coord(current_pos.x, current_pos.y),
        );

        resizeScreen();
        pan_last_pos = current_pos;
    }
});

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

////////////////////////////////
let points = [
    { x: 864, y: 219 },
    { x: 378, y: 799 },
    { x: 142, y: 484 },
    { x: 430, y: 117 },
    { x: 836, y: 126 },
    { x: 1023, y: 670 },
];

window.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    to_screen_coord(e.clientX, e.clientY);
    pointer_active = true;
    let point = to_canvas_coord(e.clientX, e.clientY);
    points = [point];
    console.log(point);
});

let power = 1;
window.addEventListener("pointermove", (e) => {
    e.preventDefault();
    if (!pointer_active) return;
    requestAnimationFrame(() => {
        // console.log({ x: e.clientX, y: e.clientY });
        let point = to_canvas_coord(e.clientX, e.clientY);
        points.push(point);

        draw();
    });
});

window.addEventListener("pointerup", (e) => {
    e.preventDefault();
    pointer_active = false;
});

function normalize(vx, vy) {
    let mag = Math.sqrt(vx * vx + vy * vy);
    return { x: vx / mag, y: vy / mag };
}

function computeControlPoint(p0, p1, p2, power = 4) {
    // 벡터 d = p0 - p2
    let dx = p0.x - p2.x;
    let dy = p0.y - p2.y;

    // 정규화된 방향 벡터
    let unit = normalize(dx, dy);

    // 이동 거리 = len(p0, p1) / 4
    let d = Math.hypot(p1.x - p0.x, p1.y - p0.y) / power;

    // 최종 조절점
    return {
        x: p1.x + unit.x * d,
        y: p1.y + unit.y * d,
    };
}

draw();
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (points.length == 1) return;
    if (points.length == 2) {
        draw0(points[0], points[1]);
        console.log("직선");
        return;
    }
    for (let i = 0; i < points.length - 1; i++) {
        if (i == 0) {
            draw1(points[i], points[i + 1], points[i + 2]);
            // console.log(i, i + 1, i + 2);
        } else if (i == points.length - 2) {
            draw3(points[i - 1], points[i], points[i + 1]);

            // console.log(i - 1, i, i + 1);
        } else {
            draw2(points[i - 1], points[i], points[i + 1], points[i + 2]);
            // console.log(i - 1, i, i + 1, i + 2);
        }
    }
    ctx.stroke(); // 그리기
}

function draw0(p0, p1) {
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y); // 시작점으로 이동
    ctx.lineTo(p1.x, p1.y);
}
//draw1(points[0], points[1], points[2]);
function draw1(p0, p1, p2) {
    let a0 = computeControlPoint(p0, p1, p2);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y); // 시작점으로 이동
    ctx.quadraticCurveTo(a0.x, a0.y, p1.x, p1.y);
}

//draw2(points[0], points[1], points[2], points[3]);
function draw2(p0, p1, p2, p3) {
    let a0 = computeControlPoint(p2, p1, p0);
    let a1 = computeControlPoint(p1, p2, p3);
    ctx.bezierCurveTo(a0.x, a0.y, a1.x, a1.y, p2.x, p2.y);
}

//draw3(points[1], points[2], points[3]);
function draw3(p0, p1, p2) {
    let a0 = computeControlPoint(p2, p1, p0);
    ctx.quadraticCurveTo(a0.x, a0.y, p2.x, p2.y);
}
