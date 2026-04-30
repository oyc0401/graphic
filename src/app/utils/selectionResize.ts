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

type RatioResizeState = SelectionResizeRect & {
  crossedH: boolean;
  crossedV: boolean;
  flipH: boolean;
  flipV: boolean;
};

function normalizeInclusiveRange(
  a: number,
  b: number,
): Pick<SelectionResizeRect, "x" | "width"> {
  return {
    x: Math.min(a, b),
    width: Math.abs(a - b) + 1,
  };
}

function normalizeInclusiveVerticalRange(
  a: number,
  b: number,
): Pick<SelectionResizeRect, "y" | "height"> {
  return {
    y: Math.min(a, b),
    height: Math.abs(a - b) + 1,
  };
}

function resizeCornerFree(
  input: SelectionResizeInput,
  startFlipH: boolean,
  startFlipV: boolean,
): SelectionResizeResult {
  const { startRect, handle, pointer } = input;
  const right = startRect.x + startRect.width - 1;
  const bottom = startRect.y + startRect.height - 1;
  const anchor = {
    x: handle.includes("L") ? right : startRect.x,
    y: handle.includes("T") ? bottom : startRect.y,
  };
  const horizontal = normalizeInclusiveRange(anchor.x, pointer.x);
  const vertical = normalizeInclusiveVerticalRange(anchor.y, pointer.y);
  const crossedH = handle.includes("L")
    ? pointer.x > anchor.x
    : pointer.x < anchor.x;
  const crossedV = handle.includes("T")
    ? pointer.y > anchor.y
    : pointer.y < anchor.y;

  return {
    x: horizontal.x,
    y: vertical.y,
    width: horizontal.width,
    height: vertical.height,
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
    const horizontal = normalizeInclusiveRange(right, pointer.x);
    x = horizontal.x;
    width = horizontal.width;
    crossedH = pointer.x > right;
  }

  if (handle === "R") {
    const horizontal = normalizeInclusiveRange(startRect.x, pointer.x);
    x = horizontal.x;
    width = horizontal.width;
    crossedH = pointer.x < startRect.x;
  }

  if (handle === "T") {
    const vertical = normalizeInclusiveVerticalRange(bottom, pointer.y);
    y = vertical.y;
    height = vertical.height;
    crossedV = pointer.y > bottom;
  }

  if (handle === "B") {
    const vertical = normalizeInclusiveVerticalRange(startRect.y, pointer.y);
    y = vertical.y;
    height = vertical.height;
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
  state: RatioResizeState,
): SelectionResizeResult {
  const { startRect, handle, pointer } = input;
  const right = startRect.x + startRect.width - 1;
  const bottom = startRect.y + startRect.height - 1;
  const ratio = startRect.width / startRect.height;
  const anchor = {
    x: handle.includes("L") ? right : startRect.x,
    y: handle.includes("T") ? bottom : startRect.y,
  };
  const rawWidth = Math.abs(pointer.x - anchor.x) + 1;
  const rawHeight =
    handle.includes("B") && pointer.y < anchor.y && ratio !== 1
      ? Math.abs(pointer.y - anchor.y) + 2
      : Math.abs(pointer.y - anchor.y) + 1;
  const fitted = fitCornerSizeToRatio(rawWidth, rawHeight, ratio);
  const x = pointer.x < anchor.x ? anchor.x - fitted.width + 1 : anchor.x;
  const y = pointer.y < anchor.y ? anchor.y - fitted.height + 1 : anchor.y;

  return {
    x,
    y,
    width: fitted.width,
    height: fitted.height,
    flipH: state.flipH,
    flipV: state.flipV,
  };
}

function resizeWithRatio(
  input: SelectionResizeInput,
  free: SelectionResizeResult,
): SelectionResizeResult {
  const { startRect, handle } = input;
  const ratio = startRect.width / startRect.height;
  const startFlipH = input.startFlipH ?? false;
  const startFlipV = input.startFlipV ?? false;
  const crossedH = free.flipH !== startFlipH;
  const crossedV = free.flipV !== startFlipV;

  const state: RatioResizeState = {
    ...free,
    crossedH,
    crossedV,
  };

  if (handle === "L" || handle === "R") {
    return {
      x: state.x,
      y: state.y,
      width: state.width,
      height: ceilHeightForWidth(state.width, ratio),
      flipH: state.flipH,
      flipV: state.flipV,
    };
  }

  if (handle === "T" || handle === "B") {
    return {
      x: state.x,
      y: state.y,
      width: ceilWidthForHeight(state.height, ratio),
      height: state.height,
      flipH: state.flipH,
      flipV: state.flipV,
    };
  }

  if (handle.length === 2) {
    return resizeCornerWithRatio(input, state);
  }

  return state;
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
