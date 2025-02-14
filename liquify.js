export class Liquify {
  constructor(canvas, gl) {
    // 이제 2d 컨텍스트 대신 WebGL2 컨텍스트를 사용합니다.
    this.canvas = canvas;
    this.gl = gl;
    if (!this.gl) {
      console.error("WebGL2 is not supported!");
      return;
    }
    this.width = canvas.width;
    this.height = canvas.height;

    // liquify 효과에 사용할 매개변수의 기본값 설정
    this.radius = 500;
    this.strength = 1.0;

    // 초기화 이후에는 모든 데이터는 GPU에 남아 있으므로,
    // CPU↔GPU 데이터 이동은 init 단계 이후 발생하지 않습니다.
    this.init();
  }

  async init() {
    const gl = this.gl;

    // ─────────────────────────────────────────────
    // (1) 텍스처 업로드 시 Y축 뒤집기 설정!
    // ─────────────────────────────────────────────
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    // 1. 원본 이미지 텍스처 생성
    //    (이미지는 캔버스에 그려져 있다고 가정하므로, 캔버스 내용을 텍스처로 업로드)
    this.originalTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.originalTexture);
    // texImage2D의 소스로 canvas 자체를 사용합니다.
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.canvas,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // 2. 변위 맵(displacement map) 텍스처 생성
    //    RG 채널에 (dx, dy) 변위를 저장하며, 초기값은 모두 0
    this.dispTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.dispTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG32F,
      this.width,
      this.height,
      0,
      gl.RG,
      gl.FLOAT,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // 3. precomputed 데이터(적분값) 텍스처 생성
    //    기존 easeInOutCubicIntegral()와 easeInOutCubicIntegralReal()의 데이터를
    //    1D 텍스처에 업로드합니다. (데이터는 loadPrecomputedData* 함수를 통해 로드)
    this.precomputedTexture = await this._loadPrecomputedTexture("/data.bin");
    this.precomputed2Texture =
      await this._loadPrecomputedTexture("/integralEase.bin");

    // 4. 프레임버퍼 생성
    //    liquify 효과 업데이트 시, 변위 맵 텍스처를 렌더 타깃으로 사용합니다.
    this.dispFBO = gl.createFramebuffer();

    // 5. 셰이더 프로그램 컴파일
    //    (1) liquify 효과(변위 업데이트) 셰이더: applyPixelFlowShader
    //    (2) 최종 렌더 셰이더: renderLiquifyShader
    this.applyProgram = this._createApplyProgram();
    this.renderProgram = this._createRenderProgram();

    // 6. 정점 데이터 및 VAO 설정 (풀스크린 쿼드)
    this.quadVAO = gl.createVertexArray();
    gl.bindVertexArray(this.quadVAO);
    const quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    // 정점 좌표 (풀스크린을 덮는 두 개의 삼각형)
    const quadVertices = new Float32Array([
      -1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(this.applyProgram, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // 모든 초기화가 끝났으므로, 이후에는 CPU→GPU 데이터 전송 없이 GPU만으로 작업합니다.
  }

  // setRadius와 setStrength는 liquify 효과의 매개변수를 조정합니다.
  setRadius(radius) {
    this.radius = radius;
  }
  setStrength(strength) {
    this.strength = strength;
  }

  // liquify 효과 적용: GPU에서 변위 맵 업데이트
  apply(start, end) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.dispFBO);
    // 변위 맵 텍스처를 프레임버퍼의 컬러 어태치먼트로 바인딩
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.dispTexture,
      0,
    );
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.applyProgram);

    // === 필요한 유니폼 설정 ===
    gl.uniform2f(
      gl.getUniformLocation(this.applyProgram, "u_resolution"),
      this.width,
      this.height,
    );
    // WebGL 좌표계와 2D canvas 좌표계가 상하 반전일 수 있으니, 필요하면 y 좌표를 뒤집어 준다
    // gl.uniform2f(locationOfStart, start.x, (this.height - start.y));
    // gl.uniform2f(locationOfEnd, end.x, (this.height - end.y));
    // (상황에 따라 or 그냥 start.y,end.y 그대로도 되는 경우가 있음)

    // 만약 Canvas 높이가 this.height일 때,
    // 아래쪽이 0, 위쪽이 height라고 간주하려면:
    gl.uniform2f(
      gl.getUniformLocation(this.applyProgram, "u_start"),
      start.x,
      this.height - start.y, // ★ y 뒤집기
    );
    gl.uniform2f(
      gl.getUniformLocation(this.applyProgram, "u_end"),
      end.x,
      this.height - end.y, // ★ y 뒤집기
    );

    gl.uniform1f(
      gl.getUniformLocation(this.applyProgram, "u_radius"),
      this.radius,
    );
    gl.uniform1f(
      gl.getUniformLocation(this.applyProgram, "u_strength"),
      this.strength,
    );
    // 변위 맵와 precomputed 텍스처들을 텍스처 유닛에 바인딩
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.dispTexture);
    gl.uniform1i(gl.getUniformLocation(this.applyProgram, "u_displacement"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.precomputedTexture);
    gl.uniform1i(gl.getUniformLocation(this.applyProgram, "u_precomputed"), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.precomputed2Texture);
    gl.uniform1i(gl.getUniformLocation(this.applyProgram, "u_precomputed2"), 2);

    // 풀스크린 쿼드 그리기 → 변위 맵이 셰이더 로직에 따라 업데이트됨
    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // 최종 렌더링: 원본 이미지 텍스처와 업데이트된 변위 맵을 사용해 liquify 효과를 적용한 결과를 화면에 출력
  render() {
    const gl = this.gl;
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.renderProgram);

    gl.uniform2f(
      gl.getUniformLocation(this.renderProgram, "u_resolution"),
      this.width,
      this.height,
    );

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.originalTexture);
    gl.uniform1i(gl.getUniformLocation(this.renderProgram, "u_original"), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.dispTexture);
    gl.uniform1i(
      gl.getUniformLocation(this.renderProgram, "u_displacement"),
      1,
    );

    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // ──────────────────────────────────────────────
  // 내부 헬퍼 함수들
  // ──────────────────────────────────────────────

  // precomputed 데이터(bin 파일)를 읽어 1D 텍스처로 생성합니다.
  async _loadPrecomputedTexture(url) {
    const gl = this.gl;
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const numValues = arrayBuffer.byteLength / 4;
    const data = new Float32Array(arrayBuffer);
    // 1D 텍스처는 2D 텍스처로 생성(높이를1로 설정)
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R32F,
      numValues,
      1,
      0,
      gl.RED,
      gl.FLOAT,
      data,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return texture;
  }

  // liquify 효과(변위 업데이트) 셰이더 프로그램 생성
  _createApplyProgram() {
    const gl = this.gl;
    // 정점 셰이더는 풀스크린 쿼드용으로 단순합니다.
    const vsSource = `#version 300 es
    in vec2 a_position;
    out vec2 v_texCoord;
    void main(){
      v_texCoord = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }`;
    // 프래그먼트 셰이더에서는 기존 applyPixelFlow와 getPower의 로직을 GLSL로 재현합니다.
    // 좌표의 역순 보정, 선분 방향, easeInOutCubicIntegral() 함수(및 Real 버전)는
    // precomputed 텍스처를 통해 샘플링합니다.
    const fsSource = `#version 300 es
    precision highp float;
    in vec2 v_texCoord;
    out vec2 outDisplacement;

    uniform sampler2D u_displacement;
    uniform sampler2D u_precomputed;
    uniform sampler2D u_precomputed2;
    uniform vec2 u_resolution;
    uniform vec2 u_start;
    uniform vec2 u_end;
    uniform float u_radius;
    uniform float u_strength;

    // 샘플링을 통한 ease 함수 구현 (정확한 결과를 위해 precomputed 텍스처 사용)
    float easeInOutCubicIntegral(float x) {
      // x를 [0,1]로 가정하고, 1D 텍스처에서 선형 보간
      return texture(u_precomputed, vec2(x, 0.5)).r;
    }
    float easeInOutCubicIntegralReal(float x) {
      return texture(u_precomputed2, vec2(x, 0.5)).r;
    }

    // getPower()와 유사한 로직: liquify 그리드 내에서 현재 픽셀의 영향력을 계산합니다.
    float getPower(vec2 localCoord, vec2 d, float len, float radius) {
      float rCeil = ceil(radius);
      // 계산용 bounding box 크기
      float gridWidth = abs(d.x) + 1.0 + 2.0 * rCeil;
      float gridHeight = abs(d.y) + 1.0 + 2.0 * rCeil;
      // local start (bounding box 내에서 선분 시작점의 위치)
      float localStartX = (d.x > 0.0) ? rCeil : gridWidth - 1.0 - rCeil;
      float localStartY = (d.y > 0.0) ? rCeil : gridHeight - 1.0 - rCeil;
      vec2 localStart = vec2(localStartX, localStartY);

      vec2 v = localCoord - localStart;
      vec2 unit = d / len;
      float t = dot(v, unit);

      vec2 proj = t * unit;
      float dist = length(v - proj);

      float percent = 1.0;
      float power = 0.0;
      if(t > 0.0 && t < len) {
        float value = min(1.0, dist / radius);
        float addValue = easeInOutCubicIntegral(value);
        power = addValue * radius * 2.0 * percent;
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

    void main(){
      // 현재 픽셀 좌표 (화면 공간)
      vec2 pixel = v_texCoord * u_resolution;
      float ceiledRadius = ceil(u_radius);
      // affected 영역 계산: start와 end의 최소/최대값에서 반경을 확장
      vec2 minCoord = min(u_start, u_end) - vec2(ceiledRadius);
      vec2 maxCoord = max(u_start, u_end) + vec2(ceiledRadius);

      // 영향 영역 밖은 기존 변위값 유지
      if(pixel.x < minCoord.x || pixel.x > maxCoord.x ||
         pixel.y < minCoord.y || pixel.y > maxCoord.y) {
        outDisplacement = texture(u_displacement, v_texCoord).xy;
        return;
      }

      // liquify 그리드 계산 (CPU 코드와 동일한 방식)
      vec2 gridSize = abs(u_end - u_start) + vec2(1.0) + vec2(2.0 * ceiledRadius);
      vec2 startXY = min(u_start, u_end) - vec2(ceiledRadius);

      vec2 d = u_end - u_start;
      float len = length(d);
      vec2 unit = d / len;

      // 좌표 역순 보정: unit값에 따라 grid 좌표를 뒤집음
      float gridX = (unit.x > 0.0) ? gridSize.x - 1.0 - (pixel.x - startXY.x)
                                   : pixel.x - startXY.x;
      float gridY = (unit.y > 0.0) ? gridSize.y - 1.0 - (pixel.y - startXY.y)
                                   : pixel.y - startXY.y;
      vec2 localCoord = vec2(gridX, gridY);

      float movementPower = getPower(localCoord, d, len, u_radius);
      float diff = (movementPower * u_strength) / 2.0;

      // 기존 변위 텍스처에서 보간 (fastGetVector와 유사한 효과)
      vec2 displacedCoord = pixel - diff * unit;
      vec2 dispSample = texture(u_displacement, displacedCoord / u_resolution).xy;
      vec2 newDisp = dispSample - diff * unit;
      //outDisplacement = newDisp;
      outDisplacement = vec2(1.0,1.0);
    }`;
    return this._createProgram(vsSource, fsSource);
  }

  // 최종 렌더 셰이더 프로그램 생성
  _createRenderProgram() {
    const gl = this.gl;
    const vsSource = `#version 300 es
    in vec2 a_position;
    out vec2 v_texCoord;
    void main(){
      v_texCoord = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }`;
    const fsSource = `#version 300 es
    precision highp float;
    in vec2 v_texCoord;
    uniform sampler2D u_original;
    uniform sampler2D u_displacement;
    uniform vec2 u_resolution;
    out vec4 outColor;
    void main(){
      vec2 pixel = v_texCoord * u_resolution;
      vec2 disp = texture(u_displacement, v_texCoord).xy;
      // 디버그용 검사로직. 현재 다 초록으로 나옴
      if(disp[0]==0.0){
      outColor = vec4(0.0,0.5,0.0,1);
      return;
      }
      vec2 newCoord = pixel + disp;
      newCoord = clamp(newCoord, vec2(0.0), u_resolution - vec2(1.0));
      vec2 finalTexCoord = newCoord / u_resolution;
      outColor = texture(u_original, finalTexCoord);
    }`;
    return this._createProgram(vsSource, fsSource);
  }

  // 셰이더 프로그램 생성 헬퍼
  _createProgram(vsSource, fsSource) {
    const gl = this.gl;
    const vertexShader = this._createShader(gl.VERTEX_SHADER, vsSource);
    const fragmentShader = this._createShader(gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program failed to link:", gl.getProgramInfoLog(program));
    }
    return program;
  }

  _createShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("Shader compile error:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
    }
    return shader;
  }
}
