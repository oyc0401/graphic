/* ---------- 상수 ---------- */
const TILE_SIZE = 512 * 2; // 한 타일의 폭·높이(px)
const PACK_ALIGNMENT = 1; // 행 정렬을 1바이트로 맞춰 안전 확보

/* ---------- PixelReader ---------- */
export class PixelReader {
  pixelData: Uint8Array | Uint16Array | Float32Array;
  private static fbo: WebGLFramebuffer;
  private workQueue: (() => void)[] = [];

  constructor(
    private gl: WebGL2RenderingContext,
    private width: number,
    private height: number,
    private texture: WebGLTexture,
    private format: number, // gl.RGBA 등
    private type: number, // gl.UNSIGNED_BYTE 등
  ) {
    /* 1) 대상 버퍼 준비 ---------------------------------------------------- */
    const { components, TypedArray } = getPixelFormatInfo(gl, format, type);
    this.pixelData = new TypedArray(width * height * components);

    /* 2) FBO(재사용) 준비 -------------------------------------------------- */
    if (!PixelReader.fbo) {
      PixelReader.fbo = gl.createFramebuffer()!;
    }

    /* 3) 타일 단위 작업 생성 ---------------------------------------------- */
    this.enqueueTiles();
  }

  /* 타일별 readPixels 작업을 큐에 적재 */
  private enqueueTiles() {
    const { gl, width, height, texture, format, type } = this;
    const fbo = PixelReader.fbo;

    /* 가로·세로 타일 개수(끝 타일은 자투리) */
    const tilesX = Math.ceil(width / TILE_SIZE);
    const tilesY = Math.ceil(height / TILE_SIZE);

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        /* 타일 위치·크기 계산 --------------------------------------------- */
        const tileX = tx * TILE_SIZE;
        const tileY = ty * TILE_SIZE;
        const tileW = Math.min(TILE_SIZE, width - tileX);
        const tileH = Math.min(TILE_SIZE, height - tileY);

        /* 실제 readPixels 호출 람다 -------------------------------------- */
        this.workQueue.push(() => {
          const start = performance.now();

          /* FBO 바인딩 후 대상 텍스처 연결 */
          gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo);
          gl.framebufferTexture2D(
            gl.READ_FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            texture,
            0,
          );

          /* --- PACK 스토어 설정 (타일 → 전체 버퍼 정확 위치) ------------- */
          gl.pixelStorei(gl.PACK_ALIGNMENT, PACK_ALIGNMENT); // 1바이트 정렬
          gl.pixelStorei(gl.PACK_ROW_LENGTH, width); // 한 행 전체 픽셀 수
          gl.pixelStorei(gl.PACK_SKIP_ROWS, tileY); // 행 오프셋
          gl.pixelStorei(gl.PACK_SKIP_PIXELS, tileX); // 열 오프셋

          /* 타일 읽기 – 결과는 pixelData의 정확 위치로 직행 -------------- */
          gl.readPixels(
            tileX,
            tileY,
            tileW,
            tileH,
            format,
            type,
            this.pixelData,
          );

          /* 상태 복원 (다른 코드에 영향 방지) ----------------------------- */
          gl.pixelStorei(gl.PACK_ROW_LENGTH, 0);
          gl.pixelStorei(gl.PACK_SKIP_ROWS, 0);
          gl.pixelStorei(gl.PACK_SKIP_PIXELS, 0);

          const end = performance.now();
          //console.log(`read tile (${tx},${ty}) size ${tileW}×${tileH}`);
          //console.log("read!", end - start);
        });
      }
    }

    /* 마지막에 정리 작업 */
    this.workQueue.push(() => {
      gl.deleteTexture(texture);
    });
  }

  /* ---------- 퍼블릭 API ---------- */
  isEmpty() {
    return this.workQueue.length === 0;
  }
  front() {
    return this.workQueue[0];
  }
  pop() {
    this.workQueue.shift();
  }

  /** 큐의 모든 readPixels를 순차 실행 후 픽셀 버퍼 반환 */
  getPixelData() {
    while (!this.isEmpty()) {
      const job = this.front();
      job();
      this.pop();
    }
    return this.pixelData;
  }
}

// WebGL pixel format/type 헬퍼
function getPixelFormatInfo(
  gl: WebGL2RenderingContext,
  format: number,
  type: number,
) {
  let components = 4; // default: RGBA
  switch (format) {
    case gl.RED:
      components = 1;
      break;
    case gl.RG:
      components = 2;
      break;
    case gl.RGB:
      components = 3;
      break;
    case gl.RGBA:
      components = 4;
      break;
    default:
      console.warn("Unknown format, defaulting components to 4 (RGBA)");
  }

  let bytesPerComponent = 1;
  let TypedArray: typeof Uint8Array | typeof Uint16Array | typeof Float32Array =
    Uint8Array;

  switch (type) {
    case gl.UNSIGNED_BYTE:
      bytesPerComponent = 1;
      TypedArray = Uint8Array;
      break;
    case gl.HALF_FLOAT:
      bytesPerComponent = 2;
      TypedArray = Uint16Array;
      break;
    case gl.FLOAT:
      bytesPerComponent = 4;
      TypedArray = Float32Array;
      break;
    default:
      console.warn("Unknown type, defaulting to UNSIGNED_BYTE");
  }

  const bytesPerPixel = components * bytesPerComponent;

  return {
    components,
    bytesPerComponent,
    bytesPerPixel,
    TypedArray,
  };
}
