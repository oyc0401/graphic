/** canvas.ts */
import { els } from "./ui/elements";
import { getPixelRatio, position } from "./position";
import { getApplication, setApplication } from "./worker/workerPool";
import { PaintApplication } from "@/core/PaintApplication";

export async function tranferCanvas() {
  const offscreen = els.canvas.transferControlToOffscreen();

  console.log("screenHeight", position.screenHeight);

  let dpr = getPixelRatio();
  // setHeapSnapshotNearHeapLimit;

  setApplication(new PaintApplication());
  const application = getApplication();

  await application.install(
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

  // // 캔버스 렌더링
  // setCameraPosition();
  // resizeScreen();
  // resizeLayer();
  // render();
}
