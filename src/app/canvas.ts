/** canvas.ts */
import { els } from "./ui/elements";
import { getPixelRatio, position } from "./position";
import { PaintApplication } from "@/core/PaintApplication";
import { setLayerWorker } from "./worker/workerPool";
import { getInitialImageLayout } from "@/core/initialImageLayout";

export async function tranferCanvas(initialImage?: ImageBitmap | null) {
  if (initialImage) {
    setInitialImagePosition(initialImage);
  }

  const offscreen = els.canvas.transferControlToOffscreen();

  console.log("screenHeight", position.screenHeight);

  let dpr = getPixelRatio();
  // setHeapSnapshotNearHeapLimit;

  const renderer = await PaintApplication.install(
    offscreen,
    position.screenWidth,
    position.screenHeight,
    dpr,
    position.width,
    position.height,
    position.x,
    position.y,
    position.scale,
    initialImage,
  );
  setLayerWorker(renderer);

  // // 캔버스 렌더링
  // setCameraPosition();
  // resizeScreen();
  // resizeLayer();
  // render();
}

function setInitialImagePosition(bitmap: ImageBitmap) {
  const layout = getInitialImageLayout(
    position.screenWidth,
    position.screenHeight,
    bitmap.width,
    bitmap.height,
  );

  position.setScale(layout.scale);
  position.setX(layout.x);
  position.setY(layout.y);
  position.setWidth(layout.width);
  position.setHeight(layout.height);
}
