let canvas = document.querySelector("#canvas");
let gl = canvas.getContext("webgl2");

// 이미지 업로드함수
async function init() {
    try {
        const response = await fetch("check_r.png");
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

main();
async function main() {
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
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // 3️⃣ 출력용 텍스처 생성
    let resultTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, resultTexture);
    gl.texImage2D(dd, 0, gl.RG32F, width, height, 0, gl.RG, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

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
        void main() {
            v_texCoord = a_position * 0.5 + 0.5;
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
        `;
    let modifyFragmentShaderSource = `#version 300 es
        precision highp float;
        uniform sampler2D u_texture22;
        
        uniform vec2 u_resolution;
        uniform vec2 u_start;
        uniform vec2 u_end;
        uniform float u_radius;
        uniform float u_strength;
        
        in vec2 v_texCoord;
        out vec2 outDisplacement;
        void main() {
            vec2 pixel = v_texCoord * u_resolution; 
            float ceiledRadius = ceil(u_radius);

            vec2 minCoord = min(u_start, u_end) - vec2(ceiledRadius);
            vec2 maxCoord = max(u_start, u_end) + vec2(ceiledRadius);
           
            vec2 value = texture(u_texture22, v_texCoord).rg;
        
            vec2 pixelCoord = v_texCoord * u_resolution; 
            float x = pixel[0];
            float y = pixel[1];
            float dist = sqrt((x-u_start[0]) *(x-u_start[0]) + (y-u_start[1])*(y-u_start[1]));
            if(dist<u_radius){
                outDisplacement =  value + vec2(1,1);
            }else{
                outDisplacement = value;
            }

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
    let texLoc = gl.getUniformLocation(modifyProgram, "u_texture");
    gl.uniform1i(texLoc, 0);
    gl.uniform2f(
        gl.getUniformLocation(modifyProgram, "u_resolution"),
        width,
        height,
    );

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
        uniform sampler2D u_texture;
        uniform sampler2D u_originalTexture;  // 원본 텍스처 추가
        in vec2 v_texCoord;
        out vec4 outColor;
        
        void main() {
            vec2 value = texture(u_texture, v_texCoord).xy;
            vec2 canvas_size = vec2(textureSize(u_texture, 0));
            vec2 dif = value/canvas_size;
            
            vec4 image =  texture(u_originalTexture, v_texCoord+dif);
        
           
           
            
            if (value.x > 0.0) {
            
              // vec4 image2 =  texture(u_originalTexture, v_texCoord+dif);
               //outColor = image2;
             
               // outColor = vec4(0.5, 0.0, 0.0, 1.0);
            } else {
               //outColor = image;
            }
            outColor = image;
        }
        `;

    let colorShader = createShader(gl.FRAGMENT_SHADER, colorShaderSource);
    let colorProgram = createProgram(gl, vertexShader, colorShader);
    gl.useProgram(colorProgram);
    let finalTexLoc = gl.getUniformLocation(colorProgram, "u_texture22");
    gl.uniform1i(finalTexLoc, 0);
    // 1. 원본 이미지 텍스처 생성
    //    (이미지는 캔버스에 그려져 있다고 가정하므로, 캔버스 내용을 텍스처로 업로드)
    gl.activeTexture(gl.TEXTURE1);
    let originalTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, originalTexture);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
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

    let radius = 50;
    let strength = 1;

    let start = { x: 100, y: 100 };
    let end = { x: 0, y: 0 };

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
        gl.uniform1f(endLoc, end.x, height - end.y);

        // 쓰기 영역: 내 벡터맵

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
        let debugData = new Float32Array(width * height);
        gl.readPixels(0, 0, width, height, gl.RED, gl.FLOAT, debugData);
        console.log(debugData.slice(0, 10));

        let temp = read;
        read = write;
        write = temp;
    }

    function render() {
        gl.useProgram(colorProgram);
        // 쓰기 영역: 내 화면
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        // 읽는 벡터맵 설정
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, read);

        //gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
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

    window.addEventListener("pointerdown", (event) => {
        start = { x: event.clientX, y: event.clientY };
    });

    window.addEventListener("pointerup", (event) => {
        end = { x: event.clientX, y: event.clientY };
        changeVector();
        render();

        console.log(start, end);
    });
}
