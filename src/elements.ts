import BrushSvg from "../public/brush.svg?raw";
import EraserSvg from "../public/eraser.svg?raw";
import SelectionSvg from "../public/select_rectangle.svg?raw";
import LiquifySvg from "../public/liquify.svg?raw";

import MenuSvg from "../public/menu.svg?raw";
import UndoSvg from "../public/undo.svg?raw";
import RedoSvg from "../public/redo_disabled.svg?raw";

function $id<T extends HTMLElement = HTMLElement>(elementId: string): T {
  const element = document.getElementById(elementId);
  if (element) {
    return element as T;
  }
  throw new Error(`No element found with id "${elementId}"`);
}

export const els = {
  canvas: $id<HTMLCanvasElement>("canvas")!,
  container: $id("container"),
  brushCursor: $id("brush-cursor"),

  selectSelectionBtn: $id("select-selection"),
  selectBrushBtn: $id("select-brush"),
  selectEraserBtn: $id("select-eraser"),
  selectLiquifyBtn: $id("select-liquify"),

  zoomArea: $id("zoom-area"),
  selectionArea: $id("selection-area"),

  sizeValue: $id("size-value"),
  opacityValue: $id("opacity-value")!,
  sizeSlider: $id<HTMLInputElement>("size-slider"),
  opacitySlider: $id<HTMLInputElement>("opacity-slider"),

  handleLT: $id("handle-lt"),
  handleT: $id("handle-t"),
  handleRT: $id("handle-rt"),
  handleR: $id("handle-r"),
  handleRB: $id("handle-rb"),
  handleB: $id("handle-b"),
  handleLB: $id("handle-lb"),
  handleL: $id("handle-l"),
};

export function getElements() {
  $id("selection-icon").innerHTML = SelectionSvg;
  $id("brush-icon").innerHTML = BrushSvg;
  $id("eraser-icon").innerHTML = EraserSvg;
  $id("liquify-icon").innerHTML = LiquifySvg;

  $id("menu-icon").innerHTML = MenuSvg;
  $id("undo-icon").innerHTML = UndoSvg;
  $id("redo-icon").innerHTML = RedoSvg;
}
