import { paintState } from "./main";
import { layer } from "./main";
import { to_canvas_coord, to_screen_coord } from "./main";
let points = [
    { x: 864, y: 219 },
    { x: 378, y: 799 },
    { x: 142, y: 484 },
    { x: 430, y: 117 },
    { x: 836, y: 126 },
    { x: 1023, y: 670 },
];

let pointer_active = false;

export function initDraw() {
    window.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (paintState.action != "BRUSH") return;
        to_screen_coord(e.clientX, e.clientY);
        pointer_active = true;
        let point = to_canvas_coord(e.clientX, e.clientY);
        points = [point];
        console.log(point);
    });

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
        if (!pointer_active) return;
        pointer_active = false;
        requestAnimationFrame(() => {
            layer.ctx.drawImage(layer.draw_canvas, 0, 0);
            layer.draw_ctx.clearRect(0, 0, layer.width, layer.height);
        });
    });
}

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

function draw() {
    layer.draw_ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    layer.draw_ctx.stroke(); // 그리기
}

function draw0(p0, p1) {
    layer.draw_ctx.beginPath();
    layer.draw_ctx.moveTo(p0.x, p0.y); // 시작점으로 이동
    layer.draw_ctx.lineTo(p1.x, p1.y);
}
//draw1(points[0], points[1], points[2]);
function draw1(p0, p1, p2) {
    let a0 = computeControlPoint(p0, p1, p2);
    layer.draw_ctx.beginPath();
    layer.draw_ctx.moveTo(p0.x, p0.y); // 시작점으로 이동
    layer.draw_ctx.quadraticCurveTo(a0.x, a0.y, p1.x, p1.y);
}

//draw2(points[0], points[1], points[2], points[3]);
function draw2(p0, p1, p2, p3) {
    let a0 = computeControlPoint(p2, p1, p0);
    let a1 = computeControlPoint(p1, p2, p3);
    layer.draw_ctx.bezierCurveTo(a0.x, a0.y, a1.x, a1.y, p2.x, p2.y);
}

//draw3(points[1], points[2], points[3]);
function draw3(p0, p1, p2) {
    let a0 = computeControlPoint(p2, p1, p0);
    layer.draw_ctx.quadraticCurveTo(a0.x, a0.y, p2.x, p2.y);
}
