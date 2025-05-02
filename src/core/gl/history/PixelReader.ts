const chunkPixels = 2000_000;

export class PixelReader {
  pixelData;
  gl: WebGL2RenderingContext;
  width: number;
  height: number;
  texture: WebGLTexture;
  static fbo: WebGLFramebuffer;
  workQueue: Function[] = [];
  format; // RGBA, RG
  type; // UNSIGNED_BYTE, HALF_FLOAT

  constructor(gl, width, height, texture, format, type) {
    let bytesPerPixel = 4;
    if (format == gl.RG) {
      bytesPerPixel = 2;
    }

    if (type == gl.HALF_FLOAT) {
      this.pixelData = new Uint16Array(width * height * bytesPerPixel);
    } else {
      this.pixelData = new Uint8Array(width * height * bytesPerPixel);
    }

    this.gl = gl;
    this.width = width;
    this.height = height;
    this.texture = texture;

    this.format = format;
    this.type = type;

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

    let bytesPerPixel = 4;
    if (this.format == gl.RG) {
      bytesPerPixel = 2;
    }

    let pixelConstructor: any = Uint8Array;
    if (this.type == gl.HALF_FLOAT) {
      pixelConstructor = Uint16Array;
    }

    // 한 줄씩 읽어서 처리
    const rowsPerChunk = Math.floor(chunkPixels / width); // 한 번에 읽을 수 있는 줄 수 (9999 / 1000 = 9줄)

    for (let rowOffset = 0; rowOffset < height; rowOffset += rowsPerChunk) {
      let chunk = () => {
        const remainingRows = height - rowOffset;
        const rowsToRead = Math.min(rowsPerChunk, remainingRows);

        let subArray = new pixelConstructor(
          this.pixelData.buffer,
          rowOffset * width * bytesPerPixel,
          rowsToRead * width * bytesPerPixel
        );

        // 한 줄씩 읽기
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
