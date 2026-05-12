import type { Pointer } from "../types";

// 화면에서 받은 한 점의 위치를 이미지 처리 내부 좌표로 바꾼다.
export function toWebglCoord(pointer: Pointer, canvasHeight: number): { x: number; y: number } {
  let { x, y } = pointer;
  return {
    x,
    y: canvasHeight - y,
  };
}

// 화면에서 받은 사각형 영역을 이미지 처리 내부 좌표로 바꾼다.
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

// 화면 이동 위치를 확대 비율이 적용된 내부 카메라 위치로 바꾼다.
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
