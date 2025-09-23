import { paintConfig } from "@/paint.config";
import { getHistoryManager, HistoryObject, Snapshot } from "../../../history/history";
import { PixelStore } from "../../../history/PixelStore";

import { getLayerManager } from "../layer";
import { getRenderingManager } from "../render/render";
import { getSourceTextureManager, paintOptions, TEXTURE_UNIT } from "../texture";
import { decodePremultAndFlip } from "../../../utils/flipPixel";
import { getVertexManager } from "../vertexShader";
import { Rect } from "@/core/utils/rect";
import * as twgl from "twgl.js";

import selectionFrag from "./selection.frag?raw";

export class SelectionManager {
  private static readonly MAX_TEXTURE_SIZE = 2048.0;

  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private layerManager: any;
  private sourceTextureManager: any;
  private renderingManager: any;

  private selectionPos = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    flipH: false,
    flipV: false,
  };

  private originalWidth: number;
  private originalHeight: number;
  private selectionTex: WebGLTexture;
  private renderedSelectionTex: WebGLTexture;
  private selectionProgramInfo: any;
  private selectionFBO: WebGLFramebuffer;
  private renderedSelectionFBO: WebGLFramebuffer;
  private beforePos: any;

  constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
    this.layerManager = getLayerManager(canvas, gl);
    this.sourceTextureManager = getSourceTextureManager(canvas, gl);
    this.renderingManager = getRenderingManager(canvas, gl);

    this.initializeTextures();
    this.initializeShaders();
    this.initializeFramebuffers();
  }

  private initializeTextures() {
    const gl = this.gl;

    // 텍스처 생성
    this.selectionTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_SELECTION);
    gl.bindTexture(gl.TEXTURE_2D, this.selectionTex);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.renderedSelectionTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.RENDERED_SELECTION);
    gl.bindTexture(gl.TEXTURE_2D, this.renderedSelectionTex);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private initializeShaders() {
    const gl = this.gl;
    const vertexManager = getVertexManager(gl);

    this.selectionProgramInfo = twgl.createProgramInfo(gl, [vertexManager.vsSource, selectionFrag]);

    gl.useProgram(this.selectionProgramInfo.program);
    gl.uniform1i(
      gl.getUniformLocation(this.selectionProgramInfo.program, "u_selection_source"),
      TEXTURE_UNIT.SOURCE_SELECTION,
    );
    gl.uniform1i(
      gl.getUniformLocation(this.selectionProgramInfo.program, "u_selection"),
      TEXTURE_UNIT.RENDERED_SELECTION,
    );
    gl.uniform1i(gl.getUniformLocation(this.selectionProgramInfo.program, "u_source"), TEXTURE_UNIT.SOURCE);
  }

  private initializeFramebuffers() {
    const gl = this.gl;

    this.selectionFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.selectionFBO);
    gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.selectionTex, 0);

    this.renderedSelectionFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.renderedSelectionFBO);
    gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.renderedSelectionTex, 0);
  }

  private openTexture() {
    const gl = this.gl;

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.RENDERED_SELECTION);
    gl.bindTexture(gl.TEXTURE_2D, this.renderedSelectionTex);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      paintConfig.maxSize,
      paintConfig.maxSize,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
  }

  private closeTexture() {
    const gl = this.gl;

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_SELECTION);
    gl.bindTexture(gl.TEXTURE_2D, this.selectionTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.RENDERED_SELECTION);
    gl.bindTexture(gl.TEXTURE_2D, this.renderedSelectionTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }

  private uploadRenderedTex(force = false) {
    const gl = this.gl;

    if (
      this.selectionPos.width <= SelectionManager.MAX_TEXTURE_SIZE &&
      this.selectionPos.height <= SelectionManager.MAX_TEXTURE_SIZE
    ) {
    } else if (force) {
    } else {
      return;
    }

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.selectionFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.renderedSelectionFBO);

    gl.blitFramebuffer(
      0,
      0,
      this.originalWidth,
      this.originalHeight,
      0,
      0,
      this.selectionPos.width,
      this.selectionPos.height,
      gl.COLOR_BUFFER_BIT,
      paintOptions.selectionAntialias ? gl.LINEAR : gl.NEAREST,
    );
  }

  private createCurrentSnapshot() {
    const gl = this.gl;
    const renderRect = Rect.fromWidth(0, 0, this.originalWidth, this.originalHeight);
    const self = this;

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.selectionFBO);
    const pixels = new Uint8Array(this.originalWidth * this.originalHeight * 4);

    const sizeInBytes = pixels.byteLength;
    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
    console.log(`[SelectionManager] Pixel data size: (${sizeInMB} MB) - ${this.originalWidth}x${this.originalHeight}`);

    gl.readPixels(0, 0, this.originalWidth, this.originalHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    let pixelReader = PixelStore.fromPixelData(pixels, this.originalWidth, this.originalHeight);

    const selectionPosRect = Rect.fromWidth(
      this.selectionPos.x,
      this.selectionPos.y,
      this.selectionPos.width,
      this.selectionPos.height,
    );

    selectionPosRect.flipH = this.selectionPos.flipH;
    selectionPosRect.flipV = this.selectionPos.flipV;

    let showSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: pixelReader,
      rect: renderRect,
      selectionRect: selectionPosRect,
      async apply() {
        self.openTexture();
        self.selectionPos.x = this.selectionRect.x;
        self.selectionPos.y = this.selectionRect.y;
        self.selectionPos.width = this.selectionRect.width;
        self.selectionPos.height = this.selectionRect.height;
        self.selectionPos.flipH = this.selectionRect.flipH;
        self.selectionPos.flipV = this.selectionRect.flipV;
        self.originalWidth = this.rect.width;
        self.originalHeight = this.rect.height;

        gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_SELECTION);
        gl.bindTexture(gl.TEXTURE_2D, self.selectionTex);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          self.originalWidth,
          self.originalHeight,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          this.pixelReader.getPixelData(),
        );

        paintOptions.showSelection = true;
      },
    };

    let hideSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      rect: renderRect,
      async apply() {
        paintOptions.showSelection = false;
        self.closeTexture();
      },
    };

    return {
      show: showSnapshot,
      hide: hideSnapshot,
    };
  }

  select(sx: number, sy: number, swidth: number, sheight: number) {
    const gl = this.gl;

    this.openTexture();
    paintOptions.showSelection = true;
    paintOptions.selectionAntialias = false;

    this.selectionPos.x = sx;
    this.selectionPos.y = sy;
    this.selectionPos.width = swidth;
    this.selectionPos.height = sheight;
    this.selectionPos.flipH = false;
    this.selectionPos.flipV = false;
    this.originalWidth = swidth;
    this.originalHeight = sheight;
    this.beforePos = structuredClone(this.selectionPos);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_SELECTION);
    gl.bindTexture(gl.TEXTURE_2D, this.selectionTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      this.originalWidth,
      this.originalHeight,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.layerManager.layerFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.selectionFBO);

    gl.blitFramebuffer(
      this.selectionPos.x,
      this.selectionPos.y,
      this.selectionPos.x + this.originalWidth,
      this.selectionPos.y + this.originalHeight,
      0,
      0,
      this.originalWidth,
      this.originalHeight,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.layerManager.layerFBO);

    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(sx, sy, swidth, sheight);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.disable(gl.SCISSOR_TEST);

    let { show: after, hide: before } = this.createCurrentSnapshot();

    let { before: beforeSource, after: afterSource } = this.sourceTextureManager.upload(sx, sy, swidth, sheight);

    const selectionBytes = this.originalWidth * this.originalHeight * 4;
    const sourceBytes = swidth * sheight * 4 * 2;
    const byteSize = selectionBytes + sourceBytes;

    const newHistory = new HistoryObject({
      undo: async () => {
        await before.apply();
        await beforeSource.apply();
        this.uploadRenderedTex();

        this.renderingManager.render();

        return {
          tool: "select",
          selection: {
            show: paintOptions.showSelection,
            x: this.selectionPos.x,
            y: this.selectionPos.y,
            width: this.selectionPos.width,
            height: this.selectionPos.height,
            flipH: this.selectionPos.flipH,
            flipV: this.selectionPos.flipV,
          },
        };
      },
      redo: async () => {
        await after.apply();
        await afterSource.apply();
        this.uploadRenderedTex();

        this.renderingManager.render();

        return {
          tool: "selection",
          selection: {
            show: paintOptions.showSelection,
            x: this.selectionPos.x,
            y: this.selectionPos.y,
            width: this.selectionPos.width,
            height: this.selectionPos.height,
            flipH: this.selectionPos.flipH,
            flipV: this.selectionPos.flipV,
          },
        };
      },
      byteSize,
    });

    let historyManager = getHistoryManager(this.canvas, gl);
    historyManager.addUndo(newHistory);

    this.uploadRenderedTex();
  }

  paste(newx: number, newy: number, newwidth: number, newheight: number, bitmap: ImageBitmap) {
    const gl = this.gl;

    this.openTexture();
    paintOptions.showSelection = true;
    paintOptions.selectionAntialias = true;

    this.selectionPos.x = newx;
    this.selectionPos.y = newy;
    this.selectionPos.width = newwidth;
    this.selectionPos.height = newheight;
    this.selectionPos.flipH = false;
    this.selectionPos.flipV = false;
    this.originalWidth = newwidth;
    this.originalHeight = newheight;
    this.beforePos = structuredClone(this.selectionPos);

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_SELECTION);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);

    this.uploadRenderedTex();

    let { hide: before, show: after } = this.createCurrentSnapshot();

    const byteSize = this.originalWidth * this.originalHeight * 4;

    const newHistory = new HistoryObject({
      undo: async () => {
        await before.apply();
        this.uploadRenderedTex();

        this.renderingManager.render();

        return {
          tool: "select",
          selection: {
            show: paintOptions.showSelection,
            x: this.selectionPos.x,
            y: this.selectionPos.y,
            width: this.selectionPos.width,
            height: this.selectionPos.height,
            flipH: this.selectionPos.flipH,
            flipV: this.selectionPos.flipV,
          },
        };
      },
      redo: async () => {
        await after.apply();
        this.uploadRenderedTex();

        this.renderingManager.render();

        return {
          tool: "selection",
          selection: {
            show: paintOptions.showSelection,
            x: this.selectionPos.x,
            y: this.selectionPos.y,
            width: this.selectionPos.width,
            height: this.selectionPos.height,
            flipH: this.selectionPos.flipH,
            flipV: this.selectionPos.flipV,
          },
        };
      },
      byteSize,
    });

    let historyManager = getHistoryManager(this.canvas, gl);
    historyManager.addUndo(newHistory);

    this.renderingManager.render();
  }

  applySelection() {
    const gl = this.gl;
    const vertexManager = getVertexManager(gl);

    paintOptions.showSelection = false;

    gl.useProgram(this.selectionProgramInfo.program);
    twgl.setUniforms(this.selectionProgramInfo, {
      u_resolution: [paintOptions.width, paintOptions.height],
      u_selectionPos: [this.selectionPos.x, this.selectionPos.y],
      u_selectionSize: [this.selectionPos.width, this.selectionPos.height],
      u_max_size: paintConfig.maxSize,
      u_flipH: this.selectionPos.flipH ? 1.0 : 0.0,
      u_flipV: this.selectionPos.flipV ? 1.0 : 0.0,
    });

    twgl.setBuffersAndAttributes(gl, this.selectionProgramInfo, vertexManager.quadBufferInfo);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.layerManager.layerFBO);
    gl.viewport(0, 0, paintOptions.width, paintOptions.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    let { show: before, hide: after } = this.createCurrentSnapshot();

    let dirty = Rect.fromWidth(
      this.selectionPos.x,
      this.selectionPos.y,
      this.selectionPos.width,
      this.selectionPos.height,
    ).clampTo(0, 0, paintOptions.width, paintOptions.height);

    let { before: beforeSource, after: afterSource } = this.sourceTextureManager.upload(
      dirty.x,
      dirty.y,
      dirty.width,
      dirty.height,
    );

    const selectionBytes = this.originalWidth * this.originalHeight * 4;
    const sourceBytes = dirty.width * dirty.height * 4 * 2;
    const byteSize = selectionBytes + sourceBytes;

    const newHistory = new HistoryObject({
      undo: async () => {
        await before.apply();
        await beforeSource.apply();
        this.uploadRenderedTex();

        this.renderingManager.render();

        return {
          tool: "selection",
          selection: {
            show: paintOptions.showSelection,
            x: this.selectionPos.x,
            y: this.selectionPos.y,
            width: this.selectionPos.width,
            height: this.selectionPos.height,
            flipH: this.selectionPos.flipH,
            flipV: this.selectionPos.flipV,
          },
        };
      },
      redo: async () => {
        await after.apply();
        await afterSource.apply();
        this.uploadRenderedTex();

        this.renderingManager.render();

        return {
          tool: "brush",
          selection: {
            show: paintOptions.showSelection,
            x: this.selectionPos.x,
            y: this.selectionPos.y,
            width: this.selectionPos.width,
            height: this.selectionPos.height,
            flipH: this.selectionPos.flipH,
            flipV: this.selectionPos.flipV,
          },
        };
      },
      byteSize,
    });

    let historyManager = getHistoryManager(this.canvas, gl);
    historyManager.addUndo(newHistory);

    this.closeTexture();

    this.renderingManager.render();
  }

  getPixelData() {
    const gl = this.gl;

    const flippedPixel = new Uint8Array(this.selectionPos.width * this.selectionPos.height * 4);

    console.log("getPixelData", this.selectionPos.width, this.selectionPos.height);
    if (
      this.selectionPos.width > SelectionManager.MAX_TEXTURE_SIZE ||
      this.selectionPos.height > SelectionManager.MAX_TEXTURE_SIZE
    ) {
      this.uploadRenderedTex(true);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.renderedSelectionFBO);
    gl.readPixels(0, 0, this.selectionPos.width, this.selectionPos.height, gl.RGBA, gl.UNSIGNED_BYTE, flippedPixel);

    const pixels = decodePremultAndFlip(flippedPixel, this.selectionPos.width, this.selectionPos.height);

    return {
      pixels,
      width: this.selectionPos.width,
      height: this.selectionPos.height,
    };
  }

  afterCut() {
    paintOptions.showSelection = false;
    this.renderingManager.render();
  }

  moveSelection(newX: number, newY: number, newWidth: number, newHeight: number, flipH = false, flipV = false) {
    this.selectionPos.x = newX;
    this.selectionPos.y = newY;

    const sizeChanged = this.selectionPos.width != newWidth || this.selectionPos.height != newHeight;

    if (sizeChanged) {
      console.log("selection change:", newWidth, newHeight);

      this.selectionPos.width = newWidth;
      this.selectionPos.height = newHeight;
      this.selectionPos.flipH = flipH;
      this.selectionPos.flipV = flipV;

      this.uploadRenderedTex();
    }

    this.renderingManager.render();
  }

  endSelection() {
    let historyManager = getHistoryManager(this.canvas, this.gl);
    let beforePosition = structuredClone(this.beforePos);
    let afterPosition = structuredClone(this.selectionPos);

    const byteSize = 0;

    const newHistory = new HistoryObject({
      undo: async () => {
        this.moveSelection(
          beforePosition.x,
          beforePosition.y,
          beforePosition.width,
          beforePosition.height,
          beforePosition.flipH,
          beforePosition.flipV,
        );

        this.beforePos = structuredClone(this.selectionPos);

        return {
          tool: "selection",
          selection: {
            show: paintOptions.showSelection,
            x: this.selectionPos.x,
            y: this.selectionPos.y,
            width: this.selectionPos.width,
            height: this.selectionPos.height,
            flipH: this.selectionPos.flipH,
            flipV: this.selectionPos.flipV,
          },
        };
      },
      redo: async () => {
        this.moveSelection(
          afterPosition.x,
          afterPosition.y,
          afterPosition.width,
          afterPosition.height,
          afterPosition.flipH,
          afterPosition.flipV,
        );

        this.beforePos = structuredClone(this.selectionPos);

        return {
          tool: "selection",
          selection: {
            show: paintOptions.showSelection,
            x: this.selectionPos.x,
            y: this.selectionPos.y,
            width: this.selectionPos.width,
            height: this.selectionPos.height,
            flipH: this.selectionPos.flipH,
            flipV: this.selectionPos.flipV,
          },
        };
      },
      byteSize,
    });

    this.beforePos = structuredClone(this.selectionPos);

    historyManager.addUndo(newHistory);
  }

  getPosition() {
    return {
      x: this.selectionPos.x,
      y: this.selectionPos.y,
      width: this.selectionPos.width,
      height: this.selectionPos.height,
      flipH: this.selectionPos.flipH,
      flipV: this.selectionPos.flipV,
    };
  }

  dispose() {
    const gl = this.gl;
    if (this.selectionTex) {
      gl.deleteTexture(this.selectionTex);
    }
    if (this.renderedSelectionTex) {
      gl.deleteTexture(this.renderedSelectionTex);
    }
    if (this.selectionFBO) {
      gl.deleteFramebuffer(this.selectionFBO);
    }
    if (this.renderedSelectionFBO) {
      gl.deleteFramebuffer(this.renderedSelectionFBO);
    }
    if (this.selectionProgramInfo?.program) {
      gl.deleteProgram(this.selectionProgramInfo.program);
    }
  }
}
