/** position.ts */
import { els } from "./ui/elements";
import { getLayerWorker } from "./core/worker/workerPool";
import { makeAutoObservable } from "mobx";

export const MIN_SCALE = 0.125;
export let MAX_SCALE = 0;

export class PositionState {
  x = 10;
  y = 10;
  width = 10;
  height = 10;
  scale = 1;
  dpr = 3;
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
}

export const position = new PositionState();

export function updateBouncingRect() {
  console.log("updateBouncingRect");
  position.setBouncingRect(els.container.getBoundingClientRect());
}
export async function setCameraPosition() {
  const minW = -position.width;
  const maxW = position.bouncingRect.width / position.scale;
  const clampX = Math.min(maxW, Math.max(minW, position.x));

  const minH = -position.height;
  const maxH = position.bouncingRect.height / position.scale;
  const clampY = Math.min(maxH, Math.max(minH, position.y));

  position.setX(clampX);
  position.setY(clampY);

  const worker = getLayerWorker();
  const pxRatio = getPixelRatio();

  await worker.setCamaraPosition(
    position.x * pxRatio,
    position.y * pxRatio,
    position.scale,
  );
}

export async function resizeScreen() {
  const worker = getLayerWorker();
  const pxRatio = getPixelRatio();
  await worker.resizeScreenSize(
    position.bouncingRect.width * pxRatio,
    position.bouncingRect.height * pxRatio,
  );
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

  // 초기 위치 설정
  let percent = 2 / 3;
  let dpr = getPixelRatio();
  let scaledDpr = dpr * percent;
  let width, height;
  let scale = 1;
  
  if (position.bouncingRect.width > position.bouncingRect.height) {
    // 가로가 김
    width = position.bouncingRect.height * scaledDpr * 1.414;
    height = position.bouncingRect.height * scaledDpr;
  } else {
    // 세로가 김
    width = position.bouncingRect.width * scaledDpr;
    height = position.bouncingRect.width * scaledDpr * 1.414;
  }
  position.dpr = dpr;
  MAX_SCALE = 120 * dpr;

  // 초기 위치 설정
  let x = (position.bouncingRect.width - width / dpr) / 2;
  let y = (position.bouncingRect.height - height / dpr) / 2;


  width = 4096;
  height = 4096;
  scale = 4

  position.setScale(scale);
  position.setWidth(Math.floor(width));
  position.setHeight(Math.floor(height));
  position.setX(Math.floor(x));
  position.setY(Math.floor(y));
}

export function setMagification(new_scale, anchor_point) {
  // 확대 전 값을 따로 보관
  const old_scale = position.scale;
  const old_x = position.x;
  const old_y = position.y;

  // 배율만 미리 바꿔놓든, 나중에 바꾸든 상관없지만
  // old_scale를 반드시 먼저 따로 보관하고 써야 함
  position.setScale(new_scale);

  // 화면에서 anchor_point가 고정되려면,
  // (anchor + position)의 스크린 좌표가
  // old_scale 시절과 new_scale 시절이 같아야 함
  //
  // 즉,
  //   (anchor + oldPos) * old_scale  ==  (anchor + newPos) * new_scale
  //
  // 풀어서 새 newPos를 구하면 아래와 같은 공식이 됩니다.
  let newX =
    ((anchor_point.x + old_x) * old_scale) / new_scale - anchor_point.x;
  let newY =
    ((anchor_point.y + old_y) * old_scale) / new_scale - anchor_point.y;
  position.setX(newX);
  position.setY(newY);
}

// 캔버스 상의 좌표로 변환.
export function to_canvas_coord(x, y) {
  let p = to_screen_coord(x, y);
  let px = p.x * getPixelRatio();
  let py = p.y * getPixelRatio();

  return { x: px, y: py };
}

function to_world_coord(screenX, screenY) {
  let worldX =
    (screenX + position.x) * position.scale + position.bouncingRect.x;
  let worldY =
    (screenY + position.y) * position.scale + position.bouncingRect.y;
  return { x: worldX, y: worldY };
}
// 캔버스 픽셀 좌표 → 스크린 좌표로 역변환 함수
function canvas_coord_to_screen_coord(canvasX, canvasY) {
  let px = canvasX / getPixelRatio();
  let py = canvasY / getPixelRatio();
  return { x: px, y: py };
}

export function canvas_coord_to_css_coord({ x, y }) {
  const screen = canvas_coord_to_screen_coord(x, y);
  const world = to_world_coord(screen.x, screen.y);
  return world;
}

// 스크롤시의 좌표로 변환.
export function to_screen_coord(x, y) {
  let px = (x - position.bouncingRect.x) / position.scale - position.x;
  let py = (y - position.bouncingRect.y) / position.scale - position.y;
  return { x: px, y: py };
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
  position.setWidth(newWidth);
  position.setHeight(newHeight);

  const worker = getLayerWorker();

  await worker.resizeLayer(x, y, newWidth, newHeight);
  renderChangedPosition();
}

let dpr;
export function getPixelRatio() {
  if (!dpr) {
    dpr = window.devicePixelRatio;
  }
  return dpr;
}
