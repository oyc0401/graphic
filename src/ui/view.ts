/** view.ts */
import { paintState } from "../paintState";
import { autorun } from "mobx";
import { els } from "./elements";
import { selection } from "../selection";
import { getPixelRatio, position, to_canvas_coord } from "../position";
import { zoomRect } from "./zoomState";

export function bindView() {
  bindCursorUI();
  bindSelectionUI();
  bindCursorPositionUI();
  bindTitleUI();
  bindZoomAreaUI();
}

function bindCursorUI() {
  const container = els.container;

  // 1. PAN
  autorun(() => {
    const isPan = paintState.action === "PAN";
    container.classList.toggle("grab", isPan && !paintState.pointerdown);
    container.classList.toggle("grabbing", isPan && paintState.pointerdown);
  });

  // 2. ZOOM
  autorun(() => {
    container.classList.toggle("zoom", paintState.action === "ZOOM");
  });

  // 3. SELECT 툴 (BRUSH 모드 + select 툴)
  autorun(() => {
    const isBrush = paintState.action === "BRUSH";
    const isSelectTool = paintState.toolId === "select";
    container.classList.toggle("select", isBrush && isSelectTool);
  });
  autorun(() => {
    const isSelectionTool =
      (paintState.action === "BRUSH" && paintState.toolId === "selection") ||
      paintState.toolId === "resize";
    container.classList.toggle(
      "nwse-resize",
      isSelectionTool && selection.hover == "nwse-resize"
    );
    container.classList.toggle(
      "nesw-resize",
      isSelectionTool && selection.hover == "nesw-resize"
    );
    container.classList.toggle(
      "ns-resize",
      isSelectionTool && selection.hover == "ns-resize"
    );
    container.classList.toggle(
      "ew-resize",
      isSelectionTool && selection.hover == "ew-resize"
    );
    container.classList.toggle(
      "move",
      isSelectionTool && selection.hover == "move"
    );
  });

  //   autorun(() => {
  //     const cursor = els.brushCursor;

  //     const isBrush = paintState.action === "BRUSH";

  //     const isDrawingTool = paintState.toolId == "brush";
  //     const isValid = isBrush && isDrawingTool;

  //     const isDesktop = !("ontouchstart" in window);

  //     const brushSize = paintState.getBrushSize();
  //     const dpr = getPixelRatio();

  //     const scaled = (brushSize * position.scale) / dpr;
  //     const isBigSize = scaled > 50;
  //     const showCircle = paintState.showCircle;

  //     // ───────────── container 클래스
  //     container.classList.toggle(
  //       "largeBrush",
  //       isValid && !showCircle && isBigSize
  //     );
  //     container.classList.toggle("brush", isValid && !showCircle && !isBigSize);
  //     container.classList.toggle("noCursor", isValid && showCircle);

  //     // ───────────── 브러시 커서 스타일
  //     if (isValid && (isBigSize || showCircle)) {
  //       if (isDesktop || paintState.drawing) {
  //         cursor.style.visibility = "visible";
  //       } else {
  //         cursor.style.visibility = "hidden";
  //       }
  //       cursor.style.left = `${paintState.cursorX - scaled / 2 - 1}px`;
  //       cursor.style.top = `${paintState.cursorY - scaled / 2 - 1}px`;
  //       cursor.style.width = `${scaled}px`;
  //       cursor.style.height = `${scaled}px`;
  //     } else {
  //       cursor.style.visibility = "hidden";
  //     }
  //   });
}

function bindSelectionUI() {
  // 1) selectionArea 스타일 갱신
  autorun(() => {
    const visible = selection.showHint;

    els.selectionArea.style.visibility = visible ? "visible" : "hidden";
    els.selectionSizeBox.style.visibility = visible ? "visible" : "hidden";

    const dpr = getPixelRatio();
    const scaledLeft = (selection.x / dpr + position.x) * position.scale;
    const scaledTop = (selection.y / dpr + position.y) * position.scale;
    const scaledWidth = (selection.width * position.scale) / dpr;
    const scaledHeight = (selection.height * position.scale) / dpr;

    if (visible) {
      els.selectionArea.style.left = `${scaledLeft}px`;
      els.selectionArea.style.top = `${scaledTop}px`;
      els.selectionArea.style.width = `${scaledWidth}px`;
      els.selectionArea.style.height = `${scaledHeight}px`;

      els.selectionSizeBox.style.left = `${scaledLeft}px`;
      els.selectionSizeBox.style.top = `${scaledTop + scaledHeight}px`;
      els.selectionSizeBox.style.width = `${scaledWidth}px`;

      els.selectionText.innerText = `${selection.width} x ${selection.height}`;
    }
  });

  // 2) 핸들 위치 및 표시
  autorun(() => {
    const visible = selection.showHandle;
    const dpr = getPixelRatio();
    let sLeft = (selection.x / dpr + position.x) * position.scale;
    let sTop = (selection.y / dpr + position.y) * position.scale;
    let sWidth = (selection.width * position.scale) / dpr;
    let sHeight = (selection.height * position.scale) / dpr;

    // 핸들 표시/숨김
    const handles = [els.handleLT, els.handleRT, els.handleRB, els.handleLB];

    for (const h of handles) {
      h.style.visibility = visible ? "visible" : "hidden";
    }

    // 위치 계산
    const offset = 3;
    const setPos = (handle: HTMLElement, left: number, top: number) => {
      handle.style.left = `${left - offset}px`;
      handle.style.top = `${top - offset}px`;
    };

    if (visible) {
      setPos(els.handleLT, sLeft, sTop);
      setPos(els.handleRT, sLeft + sWidth, sTop);
      setPos(els.handleRB, sLeft + sWidth, sTop + sHeight);
      setPos(els.handleLB, sLeft, sTop + sHeight);
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
    els.positionText.innerText = `${x} x ${y}`;
  });
}

function bindTitleUI() {
  autorun(() => {
    els.titleArea.style.left = `${position.x * position.scale}px`;
    els.titleArea.style.top = `${position.y * position.scale}px`;
  });

  requestAnimationFrame(() => {
    els.canvasTitle.innerText = "크기 조정";
  });
}

function bindZoomAreaUI() {
  autorun(() => {
    const isZooming = paintState.action === "ZOOM";

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
