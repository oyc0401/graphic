import { GestureModule } from "./index";

const viewport = document.querySelector<HTMLElement>("#viewport")!;
const scene = document.querySelector<HTMLElement>("#scene")!;

interface GestureModule {
  element: Element;

  onPointerdown: (event) => void;
  onPointermove: (event) => void;
  onPointerup: (event) => void;
  onPointercancel: (event) => void;

  sceneChanged: (x, y, scale) => void;
  onPinchStart: () => void;
  onPinchEnd: () => void;

  onTwoFingerDoubleTap: () => void;
  onThreeFingerDoubleTap: () => void;
}

const gesture = new GestureModule({
  element: viewport,
  position: {
    x: 80,
    y: 70,
    scale: 1,
  },
  minScale: 0.25,
  maxScale: 5,

  onPointerdown: (event) => {
    console.log("pointerdown", event.pointerId);
  },

  onPointermove: (event) => {
    console.log("pointermove", event.pointerId);
  },

  onPointerup: (event) => {
    console.log("pointerup", event.pointerId);
  },

  onPointercancel: (event) => {
    console.log("app pointercancel", event.pointerId);
  },

  sceneChanged: (x, y, scale) => {
    scene.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  },

  onPinchStart: () => {
    console.log("pinchStart");
  },

  onPinchEnd: () => {
    console.log("pinchEnd");
  },

  onTwoFingerTap: () => {
    console.log("onTwoFingerTap");
  },

  onThreeFingerTap: () => {
    console.log("onThreeFingerTap");
  },

  onTwoFingerDoubleTap: () => {
    console.log("onTwoFingerDoubleTap");
  },

  onThreeFingerDoubleTap: () => {
    console.log("onThreeFingerDoubleTap");
  },
});

gesture.setPosition({
  x: 80,
  y: 70,
  scale: 1,
});
