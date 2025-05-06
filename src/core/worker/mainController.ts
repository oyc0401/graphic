import { copyPixelsToClipboard, downloadPixels } from "../../file";
import { historyState } from "../../history";
import { paintState } from "../../paintState";
import { getPixelRatio, position } from "../../position";
import { selection } from "../../selection";
import { getLayerWorker } from "./workerPool";

export const mainApi = {
  historyCount(undoCount, redoCount) {
    historyState.setUndoCount(undoCount);
    historyState.setRedoCount(redoCount);
  },
  copy(pixels, width, height) {
    let pixelData: Uint8ClampedArray = pixels;
    copyPixelsToClipboard(pixelData, width, height);
  },
  download(pixels, width, height) {
    let pixelData: Uint8ClampedArray = pixels;
    downloadPixels(pixelData, width, height);
  },
  setSelectionPosition(showSelection, x, y, width, height) {
    let realY = position.height - y - height;
    selection.setX(x);
    selection.setY(realY);
    selection.setWidth(width);
    selection.setHeight(height);
    selection.setShowHandle(showSelection);
    selection.setShowHint(showSelection);
    selection.setVisible(showSelection);
    let worker = getLayerWorker();

    if (showSelection) {
      paintState.setToolId("selection");
      worker.setTool("selection");
    } else {
      paintState.setToolId("select");
      worker.setTool("select");
    }
  },
  setPosition(x, y, width, height) {
    let newY =
      (position.bouncingRect.height * getPixelRatio()) / position.scale -
      height -
      y;
    console.log(
      (position.bouncingRect.height * getPixelRatio()) / position.scale,
      height,
      y,
    );
    console.log("newY:", newY);
    position.setX(x / getPixelRatio());
    position.setY(newY / getPixelRatio());
    position.setWidth(width);
    position.setHeight(height);
    console.log("send:", x, y, width, height);
    console.log(
      "afterpos:",
      position.x,
      position.y,
      position.width,
      position.height,
    );
  },
};

function toWindowCoord3(x, y, width, height, screenWidth, screenHeight, scale) {
  let originalY = -(y - screenHeight / scale + height);
  return {
    x,
    y: originalY,
  };
}
