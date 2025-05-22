import { lowQueue } from "./pixelReadProcessor";

const CHUNK_BYTES = 8_000_00000; // 한 번에 읽을 최대 바이트 수

export class PixelReader {
  pixelData;
  gl: WebGL2RenderingContext;
  width: number;
  height: number;
  texture: WebGLTexture;
  static fbo: WebGLFramebuffer;
  static pbo: WebGLBuffer;
  workQueue: Function[] = [];
  format; // RGBA, RG
  type; // UNSIGNED_BYTE, HALF_FLOAT
  complete: boolean;

  constructor(gl, width, height, texture, format, type) {
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.texture = texture;

    this.format = format;
    this.type = type;
    this.complete = false;

    const info = getPixelFormatInfo(gl, this.format, this.type);
    const { components, bytesPerComponent, TypedArray } = info;

    this.pixelData = new TypedArray(width * height * components);

    if (!PixelReader.fbo) {
      PixelReader.fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, PixelReader.fbo);
    }
    if (!PixelReader.pbo) {
      PixelReader.pbo = gl.createBuffer();
      //gl.bindFramebuffer(gl.FRAMEBUFFER, PixelReader.fbo);
    }
    this.workQueue = [];
    this.enqueue();
  }

  private enqueue() {
    //console.log("enqueue");
    const gl = this.gl;
    const width = this.width;
    const height = this.height;
    const historyTex = this.texture;
    const fbo = PixelReader.fbo;
    const pbo = PixelReader.pbo;

    const info = getPixelFormatInfo(gl, this.format, this.type);
    const { components, bytesPerComponent, bytesPerPixel, TypedArray } = info;

    // 한 줄씩 읽어서 처리
    const rowsPerChunk = Math.floor(CHUNK_BYTES / (width * bytesPerPixel));
    // => 1바이트 RGBA(4 comp): chunkBytes/4픽셀
    //    2바이트 RG (2 comp): chunkBytes/4픽셀
    //    2바이트 RGBA (4 comp): chunkBytes/8픽셀

    for (let rowOffset = 0; rowOffset < height; rowOffset += rowsPerChunk) {
      let chunk = async () => {
        const remainingRows = height - rowOffset;
        const rowsToRead = Math.min(rowsPerChunk, remainingRows);

        const subArray = new TypedArray(
          this.pixelData.buffer,
          rowOffset * width * components * bytesPerComponent, // byteOffset
          rowsToRead * width * components // elementCount
        );

        // // 한 줄씩 읽기
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(
          gl.READ_FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          historyTex,
          0
        );
        gl.readPixels(
          0,
          rowOffset,
          width,
          rowsToRead,
          this.format, // gl.RGBA,
          this.type, //gl.UNSIGNED_BYTE,
          subArray
        );

        // // 1. PBO 할당 & 바인딩
        // gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
        // gl.bufferData(
        //   gl.PIXEL_PACK_BUFFER,
        //   rowsToRead * width * components,
        //   gl.STREAM_READ
        // );

        // // 2. FBO에 텍스처 부착
        // gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo);
        // gl.framebufferTexture2D(
        //   gl.READ_FRAMEBUFFER,
        //   gl.COLOR_ATTACHMENT0,
        //   gl.TEXTURE_2D,
        //   historyTex,
        //   0
        // );

        // // 3. GPU-Side readPixels → PBO (null = 현재 바인딩된 PBO)
        // gl.readPixels(0, 0, width, height, this.format, this.type, 0);

        // 4. GPU flush & fence
        //await waitForSync(gl);

        // 5. CPU-Side getBufferSubData → TypedArray
        //  gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this.pixelData);

        // 6. 정리
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        gl.deleteTexture(historyTex); // 요청대로 텍스처 즉시 파기

        console.log("read!");
      };

      //this.workQueue.push(chunk);
    }

    let finish = () => {
      gl.deleteTexture(historyTex); // 텍스처 삭제
      this.complete = true;
      console.log("finish");
    };

    this.workQueue.push(finish);
  }

  isEmpty() {
    return this.workQueue.length == 0;
  }

  front() {
    return this.workQueue[0];
  }

  pop() {
    this.workQueue.shift();
  }

  async getPixelData() {
    // 이때 큐에서 현재 실행되고있는게 다 실행 완료 되기까지 기다리기
    await new Promise<void>((resolve) => {
      lowQueue.stop(() => {
        // 큐에 있는 걸 하나 수행
        while (!this.complete) {
          let fn = lowQueue.front();
          fn();
          lowQueue.pop();
        }
        resolve();
      });
    });

    return this.pixelData;
  }

  getJobs() {
    return this.workQueue;
  }
}

// WebGL pixel format/type 헬퍼
function getPixelFormatInfo(
  gl: WebGL2RenderingContext,
  format: number,
  type: number
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
async function waitForSync(gl) {
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();

  while (true) {
    const status = gl.clientWaitSync(sync, 0, 0); // timeout 무조건 0
    // console.log("while:", status);
    if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) {
      break;
    }
    // GPU가 아직 안 끝났으면, CPU는 양보
    await new Promise((r) => setTimeout(r, 0));
  }
  gl.deleteSync(sync);
}
