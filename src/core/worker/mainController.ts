import { copyPixelsToClipboard, downloadPixels } from "../../file";
import { historyState } from "../../history";
import { paintState } from "../../paintState";
import { position } from "../../position";
import { selection } from "../../selection";

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

    if (showSelection) {
      paintState.setToolId("selection");
    } else {
      paintState.setToolId("brush");
    }
  },
};
