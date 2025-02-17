let canvas = document.querySelector("#canvas");
let gl = canvas.getContext("webgl2");
let precomputedTexture;
let precomputed2Texture;

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

    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

// 이미지 업로드함수
async function init() {
    try {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        // const response = await fetch("check_r.png");
        const response = await fetch("cat_4k.jpg");
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

        // 쉐이더 컴파일 함수
        function compileShader(type, source) {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.error(
                    "Shader compile failed:",
                    gl.getShaderInfoLog(shader),
                );
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        }

        const vertexShader = compileShader(
            gl.VERTEX_SHADER,
            vertexShaderSource,
        );
        const fragmentShader = compileShader(
            gl.FRAGMENT_SHADER,
            fragmentShaderSource,
        );

        // 프로그램 생성 및 링크
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error(
                "Program link failed:",
                gl.getProgramInfoLog(program),
            );
            return;
        }

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
let listData1;
let listNumValues1;
let listData2;
let listNumValues2;

async function presetting() {
    const response1 = await fetch("/data.bin");
    const arrayBuffer1 = await response1.arrayBuffer();
    listNumValues1 = arrayBuffer1.byteLength / 4;
    listData1 = new Float32Array(arrayBuffer1);

    const response2 = await fetch("/integralEase.bin");
    const arrayBuffer2 = await response2.arrayBuffer();
    listNumValues2 = arrayBuffer2.byteLength / 4;
    listData2 = new Float32Array(arrayBuffer2);

    const extFloatLinear =
        gl.getExtension("OES_texture_float_linear") ||
        gl.getExtension("EXT_texture_filter_float");
    if (!extFloatLinear) {
        console.warn(
            "This device does not support linear filtering for float textures.",
        );
    }
}

main();
async function main() {
    await presetting();
    await init();

    const width = canvas.width;
    const height = canvas.height;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0.5);

    const ext = gl.getExtension("EXT_color_buffer_float");
    if (!ext) {
        console.error("EXT_color_buffer_float not supported!");
    }

    // 1️⃣ Float32Array로 랜덤 데이터 생성
    const arrayData = new Float32Array(2 * width * height);
    for (let i = 0; i < arrayData.length; i++) {
        arrayData[i] = 0;
    }

    // 2️⃣ 원본 텍스처 생성 및 데이터 업로드
    const dd = gl.TEXTURE_2D;
    gl.activeTexture(gl.TEXTURE0);

    let texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
        dd,
        0,
        gl.RG32F,
        width,
        height,
        0,
        gl.RG,
        gl.FLOAT,
        arrayData,
    );
    // 행렬에 linear를 사용하는 이유는 getVector는 보간으로 값을 가져오기 대문에 여기서도 텍스처에 접근할 때 보간을 사용해서 가져와야한다.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // 3️⃣ 출력용 텍스처 생성
    let resultTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, resultTexture);
    gl.texImage2D(dd, 0, gl.RG32F, width, height, 0, gl.RG, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // 4️⃣ 프레임버퍼 생성 및 바인딩
    let framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        resultTexture,
        0,
    );

    // 5️⃣ 셰이더 컴파일 함수
    //function makeDisplaceProgram() {
    // 6️⃣ 수정용 셰이더 프로그램 생성
    let vertexShaderSource = `#version 300 es
        in vec2 a_position;
        out vec2 v_texCoord;
         out vec2 i_texCoord;

        uniform vec2 u_resolution;
        uniform sampler2D u_displacement;
        void main() {
            vec2 tex = a_position * 0.5 + 0.5;
            ivec2 texSize = textureSize(u_displacement, 0);
            v_texCoord = a_position * 0.5 + 0.5;
            i_texCoord = vec2(tex * u_resolution);
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
        `;
    let modifyFragmentShaderSource = `#version 300 es
        precision highp float;
        uniform sampler2D u_displacement;
        uniform sampler2D u_precomputed;
        uniform sampler2D u_precomputed2;
        
        uniform vec2 u_resolution;
        uniform vec2 u_start;
        uniform vec2 u_end;
        uniform float u_radius;
        uniform float u_strength;
        
        in vec2 v_texCoord;
        //flat in ivec2 i_texCoord;
        out vec2 outDisplacement;

        // 샘플링을 통한 ease 함수 구현 (정확한 결과를 위해 precomputed 텍스처 사용)
        float easeInOutCubicIntegral(float x) {
          // x를 [0,1]로 가정하고, 1D 텍스처에서 선형 보간
          //return x;
          return texture(u_precomputed, vec2(x, 0.5)).r;
        }
        float easeInOutCubicIntegralReal(float x) {
          return texture(u_precomputed2, vec2(x, 0.5)).r;
        }

        // getPower()와 유사한 로직: liquify 그리드 내에서 현재 픽셀의 영향력을 계산합니다.
        float getPower(vec2 centerCoord, vec2 d, float radius) {

            float len = length(d);
            if(len == 0.0){
                return 1.0;
            }
            float rCeil = ceil(radius);
            
            float gridWidth = abs(d.x) + 1.0 + 2.0 * rCeil;
            float gridHeight = abs(d.y) + 1.0 + 2.0 * rCeil;

            vec2 unit = d / len;
             
            float localStartX = (d.x > 0.0) ? rCeil : gridWidth - 1.0 - rCeil;
            float localStartY = (d.y > 0.0) ? rCeil : gridHeight - 1.0 - rCeil;
            vec2 localStart = vec2(localStartX, localStartY);
            
            vec2 v = centerCoord - localStart;
           
            float t = dot(v, unit);
            
            vec2 center = t * unit; // cx, cy
            vec2 d22 = v - center;
            float dist = length(d22);

           
             
            float percent = 1.0;
            float power = 0.0;
            if(t > 0.0 && t < len) {
                float value = min(1.0, dist / radius);
                float addValue = easeInOutCubicIntegral(value);
                power = addValue * radius * 2.0;
            }
            float vLength = length(v);
            if(vLength < radius) {
                float value = min(1.0, dist / radius);
                float addValue = easeInOutCubicIntegral(value);
                power = addValue * radius * 2.0 * percent;
            }
            vec2 eVec = v - d;
            float eLength = length(eVec);
            if(eLength < radius) {
                float value = min(1.0, dist / radius);
                float addValue = easeInOutCubicIntegral(value);
                power = addValue * radius * 2.0 * percent;
            }
            float originalCell = power;
            if(vLength < radius) {
                float gradation = (radius + t) / radius / 2.0;
                power -= originalCell * (1.0 - easeInOutCubicIntegralReal(gradation));
            }
            if(eLength < radius) {
                float gradation = (radius + (len - t)) / radius / 2.0;
                power -= originalCell * (1.0 - easeInOutCubicIntegralReal(gradation));
            }
            return power;
        }

        
        void main() {
        //texelFetch(u_precomputed, ivec2(500, 0), 0).r;
            //vec2 value = texelFetch(u_displacement, ivec2 (v_texCoord),0).xy;
            vec2 value = texture(u_displacement,v_texCoord ).xy;
            // 해당 픽셀의 좌표 ex) (250,360)
            vec2 pixel = v_texCoord * u_resolution; 
            float ceiledRadius = ceil(u_radius);

            vec2 minCoord = min(u_start, u_end) - vec2(ceiledRadius);
            vec2 maxCoord = max(u_start, u_end) + vec2(ceiledRadius);

            
            outDisplacement = value;
            // 영향 영역 밖은 기존 변위값 유지
            if(pixel.x < minCoord.x || pixel.x > maxCoord.x ||
                pixel.y < minCoord.y || pixel.y > maxCoord.y) {
                outDisplacement = value;
                return;
            }


            // liquify 그리드 계산 (CPU 코드와 동일한 방식)
            vec2 gridSize = abs(u_end - u_start) + vec2(1.0) + vec2(2.0 * ceiledRadius);
            vec2 startXY = min(u_start, u_end) - vec2(ceiledRadius);
            
            vec2 d = u_end - u_start;
            float len = length(d);
            vec2 unit = d / len;
            if(len == 0.0){
                return;
            }

            // 좌표 역순 보정: unit값에 따라 grid 좌표를 뒤집음          
            vec2 centerCoord = gridSize - 1.0 - pixel + startXY;
            
            float movementPower = getPower(centerCoord, d, u_radius);
          
            float diff = (movementPower * u_strength) / 2.0;

            // 기존 변위 텍스처에서 보간 (fastGetVector와 유사한 효과)
            vec2 displacedCoord = pixel - diff * unit;
            vec2 targetDisplace = displacedCoord / u_resolution;
        
            vec2 dispSample = texture(u_displacement, targetDisplace).xy;
            outDisplacement = dispSample - diff * unit;
            
            return;
        }
        `;

    let vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    let modifyShader = createShader(
        gl.FRAGMENT_SHADER,
        modifyFragmentShaderSource,
    );
    let modifyProgram = createProgram(gl, vertexShader, modifyShader);
    gl.useProgram(modifyProgram);
    // 기본적인 유니폼 변수 설정.
    let texLoc = gl.getUniformLocation(modifyProgram, "u_displacement");
    gl.uniform1i(texLoc, 0);
    gl.uniform2f(
        gl.getUniformLocation(modifyProgram, "u_resolution"),
        width,
        height,
    );

    const precomputedTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, precomputedTexture);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R32F,
        listNumValues1,
        1,
        0,
        gl.RED,
        gl.FLOAT,
        listData1,
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.uniform1i(gl.getUniformLocation(modifyProgram, "u_precomputed"), 2);

    console.log(listData1); // 길이 1000인 1차원 배열
    // 적분2
    const precomputed2Texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, precomputed2Texture);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R32F,
        listNumValues2,
        1,
        0,
        gl.RED,
        gl.FLOAT,
        listData2,
    );

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(gl.getUniformLocation(modifyProgram, "u_precomputed2"), 3);

    let positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
        gl.STATIC_DRAW,
    );
    let posLoc = gl.getAttribLocation(modifyProgram, "a_position");
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
            // if (target.x < 0.0 || target.x > 1.0 ||
            //     target.y < 0.0 || target.y > 1.0) {
            //     // 경계 외부는 투명색 반환
            //     outColor = vec4(0.0, 0.0, 0.0, 0.0);
            // } else {
                
            // }
            outColor = texture(u_originalTexture, target);

        }
        `;

    let colorShader = createShader(gl.FRAGMENT_SHADER, colorShaderSource);
    let colorProgram = createProgram(gl, vertexShader, colorShader);
    gl.useProgram(colorProgram);
    let finalTexLoc = gl.getUniformLocation(colorProgram, "u_displacement");
    gl.uniform1i(finalTexLoc, 0);
    gl.uniform2f(
        gl.getUniformLocation(colorProgram, "u_resolution"),
        width,
        height,
    );

    let posLoc2 = gl.getAttribLocation(colorProgram, "a_position");
    gl.enableVertexAttribArray(posLoc2);
    gl.vertexAttribPointer(posLoc2, 2, gl.FLOAT, false, 0, 0);

    // 1. 원본 이미지 텍스처 생성
    //    (이미지는 캔버스에 그려져 있다고 가정하므로, 캔버스 내용을 텍스처로 업로드)
    let originalTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, originalTexture);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const originalTexLoc = gl.getUniformLocation(
        colorProgram,
        "u_originalTexture",
    );
    gl.uniform1i(originalTexLoc, 1); // 텍스처 유닛 1에 할당
    //gl.activeTexture(gl.TEXTURE0);

    let read = texture;
    let write = resultTexture;

    let radius = 500;
    let strength = 1;

    let start = { x: 100, y: 300 };
    let end = { x: 2000, y: 2000 };

    let dirtyRect = { x: 0, y: 0, width: 0, height: 0 };
    function changeVector() {
        gl.useProgram(modifyProgram);
        // 유나폼 변수 설정
        gl.uniform1f(gl.getUniformLocation(modifyProgram, "u_radius"), radius);
        gl.uniform1f(
            gl.getUniformLocation(modifyProgram, "u_strength"),
            strength,
        );

        let startLoc = gl.getUniformLocation(modifyProgram, "u_start");
        gl.uniform2f(startLoc, start.x, height - start.y);
        let endLoc = gl.getUniformLocation(modifyProgram, "u_end");
        gl.uniform2f(endLoc, end.x, height - end.y);

        let ceiledRadius = Math.ceil(radius);
        let minX = Math.min(start.x, end.x);
        let maxX = Math.max(start.x, end.x);

        let minY = Math.min(height - start.y, height - end.y);
        let maxY = Math.max(height - start.y, height - end.y);

        // gl.viewport(
        //     0,
        //     0,
        //     maxX - minX + 1 + 2 * ceiledRadius,
        //     maxY - minY + 1 + 2 * ceiledRadius,
        // );

        // 쓰기 영역: 내 벡터맵

        // 예: x=100, y=200, 너비=300, 높이=400 영역만 갱신
        gl.enable(gl.SCISSOR_TEST);
        dirtyRect.x = minX - ceiledRadius;
        dirtyRect.y = minY - ceiledRadius;
        dirtyRect.width = maxX - minX + 1 + 2 * ceiledRadius;
        dirtyRect.height = maxY - minY + 1 + 2 * ceiledRadius;
        gl.scissor(dirtyRect.x, dirtyRect.y, dirtyRect.width, dirtyRect.height);
        //gl.clear(gl.COLOR_BUFFER_BIT);

        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        // 읽기 텍스처 설정
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, read);
        // 프레임버퍼에 쓰기 텍스처 넣기
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            write,
            0,
        );

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // 출력
        //let debugData = new Float32Array(width * height);
        //gl.readPixels(0, 0, width, height, gl.RED, gl.FLOAT, debugData);
        // console.log(debugData.slice(0, 10));

        let temp = read;
        read = write;
        write = temp;
    }

    // 🛠️ 1️⃣ 전체 화면 크기의 Dirty FBO 생성 (앱 초기화 시 1회만)
    const dirtyFBO = gl.createFramebuffer();
    const dirtyTex = gl.createTexture();

    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, dirtyTex);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // FBO 설정
    gl.bindFramebuffer(gl.FRAMEBUFFER, dirtyFBO);
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        dirtyTex,
        0,
    );

    // FBO 정상 구성 확인
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        console.error("FBO 생성 실패!");
    }

    function render() {
        // 위에서 enable(gl.SCISSOR_TEST); 하고 영역 설정 다함
        gl.useProgram(colorProgram);
        // 쓰기 영역: 내 화면
        //gl.bindFramebuffer(gl.FRAMEBUFFER, dirtyFBO);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // 읽는 벡터맵 설정
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, read);

        //gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.disable(gl.SCISSOR_TEST);

        // gl.bindFramebuffer(gl.READ_FRAMEBUFFER, dirtyFBO);
        // gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null); // 기본 화면

        // gl.blitFramebuffer(
        //     dirtyRect.x,
        //     dirtyRect.y,
        //     dirtyRect.x + dirtyRect.width,
        //     dirtyRect.y + dirtyRect.height,
        //     dirtyRect.x,
        //     dirtyRect.y,
        //     dirtyRect.x + dirtyRect.width,
        //     dirtyRect.y + dirtyRect.height,
        //     gl.COLOR_BUFFER_BIT,
        //     gl.NEAREST,
        // );

        // gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        // gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    }

    function plusForce() {
        radius += 2;
        console.log(radius);
    }
    function minusForce() {
        radius -= 2;
        console.log(radius);
    }

    ///////////////////////

     changeVector();

    render();

    document.querySelector("#btn").addEventListener("click", () => {
        changeVector();
        render();
    });

    document.querySelector("#edit").addEventListener("click", () => {
        changeVector();
    });

    document.querySelector("#render").addEventListener("click", () => {
        render();
    });

    document.querySelector("#plus").addEventListener("click", () => {
        plusForce();
    });

    document.querySelector("#minus").addEventListener("click", () => {
        minusForce();
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
        start = end;
        end = { x: event.clientX, y: event.clientY };
        //console.log(start, end);
        changeVector();
        render();
        //gl.finish();
        //console.timeEnd('GPU 4K Pass');
    });

    window.addEventListener("pointerup", (event) => {
        active = false;
        //end = { x: event.clientX, y: event.clientY };
        //changeVector();
        //render();
    });
}
