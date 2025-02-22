let canvas = document.querySelector("#canvas");
let ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
ctx.fillStyle = "rgb(240,240,240)";
ctx.fillRect(0, 0, canvas.width, canvas.height);
let canvasSize = Math.hypot(window.innerWidth, window.innerHeight);
// window.addEventListener("resize", () => {
//     canvas.width = window.innerWidth;
//     canvas.height = window.innerHeight;
// });

let isDrawing = false;
let points = [
    { x: 864, y: 219 },
    { x: 378, y: 799 },
    { x: 142, y: 484 },
    { x: 430, y: 117 },
    { x: 836, y: 126 },
    { x: 1023, y: 670 },
];

const brushSize = 10;

window.addEventListener("pointerdown", (e) => {
    isDrawing = true;
    points = [{ x: e.clientX, y: e.clientY }];
    console.log({ x: e.clientX, y: e.clientY });
});

window.addEventListener("pointermove", (e) => {
    if (!isDrawing) return;
    requestAnimationFrame(() => {
        // console.log({ x: e.clientX, y: e.clientY });
        points.push({ x: e.clientX, y: e.clientY });

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawSpline();
    });
});

window.addEventListener("pointerup", () => {
    isDrawing = false;
});

ctx.lineJoin = "round";
ctx.lineCap = "round";
ctx.lineWidth = brushSize; // 고정된 브러시 크기
ctx.strokeStyle = "black"; // 브러시 색상 설정
drawSpline();

function catmullRom(p0, p1, p2, p3, t) {
    let t2 = t * t;
    let t3 = t2 * t;

    return {
        x:
            0.5 *
            (2 * p1.x +
                (-p0.x + p2.x) * t +
                (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
            0.5 *
            (2 * p1.y +
                (-p0.y + p2.y) * t +
                (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    };
}

function catmullRomList(p0, p1, p2, p3, segments = 10) {
    let result = [];

    for (let i = 1; i <= segments; i++) {
        let t = i / segments;
        let p = catmullRom(p0, p1, p2, p3, t);
        result.push(p); // 일정 거리 이상일 때만 점 추가
    }
    //console.log(result.length);
    return result;
}

function drawSpline() {
    if (points.length < 4) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 2; i++) {
        let catmulList = catmullRomList(
            points[i - 1],
            points[i],
            points[i + 1],
            points[i + 2],
        );
        for (let p of catmulList) {
            ctx.lineTo(p.x, p.y);
        }
    }

    ctx.stroke();
}
