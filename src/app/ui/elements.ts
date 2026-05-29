/** elements.ts */
import CursorSvg from "../assets/cursor.svg?raw";

function $id<T extends Element = HTMLElement>(elementId: string): T {
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
    shapeArea: $id("shape-area"),
    freeformSelectPreview: $id<SVGSVGElement>("freeform-select-preview"),
    freeformSelectPreviewLine: $id<SVGPolylineElement>(
      "freeform-select-preview-line",
    ),
    resizeArea: $id("resize-area"),
    handleLT: $id("handle-lt"),
    handleRT: $id("handle-rt"),
    handleRB: $id("handle-rb"),
    handleLB: $id("handle-lb"),
    shapeHandleLT: $id("shape-handle-lt"),
    shapeHandleRT: $id("shape-handle-rt"),
    shapeHandleRB: $id("shape-handle-rb"),
    shapeHandleLB: $id("shape-handle-lb"),
    resizeHandleLT: $id("resize-handle-lt"),
    resizeHandleRT: $id("resize-handle-rt"),
    resizeHandleRB: $id("resize-handle-rb"),
    resizeHandleLB: $id("resize-handle-lb"),

    selectionSizeBox: $id("selection-size"),
    selectionText: $id("selection-text"),
    shapeSizeBox: $id("shape-size"),
    shapeText: $id("shape-text"),
    resizeSizeBox: $id("resize-size"),
    resizeText: $id("resize-text"),

    positionBox: $id("cursor-position"),
    positionText: $id("cursor-position-text"),
    loadingIndicator: $id("loading-indicator"),
  };
}

export function getElements() {
  els = elements();
  $id("cursor-icon").innerHTML = CursorSvg;
}
