/** canvas.ts */
import { els } from "./ui/elements";
import { getPixelRatio, position } from "./position";
import { PaintApplication } from "@/core/PaintApplication";
import { setLayerWorker } from "./worker/workerPool";

export async function tranferCanvas() {
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
  );
  setLayerWorker(renderer);

  // // 캔버스 렌더링
  // setCameraPosition();
  // resizeScreen();
  // resizeLayer();
  // render();
}
