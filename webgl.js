let canvas = document.querySelector("#canvas");
let gl = canvas.getContext("webgl2");

const width = 500;
const height = 500;
canvas.width = width;
canvas.height = height;
gl.viewport(0, 0, width, height);

const ext = gl.getExtension("EXT_color_buffer_float");
if (!ext) {
    console.error("EXT_color_buffer_float not supported!");
}
// 1️⃣ Float32Array로 랜덤 데이터 생성
const arrayData = new Float32Array(width * height);
for (let i = 0; i < arrayData.length; i++) {
    arrayData[i] = Math.random() * 1000;
}

// 2️⃣ 원본 텍스처 생성 및 데이터 업로드
const dd = gl.TEXTURE_2D;

let texture = gl.createTexture();
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.texImage2D(dd, 0, gl.R32F, width, height, 0, gl.RED, gl.FLOAT, arrayData);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

// 3️⃣ 출력용 텍스처 생성
let resultTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, resultTexture);
gl.texImage2D(dd, 0, gl.R32F, width, height, 0, gl.RED, gl.FLOAT, null);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

gl.activeTexture(gl.TEXTURE0);
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
uniform sampler2D u_texture;
in vec2 v_texCoord;
out vec4 outColor;
void main() {
    float value = texture(u_texture, v_texCoord).r;
    bool isBig = value>300.0;
    if (isBig) {
        value *= -0.8;
    } else {
        value *= 1.2;
    }
    outColor = vec4(value, 0.0, 0.0, 0.0);
}
`;

let vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
let modifyShader = createShader(gl.FRAGMENT_SHADER, modifyFragmentShaderSource);
let modifyProgram = createProgram(gl, vertexShader, modifyShader);

// 7️⃣ 화면에 그려서 텍스처 수정
let vao = gl.createVertexArray();
gl.bindVertexArray(vao);

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

let read = texture;
let write = resultTexture;

changeVector();
changeVector();
changeVector();

function changeVector() {
    gl.useProgram(modifyProgram);
    let texLoc = gl.getUniformLocation(modifyProgram, "u_texture");
    gl.uniform1i(texLoc, 0);

    // 쓰기 영역: 내 벡터맵
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    // 읽기 텍스처 설정
    gl.bindTexture(gl.TEXTURE_2D, read);
    // 쓰기영역에 쓰기 텍스처 넣기
    gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        write,
        0,
    );

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    let debugData = new Float32Array(width * height);
    gl.readPixels(0, 0, width, height, gl.RED, gl.FLOAT, debugData);
    console.log(debugData.slice(0, 10));

    let temp = read;
    read = write;
    write = temp;
}

let colorShaderSource = `#version 300 es
precision highp float;
uniform sampler2D u_texture;
in vec2 v_texCoord;
out vec4 outColor;
void main() {
    float value = texture(u_texture, v_texCoord).r;
    if (value > 0.0) {
        outColor = vec4(0.5, 0.0, 0.0, 1.0);
    } else {
        outColor = vec4(0.0, 0.0, 0.5, 1.0);
    }
}
`;

let colorShader = createShader(gl.FRAGMENT_SHADER, colorShaderSource);
let colorProgram = createProgram(gl, vertexShader, colorShader);

render();

function render() {
    gl.useProgram(colorProgram);
    // 쓰기 영역: 내 화면
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    let finalTexLoc = gl.getUniformLocation(colorProgram, "u_texture");
    gl.uniform1i(finalTexLoc, 0);

    // 읽는 벡터맵 설정
    gl.bindTexture(gl.TEXTURE_2D, write);

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

let btn = document.querySelector("#btn");
btn.addEventListener("click", () => {
    changeVector();
    render();
});

let render_btn = document.querySelector("#render");
render_btn.addEventListener("click", () => {
    render();
});
