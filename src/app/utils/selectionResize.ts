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
  startFlipH?: boolean;
  startFlipV?: boolean;
};

export type SelectionResizeResult = SelectionResizeRect & {
  flipH: boolean;
  flipV: boolean;
};

type AxisResizeResult = {
  start: number;
  size: number;
  flipped: boolean;
};

function resizeAxisFromStartEdge(
  fixedStart: number,
  pointerPosition: number,
): AxisResizeResult {
  if (pointerPosition >= fixedStart) {
    return {
      start: fixedStart,
      size: pointerPosition - fixedStart + 1,
      flipped: false,
    };
  }

  return {
    start: pointerPosition,
    size: fixedStart - pointerPosition,
    flipped: true,
  };
}

function resizeAxisFromEndEdge(
  fixedEnd: number,
  pointerPosition: number,
): AxisResizeResult {
  if (pointerPosition <= fixedEnd) {
    return {
      start: pointerPosition,
      size: fixedEnd - pointerPosition + 1,
      flipped: false,
    };
  }

  return {
    start: fixedEnd + 1,
    size: pointerPosition - fixedEnd,
    flipped: true,
  };
}

function resizeFree(input: SelectionResizeInput): SelectionResizeResult {
  const { startRect, handle, pointer } = input;
  const startFlipH = input.startFlipH ?? false;
  const startFlipV = input.startFlipV ?? false;
  const right = startRect.x + startRect.width - 1;
  const bottom = startRect.y + startRect.height - 1;

  let x = startRect.x;
  let y = startRect.y;
  let width = startRect.width;
  let height = startRect.height;
  let crossedH = false;
  let crossedV = false;

  if (handle.includes("R")) {
    const resized = resizeAxisFromStartEdge(startRect.x, pointer.x);
    x = resized.start;
    width = resized.size;
    crossedH = resized.flipped;
  }

  if (handle.includes("L")) {
    const resized = resizeAxisFromEndEdge(right, pointer.x);
    x = resized.start;
    width = resized.size;
    crossedH = resized.flipped;
  }

  if (handle.includes("B")) {
    const resized = resizeAxisFromStartEdge(startRect.y, pointer.y);
    y = resized.start;
    height = resized.size;
    crossedV = resized.flipped;
  }

  if (handle.includes("T")) {
    const resized = resizeAxisFromEndEdge(bottom, pointer.y);
    y = resized.start;
    height = resized.size;
    crossedV = resized.flipped;
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

function resizeWithRatio(
  input: SelectionResizeInput,
  free: SelectionResizeResult,
): SelectionResizeResult {
  const { startRect, handle } = input;
  const right = startRect.x + startRect.width - 1;
  const bottom = startRect.y + startRect.height - 1;
  const ratio = startRect.width / startRect.height;

  let { x, y, width, height } = free;

  if (handle === "L" || handle === "R") {
    height = Math.max(1, Math.ceil(width / ratio));
  }

  if (handle === "T" || handle === "B") {
    width = Math.max(1, Math.ceil(height * ratio));
  }

  if (handle.length === 2) {
    if (width / height < ratio) {
      width = Math.max(1, Math.ceil(height * ratio));
    } else {
      height = Math.max(1, Math.ceil(width / ratio));
    }

    if (handle.includes("L")) {
      x = free.flipH ? right + 1 : right - width + 1;
    }
    if (handle.includes("T")) {
      y = free.flipV ? bottom + 1 : bottom - height + 1;
    }
  }

  return {
    x,
    y,
    width,
    height,
    flipH: free.flipH,
    flipV: free.flipV,
  };
}

export function resizeSelectionFromHandle(
  input: SelectionResizeInput,
): SelectionResizeResult {
  const free = resizeFree(input);

  if (!input.keepRatio) {
    return free;
  }

  return resizeWithRatio(input, free);
}
