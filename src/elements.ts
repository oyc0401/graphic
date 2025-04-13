import BrushSvg from "./assets/brush.svg?raw";
import EraserSvg from "./assets/eraser.svg?raw";
import SelectionSvg from "./assets/select_rectangle.svg?raw";
import LiquifySvg from "./assets/liquify.svg?raw";

import MenuSvg from "./assets/menu.svg?raw";
import UndoSvg from "./assets/undo.svg?raw";
import RedoSvg from "./assets/redo_disabled.svg?raw";

import CursorSvg from "./assets/cursor.svg?raw";

function $id<T extends HTMLElement = HTMLElement>(elementId: string): T {
  const element = document.getElementById(elementId);
  if (element) {
    return element as T;
  }
  throw new Error(`No element found with id "${elementId}"`);
}

export let els = {
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

  chooseColor: $id("choose-color"),
  colorIcon: $id("color-icon"),

  colorElements: $id("color-box").querySelectorAll(".select-color")!,

  selectionSizeBox: $id("selection-size"),
  selectionText: $id("selection-text"),

  positionBox: $id("cursor-position"),
  positionText: $id("cursor-position-text"),
};

export function getElements() {
  $id("selection-icon").innerHTML = SelectionSvg;
  $id("brush-icon").innerHTML = BrushSvg;
  $id("eraser-icon").innerHTML = EraserSvg;
  $id("liquify-icon").innerHTML = LiquifySvg;

  $id("menu-icon").innerHTML = MenuSvg;
  $id("undo-icon").innerHTML = UndoSvg;
  $id("redo-icon").innerHTML = RedoSvg;

  $id("cursor-icon").innerHTML = CursorSvg;
}
