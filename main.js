let canvas = document.querySelector("#canvas");
let ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

let isDrawing = false;
let points = [
    { x: 864, y: 219 },
    { x: 378, y: 799 },
    { x: 142, y: 484 },
    { x: 430, y: 117 },
    { x: 836, y: 126 },
    { x: 1023, y: 670 },
];

// let points = [
//     { x: 385, y: 624 },
//     { x: 224, y: 561 },
//     { x: 144, y: 471 },
//     { x: 354, y: 265 },
//     { x: 434, y: 83 },
//     { x: 628, y: 112 },
//     { x: 669, y: 245 },
//     { x: 573, y: 336 },
//     { x: 986, y: 522 },
// ];
let canvasSize = Math.hypot(canvas.clientWidth, canvas.height);
const fixedBrushSize = 10; // 고정된 브러시 크기

window.addEventListener("pointerdown", (e) => {
    isDrawing = true;
    points = [{ x: e.clientX, y: e.clientY }];
    console.log({ x: e.clientX, y: e.clientY });
});

let power = 1;
let count = 0;
window.addEventListener("pointermove", (e) => {
    if (!isDrawing) return;
    requestAnimationFrame(() => {
        // console.log({ x: e.clientX, y: e.clientY });
        points.push({ x: e.clientX, y: e.clientY });

        count++;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        draw();

        let now = points[points.length - 1];
        let last = points[points.length - 2];
        let dist = Math.hypot(last.x - now.x, last.y - now.y);
        if ( dist < (canvasSize / 100) * power) {
            points.pop();
        } else {
            count = 0;
        }
    });
});

window.addEventListener("pointerup", () => {
    isDrawing = false;
});

function normalize(vx, vy) {
    let mag = Math.sqrt(vx * vx + vy * vy);
    return { x: vx / mag, y: vy / mag };
}

function computeControlPoint(p0, p1, p2, power = 3) {
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

    for (let i = 0; i < points.length; i++) {
        drawCircle2(points[i]);
    }
}

function draw0(p0, p1) {
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y); // 시작점으로 이동
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke(); // 그리기
}
//draw1(points[0], points[1], points[2]);
function draw1(p0, p1, p2) {
    drawCircle(p0);
    drawCircle(p1);
    drawCircle(p2);

    let a0 = computeControlPoint(p0, p1, p2);
    drawCircle(a0, "blue");
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = fixedBrushSize; // 고정된 브러시 크기
    ctx.strokeStyle = "black"; // 브러시 색상 설정

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y); // 시작점으로 이동
    ctx.quadraticCurveTo(a0.x, a0.y, p1.x, p1.y);
    ctx.stroke(); // 그리기
}

//draw2(points[0], points[1], points[2], points[3]);
function draw2(p0, p1, p2, p3) {
    drawCircle(p0);
    drawCircle(p1);
    drawCircle(p2);
    drawCircle(p3);

    let a0 = computeControlPoint(p2, p1, p0);
    let a1 = computeControlPoint(p1, p2, p3);
    drawCircle(a0, "blue");
    drawCircle(a1, "blue");
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = fixedBrushSize; // 고정된 브러시 크기
    ctx.strokeStyle = "black"; // 브러시 색상 설정

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y); // 시작점으로 이동
    ctx.bezierCurveTo(a0.x, a0.y, a1.x, a1.y, p2.x, p2.y);
    ctx.stroke(); // 그리기
}

//draw3(points[1], points[2], points[3]);
function draw3(p0, p1, p2) {
    drawCircle(p0);
    drawCircle(p1);
    drawCircle(p2);

    let a0 = computeControlPoint(p2, p1, p0);
    drawCircle(a0, "green");
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = fixedBrushSize; // 고정된 브러시 크기
    ctx.strokeStyle = "black"; // 브러시 색상 설정

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y); // 시작점으로 이동
    ctx.quadraticCurveTo(a0.x, a0.y, p2.x, p2.y);
    ctx.stroke(); // 그리기
}
function drawCircle(point, color = "red") {
    // ctx.beginPath();
    // ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
    // ctx.fillStyle = color;
    // ctx.fill();
    // ctx.closePath();
}

function drawCircle2(point, color = "red") {
    // ctx.beginPath();
    // ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
    // ctx.fillStyle = color;
    // ctx.fill();
    // ctx.closePath();
}
