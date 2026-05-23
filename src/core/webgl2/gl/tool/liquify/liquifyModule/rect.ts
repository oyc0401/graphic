export interface LiquifyPoint {
  x: number;
  y: number;
}

export interface LiquifyRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function pointRect(
  point: LiquifyPoint,
  radius: number,
  width: number,
  height: number,
): LiquifyRect {
  const left = Math.floor(point.x - radius);
  const top = Math.floor(point.y - radius);
  const right = Math.ceil(point.x + radius);
  const bottom = Math.ceil(point.y + radius);
  return clampRect(left, top, right, bottom, width, height);
}

export function strokeRect(
  start: LiquifyPoint,
  end: LiquifyPoint,
  radius: number,
  width: number,
  height: number,
): LiquifyRect {
  const left = Math.floor(Math.min(start.x, end.x) - radius);
  const top = Math.floor(Math.min(start.y, end.y) - radius);
  const right = Math.ceil(Math.max(start.x, end.x) + radius);
  const bottom = Math.ceil(Math.max(start.y, end.y) + radius);
  return clampRect(left, top, right, bottom, width, height);
}

export function unionRect(a: LiquifyRect | null, b: LiquifyRect): LiquifyRect {
  if (!a) return b;

  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function clampRect(
  left: number,
  top: number,
  right: number,
  bottom: number,
  width: number,
  height: number,
): LiquifyRect {
  const x = clamp(left, 0, width);
  const y = clamp(top, 0, height);
  const ex = clamp(right, 0, width);
  const ey = clamp(bottom, 0, height);
  return {
    x,
    y,
    width: Math.max(0, ex - x),
    height: Math.max(0, ey - y),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
