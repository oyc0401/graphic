// 1. WebGL 컨텍스트 가져오기
const canvas = document.getElementById('canvas');
const gl = canvas.getContext('2d');

gl.fillStyle='rgb(150,0,0)';
gl.fillRect(20,20,40,40);
gl.fillRect(180,180,40,40);

gl.fillStyle='rgb(150,65,0)';
gl.beginPath();
gl.arc (100, 100, 20, 0, Math.PI*2, false );
gl.stroke(); 
gl.fill();

const cvs=change_color(canvas,
             0,0,
             200,200,
             140,160,
             0,20,
             0,20,
             0,255,
             [150,255,56,255]);

const canvas2d = document.getElementById('2d-canvas');
const ctx = canvas2d.getContext('2d');
ctx.drawImage(cvs,0,0)


/**
 * 2D 캔버스에서 특정 영역(x, y, width, height)의 픽셀 중,
 * RGBA가 지정한 범위([minR..maxR], [minG..maxG], [minB..maxB], [minA..maxA])에 들어있는 픽셀을
 * toChangeColor로 변경한 결과를 WebGL 캔버스로 만들어 반환합니다.
 *
 * @param {HTMLCanvasElement} canvas - 원본 2D Canvas
 * @param {number} x - 변경할 영역의 시작 X 좌표
 * @param {number} y - 변경할 영역의 시작 Y 좌표
 * @param {number} width - 변경할 영역의 폭
 * @param {number} height - 변경할 영역의 높이
 * @param {number} minR - 변경 색 범위의 최소 R값 (0~255)
 * @param {number} maxR - 변경 색 범위의 최대 R값 (0~255)
 * @param {number} minG - 변경 색 범위의 최소 G값 (0~255)
 * @param {number} maxG - 변경 색 범위의 최대 G값 (0~255)
 * @param {number} minB - 변경 색 범위의 최소 B값 (0~255)
 * @param {number} maxB - 변경 색 범위의 최대 B값 (0~255)
 * @param {number} minA - 변경 색 범위의 최소 A값 (0~255)
 * @param {number} maxA - 변경 색 범위의 최대 A값 (0~255)
 * @param {Array<number>} toChangeColor - 치환할 색상 RGBA (ex: [r, g, b, a], 0~255)
 * @returns {HTMLCanvasElement} - 변경된 결과를 담고 있는 WebGL Canvas
 */
function change_color(
  canvas,
  x, y, width, height,
  minR, maxR,
  minG, maxG,
  minB, maxB,
  minA, maxA,
  toChangeColor
) {
  // 1. WebGL용 캔버스 생성
  const webglCanvas = document.createElement('canvas');
  webglCanvas.width = canvas.width;
  webglCanvas.height = canvas.height;

  const gl = webglCanvas.getContext('webgl', { premultipliedAlpha: false });
  if (!gl) {
    console.error('WebGL을 지원하지 않는 환경입니다.');
    return webglCanvas; // 실패 시, 그냥 빈 캔버스 반환
  }

  // 2. 셰이더 소스 (버텍스 / 프래그먼트)
  const vertexShaderSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
      // y축을 반전하여 출력
      gl_Position = vec4(a_position.x, -a_position.y, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `;
  const fragmentShaderSource = `
    precision mediump float;
    varying vec2 v_texCoord;

    uniform sampler2D u_image;

    // 색상 범위 (0~1 스케일)
    uniform vec4 u_rangeMin;  // (r,g,b,a)
    uniform vec4 u_rangeMax;  // (r,g,b,a)

    // 치환할 색상 (0~1 스케일)
    uniform vec4 u_replaceColor;

    // 영역 (rx, ry, rw, rh) in [0..1]
    uniform vec4 u_region;

    void main() {
      vec4 color = texture2D(u_image, v_texCoord);

      // 텍스처 좌표 (0~1) 범위 내에서 영역 검사
      bool inRegion = (
        v_texCoord.x >= u_region.x && v_texCoord.x < (u_region.x + u_region.z) &&
        v_texCoord.y >= u_region.y && v_texCoord.y < (u_region.y + u_region.w)
      );

      // RGBA 범위 검사
      bool inColorRange = (
        color.r >= u_rangeMin.r && color.r <= u_rangeMax.r &&
        color.g >= u_rangeMin.g && color.g <= u_rangeMax.g &&
        color.b >= u_rangeMin.b && color.b <= u_rangeMax.b &&
        color.a >= u_rangeMin.a && color.a <= u_rangeMax.a
      );

      if (inRegion && inColorRange) {
        gl_FragColor = u_replaceColor;
      } else {
        gl_FragColor = color;
      }
    }
  `;

  // 3. 셰이더 컴파일 & 프로그램 링크
  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('셰이더 컴파일 오류:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }
  function createProgram(gl, vsSrc, fsSrc) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program 링크 오류:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  if (!program) {
    console.error('WebGL 프로그램 생성 실패');
    return webglCanvas;
  }
  gl.useProgram(program);

  // 4. 풀스크린 사각형 정점 데이터 (정점 2개 삼각형 2개)
  //   (x,y, u,v)
  const vertexData = new Float32Array([
    //   X    Y     U     V
    -1, -1,  0.0,  0.0,
     1, -1,  1.0,  0.0,
    -1,  1,  0.0,  1.0,

    -1,  1,  0.0,  1.0,
     1, -1,  1.0,  0.0,
     1,  1,  1.0,  1.0
  ]);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

  const a_position = gl.getAttribLocation(program, 'a_position');
  const a_texCoord = gl.getAttribLocation(program, 'a_texCoord');
  gl.enableVertexAttribArray(a_position);
  gl.enableVertexAttribArray(a_texCoord);

  // stride = 4 floats(x,y,u,v) => 4*sizeof(float)
  gl.vertexAttribPointer(a_position,
    2, gl.FLOAT, false,
    4*Float32Array.BYTES_PER_ELEMENT, 0
  );
  gl.vertexAttribPointer(a_texCoord,
    2, gl.FLOAT, false,
    4*Float32Array.BYTES_PER_ELEMENT,
    2*Float32Array.BYTES_PER_ELEMENT
  );

  // 5. 텍스처 업로드
  //   - pixelStorei UNPACK_FLIP_Y_WEBGL을 false로 => JS에서 직접 y좌표 뒤집기 계산
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  gl.texImage2D(
    gl.TEXTURE_2D, 0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    canvas
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // 6. 유니폼 설정 함수
  function loc(name) {
    return gl.getUniformLocation(program, name);
  }

  // (a) 색 범위 (0~255)를 (0~1)로
  gl.uniform4f(
    loc('u_rangeMin'),
    minR/255, minG/255, minB/255, minA/255
  );
  gl.uniform4f(
    loc('u_rangeMax'),
    maxR/255, maxG/255, maxB/255, maxA/255
  );

  // (b) 치환 색상 [r,g,b,a] => 0~1
  gl.uniform4f(
    loc('u_replaceColor'),
    toChangeColor[0]/255,
    toChangeColor[1]/255,
    toChangeColor[2]/255,
    toChangeColor[3]/255
  );

  // (c) 영역 (x,y,width,height)를 texCoord(0..1)로 변환
  const texW = canvas.width;
  const texH = canvas.height;
  const rx = x / texW;
  const ry = y / texH;
  const rw = width / texW;
  const rh = height / texH;

  gl.uniform4f(loc('u_region'), rx, ry, rw, rh);

  // (d) 샘플러
  gl.uniform1i(loc('u_image'), 0);

  // 7. draw
  gl.viewport(0, 0, webglCanvas.width, webglCanvas.height);
  gl.clearColor(0,0,0,0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // 8. 최종 WebGL Canvas 반환
  return webglCanvas;
}