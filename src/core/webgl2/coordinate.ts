import type { Pointer } from "../types";

// 포인터 좌표의 Y축을 WebGL 좌표계로 뒤집는다.
export function toWebglCoord(
  pointer: Pointer,
  canvasHeight: number,
): { x: number; y: number } {
  let { x, y } = pointer;
  return {
    x,
    y: canvasHeight - y,
  };
}

// 사각형 좌표의 Y축을 높이까지 고려해 WebGL 좌표계로 변환한다.
export function toWebglCoord2(
  x: number,
  y: number,
  w: number,
  h: number,
  canvasHeight: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x,
    y: canvasHeight - y - h,
    w,
    h,
  };
}

// 카메라 좌표를 화면 크기와 배율 기준의 WebGL 좌표로 변환한다.
export function toWebglCoord3(
  x: number,
  y: number,
  height: number,
  screenHeight: number,
  scale: number,
): { x: number; y: number } {
  let newY = -y + screenHeight / scale - height;
  return {
    x,
    y: newY,
  };
}
