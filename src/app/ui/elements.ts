/** elements.ts */
import CursorSvg from "../assets/cursor.svg?raw";

function $id<T extends HTMLElement = HTMLElement>(elementId: string): T {
  const element = document.getElementById(elementId);
  if (element) {
    return element as T;
  }
  throw new Error(`No element found with id "${elementId}"`);
}

type Elements = ReturnType<typeof elements>;

export let els: Elements = elements();

function elements() {
  return {
    canvas: $id<HTMLCanvasElement>("canvas")!,
    container: $id("container"),
    brushCursor: $id("brush-cursor"),
    zoomArea: $id("zoom-area"),

    selectionArea: $id("selection-area"),
    handleLT: $id("handle-lt"),
    handleRT: $id("handle-rt"),
    handleRB: $id("handle-rb"),
    handleLB: $id("handle-lb"),

    selectionSizeBox: $id("selection-size"),
    selectionText: $id("selection-text"),

    positionBox: $id("cursor-position"),
    positionText: $id("cursor-position-text"),
  };
}

export function getElements() {
  els = elements();
  $id("cursor-icon").innerHTML = CursorSvg;
}
