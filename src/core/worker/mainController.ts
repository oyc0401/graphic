import { copyPixelsToClipboard, downloadPixels } from "../../file";
import { historyState } from "../../history";

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
};
