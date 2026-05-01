/**
 * 선택창 핸들 드래그 결과를 계산하는 순수 함수 모듈.
 *
 * SelectionTool의 PointerEvent, MobX selection 상태, worker 호출과 분리해서
 * 드래그 시작 시점의 선택창(startRect), 잡은 핸들(handle), 현재 포인터 칸(pointer)만으로
 * 다음 선택창의 x, y, width, height, flipH, flipV를 계산한다.
 *
 * 좌표계 규칙:
 * - x/y는 선택창의 왼쪽 위 칸이다.
 * - width/height는 inclusive 픽셀 칸 개수다.
 * - 포인터가 위치한 칸은 결과 선택창 안에 반드시 포함된다.
 * - 포인터가 고정 변/고정점을 넘어가면 선택창 위치를 정규화하고 flip 값을 토글한다.
 * - allowFlip=false이면 포인터를 고정 변/고정점까지만 허용해 flip을 막는다.
 * - keepRatio=true이면 포인터 칸을 포함한 뒤 시작 선택창 비율을 유지하도록 부족한 축을 확장한다.
 */
export type SelectionResizeHandle =
  | "LT"
  | "T"
  | "RT"
  | "L"
  | "R"
  | "LB"
  | "B"
  | "RB";

export type SelectionResizeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SelectionResizePoint = {
  x: number;
  y: number;
};

export type SelectionResizeInput = {
  startRect: SelectionResizeRect;
  handle: SelectionResizeHandle;
  pointer: SelectionResizePoint;
  keepRatio: boolean;
  allowFlip?: boolean;
  startFlipH?: boolean;
  startFlipV?: boolean;
};

export type SelectionResizeResult = SelectionResizeRect & {
  flipH: boolean;
  flipV: boolean;
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
  startRect: SelectionResizeRect,
  handle: SelectionResizeHandle,
): SelectionResizePoint {
  const right = startRect.x + startRect.width - 1;
  const bottom = startRect.y + startRect.height - 1;

  return {
    x: handle.includes("L") ? right : startRect.x,
    y: handle.includes("T") ? bottom : startRect.y,
  };
}

function rectFromInclusiveCorners(
  a: SelectionResizePoint,
  b: SelectionResizePoint,
): SelectionResizeRect {
  const horizontal = inclusiveRange(a.x, b.x);
  const vertical = inclusiveRange(a.y, b.y);

  return {
    x: horizontal.start,
    y: vertical.start,
    width: horizontal.size,
    height: vertical.size,
  };
}

function clampPointerToPreventFlip(
  input: SelectionResizeInput,
): SelectionResizePoint {
  const { startRect, handle, pointer } = input;
  const right = startRect.x + startRect.width - 1;
  const bottom = startRect.y + startRect.height - 1;
  let x = pointer.x;
  let y = pointer.y;

  if (handle.includes("L")) {
    x = Math.min(x, right);
  }

  if (handle.includes("R")) {
    x = Math.max(x, startRect.x);
  }

  if (handle.includes("T")) {
    y = Math.min(y, bottom);
  }

  if (handle.includes("B")) {
    y = Math.max(y, startRect.y);
  }

  return { x, y };
}

function resizeCornerFree(
  input: SelectionResizeInput,
  startFlipH: boolean,
  startFlipV: boolean,
): SelectionResizeResult {
  const { startRect, handle, pointer } = input;
  const anchor = getOppositeCornerAnchor(startRect, handle);
  const rect = rectFromInclusiveCorners(anchor, pointer);
  const crossedH = handle.includes("L")
    ? pointer.x > anchor.x
    : pointer.x < anchor.x;
  const crossedV = handle.includes("T")
    ? pointer.y > anchor.y
    : pointer.y < anchor.y;

  return {
    ...rect,
    flipH: crossedH ? !startFlipH : startFlipH,
    flipV: crossedV ? !startFlipV : startFlipV,
  };
}

function resizeEdgeFree(
  input: SelectionResizeInput,
  startFlipH: boolean,
  startFlipV: boolean,
): SelectionResizeResult {
  const { startRect, handle, pointer } = input;
  const right = startRect.x + startRect.width - 1;
  const bottom = startRect.y + startRect.height - 1;
  let x = startRect.x;
  let y = startRect.y;
  let width = startRect.width;
  let height = startRect.height;
  let crossedH = false;
  let crossedV = false;

  if (handle === "L") {
    const horizontal = inclusiveRange(right, pointer.x);
    x = horizontal.start;
    width = horizontal.size;
    crossedH = pointer.x > right;
  }

  if (handle === "R") {
    const horizontal = inclusiveRange(startRect.x, pointer.x);
    x = horizontal.start;
    width = horizontal.size;
    crossedH = pointer.x < startRect.x;
  }

  if (handle === "T") {
    const vertical = inclusiveRange(bottom, pointer.y);
    y = vertical.start;
    height = vertical.size;
    crossedV = pointer.y > bottom;
  }

  if (handle === "B") {
    const vertical = inclusiveRange(startRect.y, pointer.y);
    y = vertical.start;
    height = vertical.size;
    crossedV = pointer.y < startRect.y;
  }

  return {
    x,
    y,
    width,
    height,
    flipH: crossedH ? !startFlipH : startFlipH,
    flipV: crossedV ? !startFlipV : startFlipV,
  };
}

function resizeFree(input: SelectionResizeInput): SelectionResizeResult {
  const { handle } = input;
  const startFlipH = input.startFlipH ?? false;
  const startFlipV = input.startFlipV ?? false;

  if (handle.length === 2) {
    return resizeCornerFree(input, startFlipH, startFlipV);
  }

  return resizeEdgeFree(input, startFlipH, startFlipV);
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
): Pick<SelectionResizeRect, "width" | "height"> {
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
  input: SelectionResizeInput,
  free: SelectionResizeResult,
): SelectionResizeResult {
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
    flipH: free.flipH,
    flipV: free.flipV,
  };
}

function resizeWithRatio(
  input: SelectionResizeInput,
  free: SelectionResizeResult,
): SelectionResizeResult {
  const { startRect, handle } = input;
  const ratio = startRect.width / startRect.height;

  if (handle === "L" || handle === "R") {
    const height = ceilHeightForWidth(free.width, ratio);

    return {
      x: free.x,
      y: centeredStart(startRect.y, startRect.height, height),
      width: free.width,
      height,
      flipH: free.flipH,
      flipV: free.flipV,
    };
  }

  if (handle === "T" || handle === "B") {
    const width = ceilWidthForHeight(free.height, ratio);

    return {
      x: centeredStart(startRect.x, startRect.width, width),
      y: free.y,
      width,
      height: free.height,
      flipH: free.flipH,
      flipV: free.flipV,
    };
  }

  if (handle.length === 2) {
    return resizeCornerWithRatio(input, free);
  }

  return free;
}

export function resizeSelectionFromHandle(
  input: SelectionResizeInput,
): SelectionResizeResult {
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
