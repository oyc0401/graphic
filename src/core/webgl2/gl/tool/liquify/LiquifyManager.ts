import {
  TEXTURE_UNIT,
  getSourceTextureManager,
  paintOptions,
} from "../../texture";
import { getLayerManager } from "../../layer";
import { getBufferManager, getFullQuadShader } from "../../vertexShader";

import { createShader, createProgram } from "../../utils/glHelper";
import { getRenderingManager } from "../../render/render";
import {
  getHistoryManager,
  HistoryObject,
  Snapshot,
} from "../../history/history";

import { PixelReader } from "../../history/PixelReader";
import { DirtyRectRecorder, Rect } from "@/core/utils/rect";

import colorFrag from "./color.frag?raw";
import { DisplacementModifier } from "./DisplacementModifier";

interface LiquifyManagerInterface {
  enter(): void;
  start: (pointer: any) => void;
  push: (start: any, end: any) => void;
  render: () => void;
  end(): void;
  cancel(): void;
  exit(): void;
  setSize: () => void;
}

export class LiquifyManager implements LiquifyManagerInterface {
  protected gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private sourceTextureManager: any;
  private displacementTex: WebGLTexture;
  private displaceFBO: WebGLFramebuffer;
  private displacementModifier: DisplacementModifier;
  private renderProgram: WebGLProgram;
  private bufferManager: any;
  private layerManager: any;
  private renderingManager: any;
  private sourceDisplacementTex: WebGLTexture;
  private sourceDisplacementFBO: WebGLFramebuffer;
  private fbo: WebGLFramebuffer;

  // State variables
  // enter ~ exit동안 변경된 범위
  private changeDirtyRecorder: DirtyRectRecorder;
  private changedRect: Rect | null = null;

  private scissorRect: Rect;

  private constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
  }

  static async create(
    canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
  ): Promise<LiquifyManager> {
    const manager = new LiquifyManager(canvas, gl);
    await manager.initializeShaderResources();
    return manager;
  }

  private async initializeShaderResources() {
    const gl = this.gl;

    // 원본 이미지 텍스처 생성
    this.sourceTextureManager = getSourceTextureManager(this.canvas, gl);

    // Create displacement input texture and framebuffer
    this.displacementTex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, this.displacementTex);

    // 행렬에 linear를 사용하는 이유는 기존의 getVector는 보간으로 값을 가져오기 때문에
    // 여기서도 텍스처에 접근할 때 보간을 사용해서 가져와야한다.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // 프레임버퍼 생성 및 바인딩
    this.displaceFBO = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.displaceFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.displacementTex,
      0,
    );

    // Create displacement modifier
    this.displacementModifier = await DisplacementModifier.create(
      gl,
      this.displacementTex,
      this.displaceFBO,
    );

    const fullQuadVertexShader = getFullQuadShader(gl);
    this.bufferManager = getBufferManager(gl);

    let renderShader = createShader(gl, gl.FRAGMENT_SHADER, colorFrag);
    this.renderProgram = createProgram(gl, fullQuadVertexShader, renderShader);
    gl.useProgram(this.renderProgram);

    gl.uniform1i(
      gl.getUniformLocation(this.renderProgram, "u_displacement"),
      TEXTURE_UNIT.DISPLACEMENT,
    );

    gl.uniform1i(
      gl.getUniformLocation(this.renderProgram, "u_source"),
      TEXTURE_UNIT.SOURCE,
    ); // 텍스처 유닛 1에 할당

    this.bufferManager.createFullQuadVAO(this.renderProgram);

    this.layerManager = getLayerManager(this.canvas, gl);
    this.renderingManager = getRenderingManager(this.canvas, gl);

    this.sourceDisplacementTex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceDisplacementTex);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.sourceDisplacementFBO = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sourceDisplacementFBO);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.sourceDisplacementTex,
      0,
    );

    this.fbo = gl.createFramebuffer()!;
  }
  /**
   * sourceDisplaceTex를 기반으로 더미 텍스쳐를 만들어 리턴한다.
   */
  private createCopyTextureFromSourceDisTex(rect: Rect): WebGLTexture {
    const gl = this.gl;
    const historyTex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.TEMP);
    gl.bindTexture(gl.TEXTURE_2D, historyTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG16F,
      rect.width,
      rect.height,
      0,
      gl.RG,
      gl.HALF_FLOAT,
      null,
    );

    // 4. blitFramebuffer를 사용하여 면을 텍스처로 복사
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.sourceDisplacementFBO);

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(
      gl.DRAW_FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      historyTex,
      0,
    );

    // blit 좌표계는 0,0,1,1이 1칸임.
    gl.blitFramebuffer(
      rect.x,
      rect.y,
      rect.right,
      rect.bottom,
      0,
      0,
      rect.width,
      rect.height, // 쓰기 버퍼의 영역 (텍스처 크기)
      gl.COLOR_BUFFER_BIT, // 복사할 버퍼
      gl.NEAREST, // 필터링 옵션
    );

    return historyTex;
  }

  /**
   * displacementTex와 sourceDisplaceTex에 해당 픽셀을 적용시킨다.
   */
  private async applyHistory(pixelReader: PixelReader, rect: Rect) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, this.displacementTex);

    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      gl.RG,
      gl.HALF_FLOAT,
      await pixelReader.getPixelData(),
    );

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.displaceFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.sourceDisplacementFBO);

    gl.blitFramebuffer(
      rect.x,
      rect.y,
      rect.ex + 1,
      rect.ey + 1,
      rect.x,
      rect.y,
      rect.ex + 1,
      rect.ey + 1,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );
  }

  /**
   * displacementTex를 sourceDisplaceTex에 복사, changedRect 복사 하면서 해당 구역의 전 후 히스토리 스냅샷을 제작한다.
   */
  private uploadAndMakeHistory(
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    const gl = this.gl;
    let renderRect = Rect.fromWidth(x, y, width, height);

    let beforeSnapshot: Snapshot = this.createCurrentSnapshot(
      x,
      y,
      width,
      height,
    );

    // sourceMap으로 업로드
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.displaceFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.sourceDisplacementFBO);
    gl.blitFramebuffer(
      renderRect.x,
      renderRect.y,
      renderRect.ex + 1,
      renderRect.ey + 1,
      renderRect.x,
      renderRect.y,
      renderRect.ex + 1,
      renderRect.ey + 1,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );

    // changedRect 업로드
    this.changedRect = this.changeDirtyRecorder.generateRect();

    return {
      before: beforeSnapshot,
      // after: afterSnapshot,
    };
  }

  /**
   * 현재상태 스냅샷을 만든다.
   */
  private createCurrentSnapshot(
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    const gl = this.gl;
    let renderRect = Rect.fromWidth(x, y, width, height);

    // sourceDisplacementFBO에서 직접 픽셀 데이터 읽기
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.sourceDisplacementFBO);
    const pixels = new Uint16Array(width * height * 2); // RG, HALF_FLOAT
    gl.readPixels(x, y, width, height, gl.RG, gl.HALF_FLOAT, pixels);

    let beforePixelReader = PixelReader.fromPixelData(pixels, width, height);

    let copiedChangedRect = this.changedRect?.copy();

    const self = this;
    const currentSnapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: beforePixelReader,
      rect: renderRect,
      async apply() {
        await self.applyHistory(this.pixelReader, this.rect);

        self.changeDirtyRecorder = DirtyRectRecorder.clampedRect(
          0,
          0,
          paintOptions.width,
          paintOptions.height,
        );
        if (copiedChangedRect) {
          self.changeDirtyRecorder.updateRect(copiedChangedRect);
        }
      },
    };

    return currentSnapshot;
  }

  /**
   * sourceDisplaceTex를 displacementTex에 적용시킨다.
   */
  private restore(rect: Rect) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.sourceDisplacementFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.displaceFBO);

    gl.blitFramebuffer(
      rect.x,
      rect.y,
      rect.ex + 1,
      rect.ey + 1,
      rect.x,
      rect.y,
      rect.ex + 1,
      rect.ey + 1,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );
  }

  private openTexture() {
    const gl = this.gl;
    this.displacementModifier.resetWorkSpace(
      paintOptions.width,
      paintOptions.height,
    );

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceDisplacementTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG16F,
      paintOptions.width,
      paintOptions.height,
      0,
      gl.RG,
      gl.HALF_FLOAT,
      null,
    );

    gl.useProgram(this.renderProgram);
    gl.uniform2f(
      gl.getUniformLocation(this.renderProgram, "u_resolution"),
      paintOptions.width,
      paintOptions.height,
    );
  }

  private closeTexture() {
    const gl = this.gl;
    this.displacementModifier.exit();

    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE_DISPLACEMENT);
    gl.bindTexture(gl.TEXTURE_2D, this.sourceDisplacementTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RG16F,
      1,
      1,
      0,
      gl.RG,
      gl.HALF_FLOAT,
      null,
    );
  }

  private enterLogic() {
    this.changeDirtyRecorder = DirtyRectRecorder.clampedRect(
      0,
      0,
      paintOptions.width,
      paintOptions.height,
    );
    this.changedRect = null;
    this.openTexture();
  }

  // Public interface methods
  enter() {
    const gl = this.gl;
    this.enterLogic();

    const newHistory = new HistoryObject(gl, {
      undo: async () => {
        this.closeTexture();
        return { tool: "brush" };
      },
      redo: async () => {
        this.enterLogic();
        return { tool: "liquify" };
      },
    });

    let historyManager = getHistoryManager(this.canvas, gl);
    historyManager.addUndo(newHistory);
  }

  start(pointer: any) {
    let ceiledRadius = Math.ceil(paintOptions.radius);
    this.displacementModifier.start(pointer);
    this.changeDirtyRecorder.updatePointer(pointer, ceiledRadius);
  }

  push(start: any, end: any) {
    let rect = this.displacementModifier.push(start, end);
    if (rect) {
      this.scissorRect = rect; // brush/eraser 렌더 영역으로 사용
    }
    this.changeDirtyRecorder.updatePointer(start, paintOptions.radius);
    this.changeDirtyRecorder.updatePointer(end, paintOptions.radius);
  }

  render() {
    const gl = this.gl;
    gl.useProgram(this.renderProgram);
    // 쓰기 영역: 내 화면
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.layerManager.layerFBO);
    gl.viewport(0, 0, paintOptions.width, paintOptions.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.disable(gl.SCISSOR_TEST);

    this.renderingManager.render(this.scissorRect);
  }

  end() {
    const gl = this.gl;
    let strokeRect = this.displacementModifier.getStrokeDirtyRect();
    let renderRect = Rect.fromWidth(
      strokeRect.x,
      strokeRect.y,
      strokeRect.width,
      strokeRect.height,
    );

    const { before } = this.uploadAndMakeHistory(
      strokeRect.x,
      strokeRect.y,
      strokeRect.width,
      strokeRect.height,
    );

    let after: Snapshot;

    const self = this;
    const newHistory = new HistoryObject(gl, {
      undo: async () => {
        await before.apply();
        self.render();

        after = this.createCurrentSnapshot(
          renderRect.x,
          renderRect.y,
          renderRect.width,
          renderRect.height,
        );

        return { tool: "liquify" };
      },
      redo: async () => {
        await after.apply();
        self.render();
        return { tool: "liquify" };
      },
    });

    let historyManager = getHistoryManager(this.canvas, gl);
    historyManager.addUndo(newHistory);

    this.changedRect = this.changeDirtyRecorder.generateRect();
  }

  cancel() {
    this.restore(this.displacementModifier.getStrokeDirtyRect());
    this.render();
  }

  exit() {
    const gl = this.gl;

    let historyManager = getHistoryManager(this.canvas, gl);

    const self = this;
    if (this.changedRect) {
      const displaceSnapshot = this.createCurrentSnapshot(
        this.changedRect.x,
        this.changedRect.y,
        this.changedRect.width,
        this.changedRect.height,
      );
      let { before: beforeSource, after: afterSource } =
        this.sourceTextureManager.upload(
          this.changedRect.x,
          this.changedRect.y,
          this.changedRect.width,
          this.changedRect.height,
        );

      const newHistory = new HistoryObject(gl, {
        undo: async () => {
          self.enterLogic();
          await displaceSnapshot.apply();
          await beforeSource.apply();
          self.render(); // 지금 상태는 scissorTest를 안 켰기 때문에 전체가 렌더링 됌.
          return { tool: "liquify" };
        },
        redo: async () => {
          await afterSource.apply();
          self.closeTexture();
          return { tool: "brush" };
        },
      });

      historyManager.addUndo(newHistory);
    } else {
      const newHistory = new HistoryObject(gl, {
        undo: async () => {
          self.enterLogic();
          return { tool: "liquify" };
        },
        redo: async () => {
          self.closeTexture();
          return { tool: "brush" };
        },
      });

      historyManager.addUndo(newHistory);
    }

    this.closeTexture();
  }

  setSize: () => void = () => {};
}
