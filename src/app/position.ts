/** position.ts */
import { els } from "./ui/elements";
import { getLayerWorker } from "./worker/workerPool";
import { makeAutoObservable } from "mobx";
import {
  clampOffset,
  clientToScene,
  fitDocument,
  zoomAround,
  type Camera,
  type Viewport,
} from "./utils/cameraMath";

export const MIN_SCALE = 0.125;
export let MAX_SCALE = 0;

export class PositionState {
  x = 10;
  y = 10;
  width = 10;
  height = 10;
  scale = 1;
  bouncingRect = { x: 0, y: 0, width: 0, height: 0 };

  bottomNavHeight = 0;

  setBouncingRect(rect) {
    this.bouncingRect = rect;
  }

  constructor() {
    makeAutoObservable(this);
  }

  setX(x: number) {
    this.x = x;
  }

  setY(y: number) {
    this.y = y;
  }

  setWidth(width: number) {
    this.width = width;
  }

  setHeight(height: number) {
    this.height = height;
  }

  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  setScale(scale: number) {
    this.scale = scale;
  }

  get screenWidth() {
    return this.bouncingRect.width * getPixelRatio();
  }

  get screenHeight() {
    return this.bouncingRect.height * getPixelRatio();
  }
}

export const position = new PositionState();

// cameraMath에 넘길 현재 카메라/뷰포트 스냅샷 (DI 경계)
export function getCamera(): Camera {
  return { x: position.x, y: position.y, scale: position.scale };
}

export function getViewport(): Viewport {
  return { dpr: getPixelRatio(), rect: position.bouncingRect };
}

export function updateBouncingRect() {
  console.log("updateBouncingRect");
  position.setBouncingRect(els.container.getBoundingClientRect());
}
export async function setCameraPosition() {
  const clamped = clampOffset(
    getCamera(),
    { width: position.width, height: position.height },
    getViewport(),
  );
  position.setX(clamped.x);
  position.setY(clamped.y);

  const worker = getLayerWorker();
  await worker.setCameraPosition(position.x, position.y, position.scale);
}

export async function resizeScreen() {
  const worker = getLayerWorker();
  await worker.resizeScreenSize(position.screenWidth, position.screenHeight);
}

export function render() {
  const worker = getLayerWorker();
  worker.render();
}

export async function renderChangedPosition() {
  setCameraPosition();
  render();
}

export function setDefaultPosition() {
  updateBouncingRect();

  MAX_SCALE = 120 * getPixelRatio();

  const { doc, camera } = fitDocument(getViewport());
  position.setScale(camera.scale);
  position.setWidth(doc.width);
  position.setHeight(doc.height);
  position.setX(camera.x);
  position.setY(camera.y);
}

export function setMagification(new_scale, anchor_point) {
  const next = zoomAround(getCamera(), anchor_point, new_scale);
  position.setScale(next.scale);
  position.setX(next.x);
  position.setY(next.y);
}

// 캔버스 상의 좌표로 변환.
export function to_canvas_coord(x, y) {
  let p = to_screen_coord(x, y);
  let px = p.x;
  let py = p.y;

  return { x: px, y: py };
}

// 스크롤시의 좌표로 변환.
export function to_screen_coord(x, y) {
  return clientToScene(x, y, getCamera(), getViewport());
}

export function to_pixel_canvas_coord(x, y) {
  let point = to_canvas_coord(x, y);
  return {
    x: Math.floor(point.x),
    y: Math.floor(point.y),
  };
}
export function to_pixel_canvas_coord_round(x, y) {
  let point = to_canvas_coord(x, y);
  return {
    x: Math.round(point.x),
    y: Math.round(point.y),
  };
}

export async function changeCanvasSize(x, y, newWidth, newHeight) {
  position.setX(position.x + x);
  position.setY(position.y + y);

  position.setWidth(newWidth);
  position.setHeight(newHeight);

  const worker = getLayerWorker();

  worker.resizeLayer(x, y, newWidth, newHeight);
  //renderChangedPosition();
}

let dpr;
export function getPixelRatio() {
  if (!dpr) {
    dpr = window.devicePixelRatio;
  }
  return dpr;
}
