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
