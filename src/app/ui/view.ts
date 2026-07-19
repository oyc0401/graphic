/** view.ts */
import { InputMode, paintState, ToolId } from "../paintState";
import { autorun } from "mobx";
import { els } from "./elements";
import { selection } from "../selection";
import { shape } from "../shape";
import { getCamera, getPixelRatio, position, to_canvas_coord } from "../position";
import {
  sceneLengthToCss,
  sceneRectToContainer,
  sceneToContainer,
} from "../utils/cameraMath";
import { zoomRect } from "./zoomState";
import { resizeTool } from "../tools/resizeTool";
import { selectionTool } from "../tools/SelectionTool";
import { shapeTool } from "../tools/ShapeTool";
import { canvasResizeState } from "../canvasResizeState";
import { getCurrentTool } from "../tools/activeTool";
import {
  RESIZE_HANDLE_SIZE_PX,
  RESIZE_HANDLE_STROKE_WIDTH_PX,
  getCanvasResizeRect,
  toContainerRect,
} from "../utils/resizeGeometry";

const TOOL_CURSOR_CLASSES = ["zoom", "select", "colorPicker"] as const;

export function bindView() {
  bindCursorUI();
  bindSelectionUI();
  bindShapeUI();
  bindFreeformSelectPreviewUI();
  bindCanvasResizeHover();
  bindCanvasResizeUI();
  bindCursorPositionUI();
  bindZoomAreaUI();
  // bindLoadingIndicatorUI();
}

function bindCursorUI() {
  const container = els.container;

  // 1. PAN
  autorun(() => {
    const isPan = paintState.getInputMode() === InputMode.Pan;
    container.classList.toggle("grab", isPan && !paintState.getPointerdown());
    container.classList.toggle(
      "grabbing",
      isPan && paintState.getPointerdown(),
    );
  });

  autorun(() => {
    const activeCursorClass = getCurrentTool()?.config.cursorClass;

    for (const cursorClass of TOOL_CURSOR_CLASSES) {
      container.classList.toggle(
        cursorClass,
        paintState.getInputMode() !== InputMode.Pan &&
          paintState.getInputMode() !== InputMode.Pinch &&
          cursorClass === activeCursorClass,
      );
    }
  });

  // 2. ZOOM
  autorun(() => {
    const isZoom = getCurrentTool()?.config.cursorClass === "zoom";
    container.classList.toggle("zoom", isZoom);
  });

  // 3. SELECT 툴 (BRUSH 모드 + select 툴)
  autorun(() => {
    const isSelectTool = getCurrentTool()?.config.cursorClass === "select";
    container.classList.toggle("select", isSelectTool);
  });
  autorun(() => {
    const isSelectionTool =
      paintState.getInputMode() === InputMode.DEFAULT &&
      paintState.getSessionId() === null &&
      paintState.getTemporaryToolId() === null &&
      selection.visible;
    const isShapeTool =
      paintState.getInputMode() === InputMode.DEFAULT &&
      paintState.getSessionId() === null &&
      paintState.getTemporaryToolId() === null &&
      shape.visible;
    const isCanvasResize =
      canvasResizeState.active || canvasResizeState.hover !== null;
    const resizeHover = canvasResizeState.hover;
    const nwse =
      (isSelectionTool && selection.hover == "nwse-resize") ||
      (isShapeTool && shape.hover == "nwse-resize") ||
      (isCanvasResize && resizeHover === "nwse-resize");
    const nesw =
      (isSelectionTool && selection.hover == "nesw-resize") ||
      (isShapeTool && shape.hover == "nesw-resize") ||
      (isCanvasResize && resizeHover === "nesw-resize");

    container.classList.toggle("nwse-resize", nwse);
    container.classList.toggle("nesw-resize", nesw);
    container.classList.toggle(
      "ns-resize",
      (isSelectionTool && selection.hover == "ns-resize") ||
        (isShapeTool && shape.hover == "ns-resize"),
    );
    container.classList.toggle(
      "ew-resize",
      (isSelectionTool && selection.hover == "ew-resize") ||
        (isShapeTool && shape.hover == "ew-resize"),
    );
    container.classList.toggle(
      "move",
      (isSelectionTool && selection.hover == "move") ||
        (isShapeTool && shape.hover == "move"),
    );
  });

  autorun(() => {
    const cursor = els.brushCursor;

    const isBrush = paintState.getInputMode() === InputMode.DEFAULT;
    const tool = getCurrentTool();

    const isDrawingTool =
      (paintState.getSelectedToolId() === ToolId.Brush &&
        tool?.config.allowCanvasResizeHandle) ||
      paintState.getSessionId() !== null;
    const isValid = isBrush && isDrawingTool;

    const isDesktop = !("ontouchstart" in window);

    const brushSize = paintState.getBrushSize();
    const dpr = getPixelRatio();

    const scaled = sceneLengthToCss(brushSize, position.scale, dpr);
    const isBigSize = scaled > 50;
    const showBrushCursorPreview = paintState.getShowBrushCursorPreview();

    // ───────────── container 클래스
    container.classList.toggle(
      "largeBrush",
      isValid && !showBrushCursorPreview && isBigSize,
    );
    container.classList.toggle(
      "brush",
      isValid && !showBrushCursorPreview && !isBigSize,
    );
    container.classList.toggle("noCursor", isValid && showBrushCursorPreview);

    // ───────────── 브러시 커서 스타일
    // Size 슬라이더 드래그 중에는 도구와 무관하게 뷰포트 중앙에 강제 표시
    if (paintState.getShowCenteredBrushPreview()) {
      cursor.style.visibility = "visible";
      cursor.style.left = `${window.innerWidth / 2 - scaled / 2 - 1}px`;
      cursor.style.top = `${window.innerHeight / 2 - scaled / 2 - 1}px`;
      cursor.style.width = `${scaled}px`;
      cursor.style.height = `${scaled}px`;
    } else if ((isValid && (isBigSize || showBrushCursorPreview)) || !isDesktop) {
      if (isDesktop || paintState.getShowBrushCursor()) {
        cursor.style.visibility = "visible";
      } else {
        cursor.style.visibility = "hidden";
      }
      if (!isDesktop && paintState.getPointerdown() && paintState.getMoved()) {
        cursor.style.visibility =
          sceneLengthToCss(
            paintState.getBrushSize(),
            position.scale,
            getPixelRatio(),
          ) > 16
            ? "visible"
            : "hidden";
      }
      cursor.style.left = `${paintState.getCursorX() - scaled / 2 - 1}px`;
      cursor.style.top = `${paintState.getCursorY() - scaled / 2 - 1}px`;
      cursor.style.width = `${scaled}px`;
      cursor.style.height = `${scaled}px`;
    } else {
      cursor.style.visibility = "hidden";
    }
  });
}

function bindFreeformSelectPreviewUI() {
  autorun(() => {
    const points = selection.freeformPreviewPoints;
    const visible =
      selection.freeformPreviewVisible &&
      !selection.visible &&
      points.length > 1;

    els.freeformSelectPreview.style.visibility = visible
      ? "visible"
      : "hidden";

    if (!visible) {
      els.freeformSelectPreviewLine.setAttribute("points", "");
      return;
    }

    const dpr = getPixelRatio();
    const width = position.bouncingRect.width;
    const height = position.bouncingRect.height;
    els.freeformSelectPreview.setAttribute(
      "viewBox",
      `0 0 ${width} ${height}`,
    );

    const polylinePoints = points
      .map((point) => {
        const p = sceneToContainer(point.x, point.y, getCamera(), dpr);
        return `${p.x},${p.y}`;
      })
      .join(" ");

    els.freeformSelectPreviewLine.setAttribute("points", polylinePoints);
  });
}

function bindSelectionUI() {
  const positionHandles = (
    handles: {
      lt: HTMLElement;
      rt: HTMLElement;
      rb: HTMLElement;
      lb: HTMLElement;
    },
    rect: { x: number; y: number; width: number; height: number },
  ) => {
    const dpr = getPixelRatio();
    const s = sceneRectToContainer(rect, getCamera(), dpr);
    const sLeft = s.x;
    const sTop = s.y;
    const sWidth = s.width;
    const sHeight = s.height;

    const offset = 3;
    const setPos = (handle: HTMLElement, left: number, top: number) => {
      handle.style.left = `${left - offset}px`;
      handle.style.top = `${top - offset}px`;
    };

    setPos(handles.lt, sLeft, sTop);
    setPos(handles.rt, sLeft + sWidth, sTop);
    setPos(handles.rb, sLeft + sWidth, sTop + sHeight);
    setPos(handles.lb, sLeft, sTop + sHeight);
  };

  const setHandleVisibility = (handles: HTMLElement[], visible: boolean) => {
    for (const h of handles) {
      h.style.visibility = visible ? "visible" : "hidden";
    }
  };

  // 1) selectionArea 스타일 갱신
  autorun(() => {
    const visible = selection.showHint;
    const showSizeBox = selection.showHint;

    els.selectionArea.style.visibility = visible ? "visible" : "hidden";
    els.selectionSizeBox.style.visibility = showSizeBox ? "visible" : "hidden";

    const rect = selection.showHint
      ? selection
      : { x: 0, y: 0, width: position.width, height: position.height };

    const dpr = getPixelRatio();
    const scaled = sceneRectToContainer(rect, getCamera(), dpr);
    const scaledLeft = scaled.x;
    const scaledTop = scaled.y;
    const scaledWidth = scaled.width;
    const scaledHeight = scaled.height;

    if (visible) {
      els.selectionArea.style.left = `${scaledLeft}px`;
      els.selectionArea.style.top = `${scaledTop}px`;
      els.selectionArea.style.width = `${scaledWidth}px`;
      els.selectionArea.style.height = `${scaledHeight}px`;

      els.selectionSizeBox.style.left = `${scaledLeft}px`;
      els.selectionSizeBox.style.top = `${scaledTop + scaledHeight}px`;
      els.selectionSizeBox.style.width = `${scaledWidth}px`;

      els.selectionText.innerText = `${rect.width} x ${rect.height}`;
    }
  });

  // 2) 핸들 위치 및 표시
  autorun(() => {
    const selectionHandles = [
      els.handleLT,
      els.handleRT,
      els.handleRB,
      els.handleLB,
    ];

    setHandleVisibility(selectionHandles, selection.showHandle);

    if (selection.showHandle) {
      positionHandles(
        {
          lt: els.handleLT,
          rt: els.handleRT,
          rb: els.handleRB,
          lb: els.handleLB,
        },
        selection,
      );
    }
  });
}

function bindShapeUI() {
  const positionHandles = (
    handles: {
      lt: HTMLElement;
      rt: HTMLElement;
      rb: HTMLElement;
      lb: HTMLElement;
    },
    rect: { x: number; y: number; width: number; height: number },
  ) => {
    const dpr = getPixelRatio();
    const s = sceneRectToContainer(rect, getCamera(), dpr);
    const sLeft = s.x;
    const sTop = s.y;
    const sWidth = s.width;
    const sHeight = s.height;

    const offset = 3;
    const setPos = (handle: HTMLElement, left: number, top: number) => {
      handle.style.left = `${left - offset}px`;
      handle.style.top = `${top - offset}px`;
    };

    setPos(handles.lt, sLeft, sTop);
    setPos(handles.rt, sLeft + sWidth, sTop);
    setPos(handles.rb, sLeft + sWidth, sTop + sHeight);
    setPos(handles.lb, sLeft, sTop + sHeight);
  };

  const setHandleVisibility = (handles: HTMLElement[], visible: boolean) => {
    for (const h of handles) {
      h.style.visibility = visible ? "visible" : "hidden";
    }
  };

  autorun(() => {
    const visible = shape.showHint;
    const showSizeBox = shape.showHint;

    els.shapeArea.style.visibility = visible ? "visible" : "hidden";
    els.shapeSizeBox.style.visibility = showSizeBox ? "visible" : "hidden";

    const rect = shape.showHint
      ? shape
      : { x: 0, y: 0, width: position.width, height: position.height };

    const dpr = getPixelRatio();
    const scaled = sceneRectToContainer(rect, getCamera(), dpr);
    const scaledLeft = scaled.x;
    const scaledTop = scaled.y;
    const scaledWidth = scaled.width;
    const scaledHeight = scaled.height;

    if (visible) {
      els.shapeArea.style.left = `${scaledLeft}px`;
      els.shapeArea.style.top = `${scaledTop}px`;
      els.shapeArea.style.width = `${scaledWidth}px`;
      els.shapeArea.style.height = `${scaledHeight}px`;

      els.shapeSizeBox.style.left = `${scaledLeft}px`;
      els.shapeSizeBox.style.top = `${scaledTop + scaledHeight}px`;
      els.shapeSizeBox.style.width = `${scaledWidth}px`;

      els.shapeText.innerText = `${rect.width} x ${rect.height}`;
    }
  });

  autorun(() => {
    const shapeHandles = [
      els.shapeHandleLT,
      els.shapeHandleRT,
      els.shapeHandleRB,
      els.shapeHandleLB,
    ];

    setHandleVisibility(shapeHandles, shape.showHandle);

    if (shape.showHandle) {
      positionHandles(
        {
          lt: els.shapeHandleLT,
          rt: els.shapeHandleRT,
          rb: els.shapeHandleRB,
          lb: els.shapeHandleLB,
        },
        shape,
      );
    }
  });
}

function canShowCanvasResizeHandle() {
  if (paintState.getPointerdown()) return false;

  const tool = getCurrentTool();
  return Boolean(
    paintState.getInputMode() === InputMode.DEFAULT &&
      tool?.config.allowCanvasResizeHandle,
  );
}

function canShowSelectionHover() {
  return (
    !paintState.getPointerdown() &&
    paintState.getInputMode() === InputMode.DEFAULT &&
    paintState.getSessionId() === null &&
    paintState.getTemporaryToolId() === null &&
    selection.visible &&
    selection.showHandle
  );
}

function canShowShapeHover() {
  return (
    !paintState.getPointerdown() &&
    paintState.getInputMode() === InputMode.DEFAULT &&
    paintState.getSessionId() === null &&
    paintState.getTemporaryToolId() === null &&
    shape.visible &&
    shape.showHandle
  );
}

function bindCanvasResizeHover() {
  els.container.addEventListener("pointermove", (event) => {
    resizeTool.updateHover(event, canShowCanvasResizeHandle());
    shapeTool.updateHover(event, canShowShapeHover());
    selectionTool.updateHover(event, canShowSelectionHover());
  });

  els.container.addEventListener("pointerleave", (event) => {
    resizeTool.updateHover(event, false);
    shapeTool.updateHover(event, false);
    selectionTool.updateHover(event, false);
  });
}

function bindCanvasResizeUI() {
  const resizeHandles = [
    els.resizeHandleLT,
    els.resizeHandleRT,
    els.resizeHandleRB,
    els.resizeHandleLB,
  ];

  const setVisibility = (elements: HTMLElement[], visible: boolean) => {
    for (const element of elements) {
      element.style.visibility = visible ? "visible" : "hidden";
    }
  };

  const setResizeArea = (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    els.resizeArea.style.left = `${rect.x}px`;
    els.resizeArea.style.top = `${rect.y}px`;
    els.resizeArea.style.width = `${rect.width}px`;
    els.resizeArea.style.height = `${rect.height}px`;
  };

  const positionResizeHandles = (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    const right = rect.x + rect.width;
    const bottom = rect.y + rect.height;
    const inset = RESIZE_HANDLE_SIZE_PX - 1;
    const stroke = RESIZE_HANDLE_STROKE_WIDTH_PX;

    els.resizeHandleLT.style.left = `${rect.x - stroke}px`;
    els.resizeHandleLT.style.top = `${rect.y - stroke}px`;
    els.resizeHandleRT.style.left = `${right - inset}px`;
    els.resizeHandleRT.style.top = `${rect.y - stroke}px`;
    els.resizeHandleRB.style.left = `${right - inset}px`;
    els.resizeHandleRB.style.top = `${bottom - inset}px`;
    els.resizeHandleLB.style.left = `${rect.x - stroke}px`;
    els.resizeHandleLB.style.top = `${bottom - inset}px`;
  };

  autorun(() => {
    const showHandles = canvasResizeState.active || canShowCanvasResizeHandle();
    const showPreview = canvasResizeState.active;
    const rect = toContainerRect(
      showPreview ? canvasResizeState.rect : getCanvasResizeRect(),
    );

    setVisibility(resizeHandles, showHandles);
    els.resizeArea.style.visibility = showPreview ? "visible" : "hidden";
    els.resizeSizeBox.style.visibility = showPreview ? "visible" : "hidden";

    if (!showHandles && !showPreview) return;

    if (showPreview) {
      setResizeArea(rect);
      els.resizeSizeBox.style.left = `${rect.x}px`;
      els.resizeSizeBox.style.top = `${rect.y + rect.height}px`;
      els.resizeSizeBox.style.width = `${rect.width}px`;
      els.resizeText.innerText = `${canvasResizeState.rect.width} x ${canvasResizeState.rect.height}`;
    }

    if (showHandles) {
      positionResizeHandles(rect);
    }
  });
}

function bindCursorPositionUI() {
  autorun(() => {
    let point = to_canvas_coord(
      paintState.getCursorX(),
      paintState.getCursorY(),
    );
    let x = Math.ceil(point.x);
    let y = Math.ceil(point.y);
    let visible = 0 < x && x <= position.width && 0 < y && y <= position.height;

    els.positionBox.style.visibility = visible ? "visible" : "hidden";
    //els.positionBox.style.visibility = "hidden";
    els.positionText.innerText = `${x} x ${y}`;
  });
}

function bindZoomAreaUI() {
  autorun(() => {
    const isZooming = getCurrentTool()?.config.cursorClass === "zoom";

    if (!isZooming) {
      els.zoomArea.style.visibility = "hidden";
      return;
    }

    const startX = Math.min(zoomRect.sx, zoomRect.ex);
    const startY = Math.min(zoomRect.sy, zoomRect.ey);
    const width = Math.abs(zoomRect.sx - zoomRect.ex);
    const height = Math.abs(zoomRect.sy - zoomRect.ey);

    els.zoomArea.style.visibility = "visible";
    els.zoomArea.style.left = `${startX}px`;
    els.zoomArea.style.top = `${startY}px`;
    els.zoomArea.style.width = `${width}px`;
    els.zoomArea.style.height = `${height}px`;
  });
}

// function bindLoadingIndicatorUI() {
//   autorun(() => {
//     // TODO: Reconnect this when there is a real busy/loading state.
//     els.loadingIndicator.style.visibility = "hidden";
//   });
// }
