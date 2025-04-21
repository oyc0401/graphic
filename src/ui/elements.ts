/** elements.ts */

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
  zoomArea: $id("zoom-area"),

  selectionArea: $id("selection-area"),
  handleLT: $id("handle-lt"),
  handleT: $id("handle-t"),
  handleRT: $id("handle-rt"),
  handleR: $id("handle-r"),
  handleRB: $id("handle-rb"),
  handleB: $id("handle-b"),
  handleLB: $id("handle-lb"),
  handleL: $id("handle-l"),

  selectionSizeBox: $id("selection-size"),
  selectionText: $id("selection-text"),

  positionBox: $id("cursor-position"),
  positionText: $id("cursor-position-text"),

  titleArea: $id("title-area"),
  canvasTitle: $id("canvas-title"),
};

export function getElements() {

}
