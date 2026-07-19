import { getLayerManager } from "./layer";
import { getManager } from "../../utils/cachedManager";
import { getBitmapManager } from "../../canvas/bitmap";
import { Rect } from "@/core/utils/rect";
import { PixelStore } from "../../history/PixelStore";

export interface Snapshot {
  layerId;
  pixelReader?: PixelStore<any>;
  rect: Rect;
  apply: () => Promise<void>;
  selectionRect?: Rect;
}
export const TEXTURE_UNIT = {
  TEMP: 0, // 다용도 (Blit용, 셰이더에서 접근 X!)
  LAYER: 1, // 그림을 그릴 대상
  SOURCE: 2, // 원본 이미지 (Source Image)
  PATHMAP: 3, // 브러시, 지우개 알파맵
  DISPLACEMENT: 5, // 변위맵 (Displacement Map)
  SOURCE_DISPLACEMENT: 6, // 변위맵 이전 상태 저장 용

  SOURCE_SELECTION: 9, // 선택창 확대/축소시 대상으로 사용할 텍스쳐
  RENDERED_SELECTION: 10, // 선택창 확대/축소, copy시 그릴 버퍼
  OFFSCREEN: 11, // 렌더링 전 미리 그릴 버퍼
  SHAPE: 12, // 도형 preview

  LIQUIFY_PRIMITIVE: 17, // Finite stroke integral primitive P(U, X)
};

// W, H, cW, cH, sW, sH, mW, mH

// 최대값: W=H=cW=cH=sW=sH=mW=mH=4096
// (in-out) = 2  // read용 draw용 총 두개가 있다는 뜻

// 레이어 (1개): W * H * (RGBA) => 64MB
// SOURCE: W * H * (RGBA) => 64MB
// PATHMAP: W * H * (RED) * (in‑out) => 32MB
// DISPLACEMENT: W * H * (half‑float) * (in‑out) => 64MB (dynamic)
// SOURCE_DISPLACEMENT: W * H * (half‑float) => 32MB (dynamic)
// SOURCE_SELECTION: sW * sH * (RGBA) => 64MB (dynamic)
// RENDERED_SELECTION: mW * mH * (RGBA) => 64MB (dynamic)
// OFFSCREEN: cW * cH * (RGBA) => 7.91MB ~ 64MB

// dynamic 텍스쳐 설정하면 168 ~ 296

// 레이어 한층: 64
// SOURCE: 64
// draw = 32
// liquify: 64 + 32 = 96 (dynamic)
// selection: 64 + 64 = 128 (dynamic)

// 각각 레이어 원본은 DRAM에 들고있다가 타겟 레이어가 변경되면
// 그때 버퍼에 올리기로 하자.

// 일반 브러시는 pointerup하면 소스 텍스쳐에 반영 전에 히스토리 스택에 소스 텍스쳐를 업로드 한다.
// 픽셀유동화는 pointerup 하면 SOURCE_DISPLACEMENT에 반영 전에 히스토리 스택에 SOURCE_DISPLACEMENT를 업로드 한다.

// 픽셀유동화를 나가는것도 스택에 넣는데, 이땐 displace 전체와 source 전체를 업로드 한다. (유동화 생명주기 전체에서 dirtyRect도 구하기)

// 일반 브러시를 나가는것도 스택에....

export let paintOptions = {
  width: 100,
  height: 100,
  dpr: 1,
  radius: 10,
  color: [0, 0, 0],
  alpha: 0.5,
  x: 0,
  y: 0,
  magnification: 1,

  screenWidth: 800,
  screenHeight: 800,

  showSelection: false,
  showShape: false,
  selectionAntialias: true,
  transparentBackground: false,
  layerId: 0,
  selectionLayerId: 0,

  toolId: "brush",

  setAlpha(newAlpha) {
    paintOptions.alpha = newAlpha;
  },

  setRadius(newRadius) {
    paintOptions.radius = newRadius;
  },

  setColor({ r, g, b }) {
    paintOptions.color[0] = r / 255;
    paintOptions.color[1] = g / 255;
    paintOptions.color[2] = b / 255;
  },
};

/**
 * 소스 텍스쳐는 텍스처 슬롯 1번을 차지하고 있습니다.
 */

export function getSourceTextureManager(canvas, gl) {
  const manager = getManager(gl, "sourceTexture", () => makeSourceTextureManager(canvas, gl));
  return manager;
}

function makeSourceTextureManager(canvas, gl) {
  const layerManager = getLayerManager(canvas, gl);

  const sourceTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE);
  gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, paintOptions.width, paintOptions.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  let sourceFBO = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, sourceFBO);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sourceTexture, 0);

  function uploadFromLayer(layerId) {
    console.log("uploadFromLayer");
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, layerManager.layerFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, sourceFBO);

    // blit 좌표계는 0,0,1,1이 1칸임.
    gl.blitFramebuffer(
      0,
      0,
      paintOptions.width,
      paintOptions.height,
      0,
      0,
      paintOptions.width,
      paintOptions.height,
      gl.COLOR_BUFFER_BIT, // 복사할 버퍼
      gl.NEAREST, // 필터링 옵션
    );
  }
  async function applyHistory(layerId, pixelReader: PixelStore, rect) {
    // console.log(history)
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.LAYER);
    gl.bindTexture(gl.TEXTURE_2D, layerManager.getLayerTex(layerId));

    // pixelData를 texture에 다시 업로드
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0, // level
      rect.x, // x 좌표
      rect.y, // y 좌표
      rect.width, // width
      rect.height, // height
      gl.RGBA, // format
      gl.UNSIGNED_BYTE, // type
      await pixelReader.getPixelData(), // 데이터
    );

    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, layerManager.layerFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, sourceFBO);

    // blit 좌표계는 0,0,1,1이 1칸임.
    gl.blitFramebuffer(
      rect.x,
      rect.y,
      rect.ex + 1,
      rect.ey + 1,
      rect.x,
      rect.y,
      rect.ex + 1,
      rect.ey + 1,
      gl.COLOR_BUFFER_BIT, // 복사할 버퍼
      gl.NEAREST, // 필터링 옵션
    );

    // afterDirty를 bitmap에 업로드 해야하기 때문에 작업큐에 넣기.
    const bitmapManager = getBitmapManager();

    //pushLowQueue(gl, async () => {
    bitmapManager.applyDirtyRect(await pixelReader.getPixelData(), rect);
    //});
  }

  function createCurrentSnapshot(x, y, width, height) {
    let renderRect = Rect.fromWidth(x, y, width, height);
    const bitmapManager = getBitmapManager();
    let pixelData = bitmapManager.copyDirtyRect(renderRect);

    let beforePixel = PixelStore.fromPixelData(pixelData, renderRect.width, renderRect.height);

    const snapshot: Snapshot = {
      layerId: paintOptions.layerId,
      pixelReader: beforePixel,
      rect: renderRect,
      async apply() {
        await applyHistory(this.layerId, this.pixelReader, this.rect);
      },
    };
    return snapshot;
  }

  // 캔버스를 소스 텍스쳐로 돌려놓기
  function restore() {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFBO);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, layerManager.layerFBO);

    gl.blitFramebuffer(
      0,
      0,
      paintOptions.width,
      paintOptions.height,
      0,
      0,
      paintOptions.width,
      paintOptions.height,
      gl.COLOR_BUFFER_BIT,
      gl.NEAREST,
    );
  }

  function setSize() {
    //console.warn("source 크기 조정");
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT.SOURCE);
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      paintOptions.width,
      paintOptions.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
  }

  setSize();
  // upload(0, 0, paintOptions.width, paintOptions.height);

  let sourceTextureManager = {
    texture: sourceTexture,
    upload(x, y, width, height) {
      const bitmapManager = getBitmapManager();

      let renderRect = Rect.fromWidth(x, y, width, height);

      if (renderRect.isEmpty()) {
        console.warn("비었네");
        const beforeSnapshot: Snapshot = {
          layerId: paintOptions.layerId,
          rect: renderRect,
          async apply() {
            // await applyHistory(this.layerId, this.pixelReader, this.rect);
          },
        };
        const afterSnapshot: Snapshot = {
          layerId: paintOptions.layerId,
          rect: renderRect,
          async apply() {
            // await applyHistory(this.layerId, this.pixelReader, this.rect);
          },
        };

        return {
          before: beforeSnapshot,
          after: afterSnapshot,
        };
      }

      // 이전 큐에 쌓인 픽셀을 모두 읽어온 다음에 픽셀을 복사해야함.
      // 그러면 리드픽셀프로세서를 큐로 먼들고.
      // 큐에는 그냥 리드픽셀만 하는게 아니라 배열 복사도 이루어질 수 있게 해야함.
      // 만약에 큐 작업이 시작되기 전에 그 픽셀이 필요하다고 해도. 강제로 작업을 완료시킬 수 없고.
      // 그 픽셀이 필요하다는 명령도 큐에 넣어서 이전 작업이 모두 완료된 이후에 작업이 실행될 수 있게 해야한다.
      // 그리고 중간에 필요하다는 명령을 받으면 큐 가속을 통해서 큐 작업이 빨리 완료되게 한다.
      // getDirtyUnit8Array()

      const beforeSnapshot: Snapshot = createCurrentSnapshot(x, y, width, height);

      // sourceMap으로 업로드
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, layerManager.layerFBO);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, sourceFBO);

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

      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sourceFBO);
      const pixels = new Uint8Array(width * height * 4);

      const sizeInBytes = pixels.byteLength;
      const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
      console.log(`[Layer] Pixel data size: (${sizeInMB} MB) - ${width}x${height}`);

      gl.readPixels(renderRect.x, renderRect.y, renderRect.width, renderRect.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      bitmapManager.applyDirtyRect(pixels, renderRect);

      let afterSnapshot: Snapshot = createCurrentSnapshot(x, y, width, height);

      return {
        before: beforeSnapshot,
        after: afterSnapshot,
      };
    },
    restore,
    sourceFBO,
    setSize,
    //getCurrentSnapshot,
    uploadFromLayer,
    // uploadLater,
  };

  return sourceTextureManager;
}
