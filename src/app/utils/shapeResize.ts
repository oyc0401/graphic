/**
 * 도형 핸들 드래그 결과를 계산하는 순수 함수 모듈.
 * selectionResize와 같은 좌표 규칙을 따르지만 shape 도구와 독립적으로 유지한다.
 */
export type ShapeResizeHandle =
  | "LT"
  | "T"
  | "RT"
  | "L"
  | "R"
  | "LB"
  | "B"
  | "RB";

export type ShapeResizeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ShapeResizePoint = {
  x: number;
  y: number;
};

export type ShapeResizeInput = {
  startRect: ShapeResizeRect;
  handle: ShapeResizeHandle;
  pointer: ShapeResizePoint;
  keepRatio: boolean;
  allowFlip?: boolean;
};

type InclusiveRange = {
  start: number;
  size: number;
};

function inclusiveRange(a: number, b: number): InclusiveRange {
  return {
    start: Math.min(a, b),
    size: Math.abs(a - b) + 1,
  };
}

function getOppositeCornerAnchor(
  startRect: ShapeResizeRect,
  handle: ShapeResizeHandle,
): ShapeResizePoint {
  const right = startRect.x + startRect.width - 1;
  const bottom = startRect.y + startRect.height - 1;

  return {
    x: handle.includes("L") ? right : startRect.x,
    y: handle.includes("T") ? bottom : startRect.y,
  };
}

function rectFromInclusiveCorners(
  a: ShapeResizePoint,
  b: ShapeResizePoint,
): ShapeResizeRect {
  const horizontal = inclusiveRange(a.x, b.x);
  const vertical = inclusiveRange(a.y, b.y);

  return {
    x: horizontal.start,
    y: vertical.start,
    width: horizontal.size,
    height: vertical.size,
  };
}

function clampPointerToPreventFlip(input: ShapeResizeInput): ShapeResizePoint {
  const { startRect, handle, pointer } = input;
  const right = startRect.x + startRect.width - 1;
  const bottom = startRect.y + startRect.height - 1;
  let x = pointer.x;
  let y = pointer.y;

  if (handle.includes("L")) x = Math.min(x, right);
  if (handle.includes("R")) x = Math.max(x, startRect.x);
  if (handle.includes("T")) y = Math.min(y, bottom);
  if (handle.includes("B")) y = Math.max(y, startRect.y);

  return { x, y };
}

function resizeCornerFree(input: ShapeResizeInput): ShapeResizeRect {
  const { startRect, handle, pointer } = input;
  const anchor = getOppositeCornerAnchor(startRect, handle);
  return rectFromInclusiveCorners(anchor, pointer);
}

function resizeEdgeFree(input: ShapeResizeInput): ShapeResizeRect {
  const { startRect, handle, pointer } = input;
  const right = startRect.x + startRect.width - 1;
  const bottom = startRect.y + startRect.height - 1;
  let x = startRect.x;
  let y = startRect.y;
  let width = startRect.width;
  let height = startRect.height;

  if (handle === "L") {
    const horizontal = inclusiveRange(right, pointer.x);
    x = horizontal.start;
    width = horizontal.size;
  }

  if (handle === "R") {
    const horizontal = inclusiveRange(startRect.x, pointer.x);
    x = horizontal.start;
    width = horizontal.size;
  }

  if (handle === "T") {
    const vertical = inclusiveRange(bottom, pointer.y);
    y = vertical.start;
    height = vertical.size;
  }

  if (handle === "B") {
    const vertical = inclusiveRange(startRect.y, pointer.y);
    y = vertical.start;
    height = vertical.size;
  }

  return { x, y, width, height };
}

function resizeFree(input: ShapeResizeInput): ShapeResizeRect {
  if (input.handle.length === 2) {
    return resizeCornerFree(input);
  }

  return resizeEdgeFree(input);
}

function ceilHeightForWidth(width: number, ratio: number): number {
  return Math.max(1, Math.ceil(width / ratio));
}

function ceilWidthForHeight(height: number, ratio: number): number {
  return Math.max(1, Math.ceil(height * ratio));
}

function centeredStart(start: number, size: number, nextSize: number): number {
  const center = start + (size - 1) / 2;
  return Math.round(center - (nextSize - 1) / 2);
}

function fitCornerSizeToRatio(
  width: number,
  height: number,
  ratio: number,
): Pick<ShapeResizeRect, "width" | "height"> {
  if (height > ceilHeightForWidth(width, ratio)) {
    return {
      width: ceilWidthForHeight(height, ratio),
      height,
    };
  }

  return {
    width,
    height: ceilHeightForWidth(width, ratio),
  };
}

function resizeCornerWithRatio(
  input: ShapeResizeInput,
  free: ShapeResizeRect,
): ShapeResizeRect {
  const { startRect, handle, pointer } = input;
  const ratio = startRect.width / startRect.height;
  const anchor = getOppositeCornerAnchor(startRect, handle);
  const raw = rectFromInclusiveCorners(anchor, pointer);
  const fitted = fitCornerSizeToRatio(raw.width, raw.height, ratio);
  const x = pointer.x < anchor.x ? anchor.x - fitted.width + 1 : anchor.x;
  const y = pointer.y < anchor.y ? anchor.y - fitted.height + 1 : anchor.y;

  return {
    x,
    y,
    width: fitted.width,
    height: fitted.height,
  };
}

function resizeWithRatio(
  input: ShapeResizeInput,
  free: ShapeResizeRect,
): ShapeResizeRect {
  const { startRect, handle } = input;
  const ratio = startRect.width / startRect.height;

  if (handle === "L" || handle === "R") {
    const height = ceilHeightForWidth(free.width, ratio);
    return {
      x: free.x,
      y: centeredStart(startRect.y, startRect.height, height),
      width: free.width,
      height,
    };
  }

  if (handle === "T" || handle === "B") {
    const width = ceilWidthForHeight(free.height, ratio);
    return {
      x: centeredStart(startRect.x, startRect.width, width),
      y: free.y,
      width,
      height: free.height,
    };
  }

  return resizeCornerWithRatio(input, free);
}

export function resizeShapeFromHandle(
  input: ShapeResizeInput,
): ShapeResizeRect {
  const resizeInput =
    input.allowFlip === false
      ? { ...input, pointer: clampPointerToPreventFlip(input) }
      : input;
  const free = resizeFree(resizeInput);

  if (!resizeInput.keepRatio) {
    return free;
  }

  return resizeWithRatio(resizeInput, free);
}
