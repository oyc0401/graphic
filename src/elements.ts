import BrushSvg from "../public/brush.svg?raw";
import EraserSvg from "../public/eraser.svg?raw";
import SelectionSvg from "../public/select_rectangle.svg?raw";
import LiquifySvg from "../public/liquify.svg?raw";

import MenuSvg from "../public/menu.svg?raw";
import UndoSvg from "../public/undo.svg?raw";
import RedoSvg from "../public/redo_disabled.svg?raw";

import { paintState } from "./main";

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

  chooseColor: $id("choose-color"),
  colorIcon: $id("color-icon"),

  colorElements: $id("color-box").querySelectorAll(".select-color")!,
};

export function getElements() {
  $id("selection-icon").innerHTML = SelectionSvg;
  $id("brush-icon").innerHTML = BrushSvg;
  $id("eraser-icon").innerHTML = EraserSvg;
  $id("liquify-icon").innerHTML = LiquifySvg;

  $id("menu-icon").innerHTML = MenuSvg;
  $id("undo-icon").innerHTML = UndoSvg;
  $id("redo-icon").innerHTML = RedoSvg;

  // const hexColors = [
  //   "#000000",
  //   "#FFFFFF",
  //   "#FF6F61",
  //   "#98FF98",
  //   "#FFA75F",
  //   "#ACE7FF",
  //   "#FFED65",
  //   "#E5B5FF",
  // ];

  // colorElements.forEach((selectDiv, index) => {
  //   const hexColor = hexColors[index];
  //   const circle = selectDiv.querySelector(".circle-shape") as HTMLDivElement;

  //   if (!circle) return;

  //   // 배경색 적용
  //   circle.style.backgroundColor = hexColor;

  //   // 흰색일 경우 테두리 추가
  //   if (hexColor.toUpperCase() === "#FFFFFF") {
  //     circle.style.border = "1px solid #E3E3E3";
  //   }

  //   // 클릭 시 색상 설정
  //   selectDiv.addEventListener("click", () => {
  //     paintState.color = hexToRgb(hexColor);
  //   });
  // });
}
