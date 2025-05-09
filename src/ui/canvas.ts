/** canvas.ts */
import { els } from "./elements";
import { getPixelRatio, position } from "../position";
import { getLayerWorker } from "../core/worker/workerPool";
import * as Comlink from "comlink";

export async function tranferCanvas() {
    els.canvas.addEventListener("webglcontextlost", (event) => {
        //event.preventDefault(); // 자동 복구를 브라우저에 맡기지 않기 위해 필요
        console.warn("WebGL context lost!");
    });

    els.canvas.addEventListener("webglcontextrestored", () => {
        console.log("WebGL context restored!");
        // 모든 리소스 재초기화 필요
    });

    const worker = getLayerWorker();
    const offscreen = els.canvas.transferControlToOffscreen();

    console.log("screenHeight", position.screenHeight);

    let dpr = getPixelRatio();
    await worker.makeLayer(
        Comlink.transfer(offscreen, [offscreen]),
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
