export interface FloodFillPoint {
  x: number;
  y: number;
}

export interface FloodFillRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function pointRect(point: FloodFillPoint, width: number, height: number): FloodFillRect {
  const x = clamp(Math.floor(point.x), 0, width);
  const y = clamp(Math.floor(point.y), 0, height);
  return {
    x,
    y,
    width: x < width && y < height ? 1 : 0,
    height: x < width && y < height ? 1 : 0,
  };
}

export function unionRect(a: FloodFillRect | null, b: FloodFillRect): FloodFillRect {
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
