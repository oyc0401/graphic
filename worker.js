// worker.js
import { Liquify } from "./liquify";

let canvas, ctx;
const EFFECT_RADIUS = 10; // 뒤틀기 효과 반경
const MAGNIFY_STRENGTH = 1; // 강도: +이면 정방향, -이면 역방향

// 마우스(포인터) 좌표 기록 변수
let positions = [];
let isTracking = false;
let lastIndex = 0;
let distance = 0;

let liquify;
// 웹워커 메시지 핸들러 (원래 코드 로직을 그대로 유지)
onmessage = async function (e) {
    const data = e.data;
    if (data.type === "init") {
        // OffscreenCanvas와 이미지 URL을 받습니다.
        canvas = data.canvas;
        ctx = canvas.getContext("2d");

        try {
            // 웹워커에서는 fetch()와 createImageBitmap()으로 이미지 로드
            const response = await fetch(data.imageUrl);
            const blob = await response.blob();
            const imgBitmap = await createImageBitmap(blob);

            // 캔버스 크기를 이미지 크기에 맞춥니다.
            canvas.width = imgBitmap.width;
            canvas.height = imgBitmap.height;
            ctx.drawImage(imgBitmap, 0, 0);

            liquify = new Liquify(canvas, ctx);
            liquify.setRadius(EFFECT_RADIUS);
            liquify.setStrength(MAGNIFY_STRENGTH);
        } catch (err) {
            console.error("이미지 로드 실패:", err);
        }
    } else if (data.type === "pointerdown") {
        isTracking = true;
        positions = []; // 이전 데이터 초기화
        lastIndex = 0;
        distance = 0;
    } else if (data.type === "pointermove") {
        if (!isTracking) return;
        const { x, y } = data;
        //console.log("move", x, y);
        positions.push({ x, y });
        if (positions.length < 2) {
            return;
        }
        //execute();
    } else if (data.type === "pointerup") {
        isTracking = false;
        liquify.apply(positions[0], positions[positions.length-1]);
         liquify.renderToImage(0,0,canvas.width, canvas.height);
        console.log("Tracking 종료. 기록된 좌표:");
    }
};

let queued = false;
function execute() {
    if (!queued) {
        queued = true;

        requestAnimationFrame(doit);
    }
}

function doit(){

    const slicedArray = positions.slice(lastIndex, positions.length);
    lastIndex = positions.length - 1;

    const start = slicedArray[0];
    const end = slicedArray[slicedArray.length - 1];

   // console.log(start, end);
    liquify.apply(start, end);

    // 렌더링 영역 계산
    let minX = Math.min(start.x, end.x);
    let minY = Math.min(start.y, end.y);
    let maxX = Math.max(start.x, end.x);
    let maxY = Math.max(start.y, end.y);

    liquify.renderToImage(minX, minY, maxX, maxY);
//console.log("render!");

    queued = false;
}
