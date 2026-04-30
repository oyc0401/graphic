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
    size: fixedStart - pointerPosition + 1,
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

    if (startFlipH && crossedH) {
      x = right;
      width = pointer.x - right + 1;
    }
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

    if (startFlipV && crossedV) {
      y = bottom;
      height = pointer.y - bottom + 1;
    }
  }

  if (handle === "RB" && crossedH && crossedV) {
    x += 1;
    width -= 1;
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
  const { startRect, handle, pointer } = input;
  const right = startRect.x + startRect.width - 1;
  const bottom = startRect.y + startRect.height - 1;
  const ratio = startRect.width / startRect.height;
  const startFlipH = input.startFlipH ?? false;
  const startFlipV = input.startFlipV ?? false;
  const crossedH = free.flipH !== startFlipH;
  const crossedV = free.flipV !== startFlipV;

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

  if (crossedH) {
    if (handle.includes("R")) {
      x = pointer.x;
      width = startRect.x - pointer.x + 1;
    } else if (handle.includes("L")) {
      x = right + 1;
      width = pointer.x - right + 1;
    }
  }

  if (crossedV) {
    if (handle.includes("B")) {
      y = pointer.y;
      height = startRect.y - pointer.y + (ratio === 1 ? 1 : 2);
    } else if (handle.includes("T")) {
      y = bottom + 1;
      height = pointer.y - bottom + 1;
    }
  }

  if (input.keepRatio && (crossedH || crossedV)) {
    height = Math.max(height, Math.ceil(width / ratio));
    width = Math.max(width, Math.ceil(height * ratio));

    if (crossedH && handle.includes("L")) {
      x = right;
    }
    if (crossedV && handle.includes("T")) {
      y = pointer.y - height + 2;
    }
    if (crossedH && handle.includes("R")) {
      x = startRect.x - width + 1;
    }
    if (crossedV && handle.includes("B")) {
      y = startRect.y - height + 1;
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
