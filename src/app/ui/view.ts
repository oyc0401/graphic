/** view.ts */
import { paintState } from "../paintState";
import { autorun } from "mobx";
import { els } from "./elements";
import { selection } from "../selection";
import { getPixelRatio, position, to_canvas_coord } from "../position";
import { zoomRect } from "./zoomState";
import { isSmallSize } from "../utils/screen";
import { resizeTool } from "../tools/resizeTool";
import { canvasResizeState } from "../canvasResizeState";
import { getToolCursorClasses, getToolMetadata } from "../tools/toolRegistry";
import {
  RESIZE_HANDLE_SIZE_PX,
  getCanvasResizeRect,
  toContainerRect,
} from "../utils/resizeGeometry";

export function bindView() {
  bindCursorUI();
  bindSelectionUI();
  bindCanvasResizeUI();
  bindCursorPositionUI();
  bindZoomAreaUI();
  bindLoadingIndicatorUI();
}

function bindCursorUI() {
  const container = els.container;

  // 1. PAN
  autorun(() => {
    const isPan = paintState.inputMode === "PAN";
    container.classList.toggle("grab", isPan && !paintState.pointerdown);
    container.classList.toggle("grabbing", isPan && paintState.pointerdown);
  });

  autorun(() => {
    const activeCursorClass = getToolMetadata(
      paintState.activeToolId,
    ).cursorClass;

    for (const cursorClass of getToolCursorClasses()) {
      container.classList.toggle(
        cursorClass,
        (paintState.inputMode === "BRUSH" ||
          paintState.inputMode === "COLOR_PICKER") &&
          cursorClass === activeCursorClass,
      );
    }
  });

  // 2. ZOOM
  autorun(() => {
    container.classList.toggle("zoom", paintState.inputMode === "ZOOM");
  });

  // 3. SELECT 툴 (BRUSH 모드 + select 툴)
  autorun(() => {
    const isBrush = paintState.inputMode === "BRUSH";
    const isSelectTool = paintState.toolId === "select";
    container.classList.toggle("select", isBrush && isSelectTool);
  });
  autorun(() => {
    const isSelectionTool =
      paintState.inputMode === "BRUSH" && paintState.toolId === "selection";
    const isCanvasResize = resizeTool.isVisible();
    const resizeHover = canvasResizeState.hover;
    const nwse =
      (isSelectionTool && selection.hover == "nwse-resize") ||
      (isCanvasResize && resizeHover === "nwse-resize");
    const nesw =
      (isSelectionTool && selection.hover == "nesw-resize") ||
      (isCanvasResize && resizeHover === "nesw-resize");

    container.classList.toggle("nwse-resize", nwse);
    container.classList.toggle("nesw-resize", nesw);
    container.classList.toggle(
      "ns-resize",
      isSelectionTool && selection.hover == "ns-resize",
    );
    container.classList.toggle(
      "ew-resize",
      isSelectionTool && selection.hover == "ew-resize",
    );
    container.classList.toggle(
      "move",
      isSelectionTool && selection.hover == "move",
    );
  });

  autorun(() => {
    const cursor = els.brushCursor;

    const isBrush = paintState.inputMode === "BRUSH";

    const isDrawingTool = paintState.toolId == "brush";
    const isValid = isBrush && isDrawingTool;

    const isDesktop = !("ontouchstart" in window);

    const brushSize = paintState.getBrushSize();
    const dpr = getPixelRatio();

    const scaled = (brushSize * position.scale) / dpr;
    const isBigSize = scaled > 50;
    const showCircle = paintState.showCircle;

    // ───────────── container 클래스
    container.classList.toggle(
      "largeBrush",
      isValid && !showCircle && isBigSize,
    );
    container.classList.toggle("brush", isValid && !showCircle && !isBigSize);
    container.classList.toggle("noCursor", isValid && showCircle);

    // ───────────── 브러시 커서 스타일
    if ((isValid && (isBigSize || showCircle)) || !isDesktop) {
      if (isDesktop || paintState.drawing) {
        cursor.style.visibility = "visible";
      } else {
        cursor.style.visibility = "hidden";
      }
      if (!isDesktop && paintState.pointerdown && paintState.moved) {
        cursor.style.visibility =
          (paintState.getBrushSize() * position.scale) / getPixelRatio() > 16
            ? "visible"
            : "hidden";
      }
      cursor.style.left = `${paintState.cursorX - scaled / 2 - 1}px`;
      cursor.style.top = `${paintState.cursorY - scaled / 2 - 1}px`;
      cursor.style.width = `${scaled}px`;
      cursor.style.height = `${scaled}px`;
    } else {
      cursor.style.visibility = "hidden";
    }
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
    const sLeft = ((rect.x + position.x) * position.scale) / dpr;
    const sTop = ((rect.y + position.y) * position.scale) / dpr;
    const sWidth = (rect.width * position.scale) / dpr;
    const sHeight = (rect.height * position.scale) / dpr;

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
    const scaledLeft = ((rect.x + position.x) * position.scale) / dpr;
    const scaledTop = ((rect.y + position.y) * position.scale) / dpr;
    const scaledWidth = (rect.width * position.scale) / dpr;
    const scaledHeight = (rect.height * position.scale) / dpr;

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

    els.resizeHandleLT.style.left = `${rect.x - RESIZE_HANDLE_SIZE_PX}px`;
    els.resizeHandleLT.style.top = `${rect.y - RESIZE_HANDLE_SIZE_PX}px`;
    els.resizeHandleRT.style.left = `${right}px`;
    els.resizeHandleRT.style.top = `${rect.y - RESIZE_HANDLE_SIZE_PX}px`;
    els.resizeHandleRB.style.left = `${right}px`;
    els.resizeHandleRB.style.top = `${bottom}px`;
    els.resizeHandleLB.style.left = `${rect.x - RESIZE_HANDLE_SIZE_PX}px`;
    els.resizeHandleLB.style.top = `${bottom}px`;
  };

  const positionActiveResizeHandleAtPointer = () => {
    const handle = canvasResizeState.activeHandle;
    if (!handle) return;

    const pointer = canvasResizeState.pointer;
    const half = Math.floor(RESIZE_HANDLE_SIZE_PX / 2);
    const containerRect = els.container.getBoundingClientRect();
    const left = `${pointer.clientX - containerRect.left - half}px`;
    const top = `${pointer.clientY - containerRect.top - half}px`;

    switch (handle) {
      case "LT":
        els.resizeHandleLT.style.left = left;
        els.resizeHandleLT.style.top = top;
        break;
      case "RT":
        els.resizeHandleRT.style.left = left;
        els.resizeHandleRT.style.top = top;
        break;
      case "RB":
        els.resizeHandleRB.style.left = left;
        els.resizeHandleRB.style.top = top;
        break;
      case "LB":
        els.resizeHandleLB.style.left = left;
        els.resizeHandleLB.style.top = top;
        break;
    }
  };

  autorun(() => {
    const showHandles = resizeTool.isVisible();
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
      positionActiveResizeHandleAtPointer();
    }
  });
}

function bindCursorPositionUI() {
  autorun(() => {
    let point = to_canvas_coord(paintState.cursorX, paintState.cursorY);
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
    const isZooming = paintState.inputMode === "ZOOM";

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

function bindLoadingIndicatorUI() {
  autorun(() => {
    const canTouch = paintState.canTouch;
    els.loadingIndicator.style.visibility = canTouch ? "hidden" : "visible";
  });
}
