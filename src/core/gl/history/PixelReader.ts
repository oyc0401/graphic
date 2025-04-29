const bytesPerPixel = 4;
const chunkPixels = 2000_000;

export class PixelReader {
  pixelData: Uint8Array;
  gl: WebGL2RenderingContext;
  width: number;
  height: number;
  texture;
  static fbo;
  workQueue: Function[] = [];

  constructor(gl, width, height, texture) {
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.texture = texture;
    this.pixelData = new Uint8Array(width * height * bytesPerPixel);
    if (!PixelReader.fbo) {
      PixelReader.fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, PixelReader.fbo);
    }
    this.workQueue = [];
    this.enqueue();
  }

  private enqueue() {
    const gl = this.gl;
    const width = this.width;
    const height = this.height;
    const historyTex = this.texture;
    const fbo = PixelReader.fbo;

    // 한 줄씩 읽어서 처리
    const rowsPerChunk = Math.floor(chunkPixels / width); // 한 번에 읽을 수 있는 줄 수 (9999 / 1000 = 9줄)

    for (let rowOffset = 0; rowOffset < height; rowOffset += rowsPerChunk) {
      let chunk = () => {
        const remainingRows = height - rowOffset;
        const rowsToRead = Math.min(rowsPerChunk, remainingRows);

        const subArray = new Uint8Array(
          this.pixelData.buffer,
          rowOffset * width * bytesPerPixel,
          rowsToRead * width * bytesPerPixel,
        );

        // 한 줄씩 읽기
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(
          gl.READ_FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          historyTex,
          0,
        );
        gl.readPixels(
          0,
          rowOffset,
          width,
          rowsToRead,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          subArray,
        );
        console.log("read!");
      };

      this.workQueue.push(chunk);
    }

    let finish = () => {
      gl.deleteTexture(historyTex); // 텍스처 삭제
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

  getPixelData() {
    while (!this.isEmpty()) {
      let fn = this.front();
      fn();
      this.pop();
    }
    return this.pixelData;
  }
}
