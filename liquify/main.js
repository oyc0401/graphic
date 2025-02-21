import {
    getIntegralEaseInOut,
    getIntegralEaseInOutMirror,
} from "./cachedIntegrals";

let canvas = document.querySelector("#canvas");
const gl = canvas.getContext("webgl2", {
    depth: false,
    stencil: false,
    antialias: false,
    preserveDrawingBuffer: true,
});
let integralData;
let integralMirrorData;

// 헬퍼 함수
function createShader(type, source) {
    let shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    var success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }

    console.log("Program link failed:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

async function loadShader(url) {
    const response = await fetch(url);
    return await response.text();
}

function setTexture(program, number) {}

// 이미지 업로드함수
async function init() {
    try {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        //const response = await fetch("check_r.png");
        const response = await fetch("../cat_3k.jpg");
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
            imgBitmap,
        );

        // 텍스처 파라미터 설정
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // 간단한 쉐이더 생성
        const vertexShaderSource = `#version 300 es
          in vec2 a_position;
          in vec2 a_texcoord;
          out vec2 v_texcoord22;

          void main() {
              gl_Position = vec4(a_position, 0, 1);
              v_texcoord22 = a_texcoord;
          }
      `;

        const fragmentShaderSource = `#version 300 es
          precision mediump float;
          in vec2 v_texcoord22;
          uniform sampler2D u_image;
          out vec4 fragColor;
          void main() {
               fragColor = texture(u_image, v_texcoord22);
          }
      `;

        const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = createShader(
            gl.FRAGMENT_SHADER,
            fragmentShaderSource,
        );

        // 프로그램 생성 및 링크
        const program = createProgram(gl, vertexShader, fragmentShader);
        gl.useProgram(program);

        // 버퍼 생성 및 데이터 전송
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        const positions = new Float32Array([
            -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
        ]);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        const texcoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
        const texcoords = new Float32Array([
            0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0,
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
    } catch (err) {
        console.error("이미지 로드 실패:", err);
    }
}

async function presetting() {
    integralData = await getIntegralEaseInOut();
    integralMirrorData = await getIntegralEaseInOutMirror();
}

main();

async function main() {
    await presetting();
    await init();

    const width = canvas.width;
    const height = canvas.height;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);

    const ext = gl.getExtension("EXT_color_buffer_float");
    if (!ext) {
        console.error("EXT_color_buffer_float not supported!");
    }
    const extFloatLinear =
        gl.getExtension("OES_texture_float_linear") ||
        gl.getExtension("EXT_texture_filter_float");
    if (!extFloatLinear) {
        console.warn(
            "This device does not support linear filtering for float textures.",
        );
    }

    // 셰이더 프로그램 생성
    let vertexShaderSource = `#version 300 es
      in vec2 a_position;
      out vec2 v_texCoord; // 좌표변환: 0 ~ 1

      uniform vec2 u_resolution;
      uniform sampler2D u_displacement;
      
      void main() {
          v_texCoord = a_position * 0.5 + 0.5;
          gl_Position = vec4(a_position, 0.0, 1.0);
      }
      `;

    let liquifyPushFragSrc = await loadShader("liquify.glsl");
    let vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    let liquifyPushShader = createShader(
        gl.FRAGMENT_SHADER,
        liquifyPushFragSrc,
    );
    let liquifyPushProgram = createProgram(gl, vertexShader, liquifyPushShader);
    gl.useProgram(liquifyPushProgram);

    gl.uniform2f(
        gl.getUniformLocation(liquifyPushProgram, "u_resolution"),
        width,
        height,
    );

    const emptyData = new Float32Array(width * height * 2);

    // 원본 텍스처 생성 및 데이터 업로드
    let displacementTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, displacementTex);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RG32F,
        width,
        height,
        0,
        gl.RG,
        gl.FLOAT,
        emptyData,
    );
    // 행렬에 linear를 사용하는 이유는 기존의 getVector는 보간으로 값을 가져오기 대문에
    // 여기서도 텍스처에 접근할 때 보간을 사용해서 가져와야한다.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(
        gl.getUniformLocation(liquifyPushProgram, "u_displacement"),
        0,
    );

    // 출력용 텍스처 생성
    let displacementTexOut = gl.createTexture();
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, displacementTexOut);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RG32F,
        width,
        height,
        0,
        gl.RG,
        gl.FLOAT,
        null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const integralTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, integralTex);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R32F,
        integralData.length,
        1,
        0,
        gl.RED,
        gl.FLOAT,
        integralData,
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(liquifyPushProgram, "u_precomputed"), 2);

    const integralMirrorTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, integralMirrorTex);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R32F,
        integralMirrorData.length,
        1,
        0,
        gl.RED,
        gl.FLOAT,
        integralMirrorData,
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(
        gl.getUniformLocation(liquifyPushProgram, "u_precomputed2"),
        3,
    );

    // 프레임버퍼 생성 및 바인딩
    let framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        displacementTexOut,
        0,
    );

    // 쓰여진 결과를 기본 변위맵에 업로드 하기 위해서
    let readFrameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readFrameBuffer);
    gl.framebufferTexture2D(
        // 당장 안쓰더라도 바인딩 해놓으면 내부에서 자체 최적화 되나?
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        displacementTexOut,
        0,
    );

    let positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
        gl.STATIC_DRAW,
    );
    let posLoc = gl.getAttribLocation(liquifyPushProgram, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    let colorShaderSource = `#version 300 es
      precision highp float;
      uniform sampler2D u_displacement;
      uniform sampler2D u_originalTexture;  // 원본 텍스처 추가
      uniform vec2 u_resolution;

      in vec2 v_texCoord;
      out vec4 outColor;

      void main() {
          vec2 value = texture(u_displacement, v_texCoord).xy;
          vec2 dif = value / u_resolution;

          vec2 target = v_texCoord + dif;
          // 범위 넘어가면 투명하게 되는건 나중에 구현이 더 필요함.
          // 테두리 보간 해야함!
          if (target.x < 0.0 || target.x > 1.0 ||
              target.y < 0.0 || target.y > 1.0) {
              // 경계 외부는 투명색 반환
              outColor = vec4(0.0, 0.0, 0.0, 0.0);
          } else {
               outColor = texture(u_originalTexture, target);
          }
      }
      `;

    let renderShader = createShader(gl.FRAGMENT_SHADER, colorShaderSource);
    let renderProgram = createProgram(gl, vertexShader, renderShader);
    gl.useProgram(renderProgram);
    gl.uniform2f(
        gl.getUniformLocation(renderProgram, "u_resolution"),
        width,
        height,
    );
    gl.uniform1i(gl.getUniformLocation(renderProgram, "u_displacement"), 0);

    // 원본 이미지 텍스처 생성
    // (이미지는 캔버스에 그려져 있다고 가정하므로, 캔버스 내용을 텍스처로 업로드)
    let originalTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, originalTexture);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(renderProgram, "u_originalTexture"), 1); // 텍스처 유닛 1에 할당

    let posLoc2 = gl.getAttribLocation(renderProgram, "a_position");
    gl.enableVertexAttribArray(posLoc2);
    gl.vertexAttribPointer(posLoc2, 2, gl.FLOAT, false, 0, 0);


    ////////////////

    let radius = 500;
    let strength = 1;

    let start = { x: 0, y: 0 };
    let end = { x: 0, y: 0 };

    let dirtyRect = { x: 0, y: 0, ex: 0, ey: 0, width: 0, height: 0 };

    function changeVector(start, end) {
        gl.useProgram(liquifyPushProgram);
        // 유나폼 변수 설정
        gl.uniform1f(
            gl.getUniformLocation(liquifyPushProgram, "u_radius"),
            radius,
        );
        gl.uniform1f(
            gl.getUniformLocation(liquifyPushProgram, "u_strength"),
            strength,
        );

        gl.uniform2f(
            gl.getUniformLocation(liquifyPushProgram, "u_start"),
            start.x,
            height - start.y,
        );
        gl.uniform2f(
            gl.getUniformLocation(liquifyPushProgram, "u_end"),
            end.x,
            height - end.y,
        );

        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        // 프레임버퍼에 쓰기 텍스처 넣기
        // 이전에 blit할때 다른거 지정되어있었음
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            displacementTexOut,
            0,
        );

        let ceiledRadius = Math.ceil(radius);
        let minX = Math.min(start.x, end.x);
        let maxX = Math.max(start.x, end.x);
        let minY = Math.min(height - start.y, height - end.y);
        let maxY = Math.max(height - start.y, height - end.y);

        dirtyRect.x = minX - ceiledRadius;
        dirtyRect.y = minY - ceiledRadius;
        dirtyRect.ex = maxX + ceiledRadius + 1;
        dirtyRect.ey = maxY + ceiledRadius + 1;
        dirtyRect.width = maxX - minX + 1 + 2 * ceiledRadius;
        dirtyRect.height = maxY - minY + 1 + 2 * ceiledRadius;

        // SCISSOR TEST로 일부만 렌더링
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(dirtyRect.x, dirtyRect.y, dirtyRect.width, dirtyRect.height);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        //gl.finish();

        // 적용된 텍스처를 read에도 옮기기
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readFrameBuffer);
        gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, framebuffer);

        gl.framebufferTexture2D(
            gl.READ_FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            displacementTexOut,
            0,
        );

        gl.framebufferTexture2D(
            gl.DRAW_FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            displacementTex,
            0,
        );

        gl.blitFramebuffer(
            dirtyRect.x,
            dirtyRect.y,
            dirtyRect.ex,
            dirtyRect.ey, // 소스
            dirtyRect.x,
            dirtyRect.y,
            dirtyRect.ex,
            dirtyRect.ey, // 대상
            gl.COLOR_BUFFER_BIT,
            gl.NEAREST,
        );
    }

    function render() {
        gl.useProgram(renderProgram);
        // 쓰기 영역: 내 화면
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.disable(gl.SCISSOR_TEST);
    }
    
    ///////////////////////

    render();

    //////////////////////////
    document.querySelector("#btn").addEventListener("click", () => {
        let result = prompt("반지름을 입력해주세요");

        if (result && !isNaN(result)) {
            radius = parseFloat(result);
            console.log("입력된 반지름:", radius);
        } else {
            console.log("유효한 숫자를 입력해주세요.");
        }
    });
    
    let active = false;
    window.addEventListener("pointerdown", (event) => {
        active = true;
        start = { x: event.clientX, y: event.clientY };
        end = { x: event.clientX, y: event.clientY };
    });

    window.addEventListener("pointermove", (event) => {
        if (!active) return;
        //Console.time('GPU 4K Pass');

        end = { x: event.clientX, y: event.clientY };
        //console.log(start, end);

        let length = Math.hypot(end.x - start.x, end.y - start.y);
        if (length > radius / 25) {
            changeVector(start, end);
            render();
            start = end;
        }
    });

    window.addEventListener("pointerup", (event) => {
        active = false;
        render();

        // console.log("pointerup");
    });
}
