// worker.js
import { Liquify } from "./liquify";

let canvas, ctx;
const EFFECT_RADIUS = 100; // 뒤틀기 효과 반경
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
        const gl = canvas.getContext("webgl2");

        try {
            // 웹워커에서는 fetch()와 createImageBitmap()으로 이미지 로드
            const response = await fetch(data.imageUrl);
            const blob = await response.blob();
            const imgBitmap = await createImageBitmap(blob);

            canvas.width = imgBitmap.width;
            canvas.height = imgBitmap.height;
            gl.viewport(0, 0, canvas.width, canvas.height);
            
            // WebGL 텍스처 생성
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);

            // 이미지를 WebGL 텍스처로 업로드
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                imgBitmap
            );

            // 텍스처 파라미터 설정
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            // 간단한 쉐이더 생성
            const vertexShaderSource = `
                attribute vec2 a_position;
                attribute vec2 a_texcoord;
                varying vec2 v_texcoord;
                void main() {
                    gl_Position = vec4(a_position, 0, 1);
                    v_texcoord = a_texcoord;
                }
            `;


            const fragmentShaderSource = `
                precision mediump float;
                varying vec2 v_texcoord;
                uniform sampler2D u_image;
                void main() {
                    gl_FragColor = texture2D(u_image, v_texcoord);
                }
            `;

            // 쉐이더 컴파일 함수
            function compileShader(type, source) {
                const shader = gl.createShader(type);
                gl.shaderSource(shader, source);
                gl.compileShader(shader);
                if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                    console.error("Shader compile failed:", gl.getShaderInfoLog(shader));
                    gl.deleteShader(shader);
                    return null;
                }
                return shader;
            }

            const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
            const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

            // 프로그램 생성 및 링크
            const program = gl.createProgram();
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);

            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                console.error("Program link failed:", gl.getProgramInfoLog(program));
                return;
            }

            gl.useProgram(program);

            // 버퍼 생성 및 데이터 전송
            const positionBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            const positions = new Float32Array([
                -1, -1,
                 1, -1,
                -1,  1,
                -1,  1,
                 1, -1,
                 1,  1,
            ]);
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

            const texcoordBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
            const texcoords = new Float32Array([
                0, 1,
                1, 1,
                0, 0,
                0, 0,
                1, 1,
                1, 0,
            ]);
            gl.bufferData(gl.ARRAY_BUFFER, texcoords, gl.STATIC_DRAW);

            const positionLocation = gl.getAttribLocation(program, "a_position");
            const texcoordLocation = gl.getAttribLocation(program, "a_texcoord");

            
            // 위치 버퍼 바인딩
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

            // 텍스처 좌표 버퍼 바인딩
            gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
            gl.enableVertexAttribArray(texcoordLocation);
            gl.vertexAttribPointer(texcoordLocation, 2, gl.FLOAT, false, 0, 0);

            // 이미지 렌더링
            gl.drawArrays(gl.TRIANGLES, 0, 6);

            const ext = gl.getExtension("EXT_color_buffer_float");
            if (!ext) {
              console.error("EXT_color_buffer_float not supported!");
            }

            liquify = new Liquify(canvas, gl);
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
        execute();
    } else if (data.type === "pointerup") {
        isTracking = false;
        liquify.render()
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

    console.log(start, end);
    liquify.apply(start, end);

    // // 렌더링 영역 계산
    let minX = Math.min(start.x, end.x);
    let minY = Math.min(start.y, end.y);
    let maxX = Math.max(start.x, end.x);
    let maxY = Math.max(start.y, end.y);

    liquify.render(minX, minY, maxX, maxY);
//console.log("render!");

    queued = false;
}
