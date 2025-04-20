/** canvas.ts */
import { els } from "./elements";
import { getPixelRatio, position } from "../position";
import { getLayerWorker } from "../core/worker/workerPool";
import * as Comlink from "comlink";


export async function tranferCanvas() {
    const worker = getLayerWorker();
    const offscreen = els.canvas.transferControlToOffscreen();

    let dpr = getPixelRatio();
    await worker.makeLayer(
        Comlink.transfer(offscreen, [offscreen]),
        position.bouncingRect.width * dpr,
        position.bouncingRect.height * dpr,
        dpr,
        position.width,
        position.height,
        position.x * dpr,
        position.y * dpr,
        position.scale,
    );

    // // 캔버스 렌더링
    // setCameraPosition();
    // resizeScreen();
    // resizeLayer();
    // render();
}