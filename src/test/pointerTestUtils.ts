import { paintState } from "@/app/paintState";
import { dispatch } from "../app/events/pointerEvents";
import { toolManager } from "@/app/draw";
import { uploadImage } from "@/app/file";

function createFakeEvent(x: number, y: number): PointerEvent {
  const event = new CustomEvent("pointer") as any;
  Object.defineProperties(event, {
    clientX: { value: x, writable: false },
    clientY: { value: y, writable: false },
    x: { value: x, writable: false },
    y: { value: y, writable: false },
    pressure: { value: 0.5, writable: false },
    button: { value: 0, writable: false },
    buttons: { value: 1, writable: false },
    pointerType: { value: "mouse", writable: false },
    pointerId: { value: 1, writable: false },
    isPrimary: { value: true, writable: false },
    preventDefault: { value: () => {}, writable: false },
    stopPropagation: { value: () => {}, writable: false },
  });
  return event as PointerEvent;
}

function pointerDown(x: number, y: number) {
  console.log(`🖱️ pointerDown(${x}, ${y})`);
  paintState.pointerdown = true;
  dispatch(createFakeEvent(x, y), "down");
}

function pointerMove(x: number, y: number) {
  console.log(`🖱️ pointerMove(${x}, ${y})`);
  dispatch(createFakeEvent(x, y), "move");
}

function pointerUp(x: number, y: number) {
  console.log(`🖱️ pointerUp(${x}, ${y})`);
  paintState.pointerdown = false;
  dispatch(createFakeEvent(x, y), "up");
}

export async function runPointerTests() {
  // Load cat_3k image as bitmap
  const response = await fetch("/cat_3k.jpg");
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob, {
    imageOrientation: "flipY",
    premultiplyAlpha: "premultiply",
  });

  uploadImage(bitmap);
  toolManager.setLiquifyTool();
  paintState.setBrushSize(2000);

  console.log("🧪 Running pointer tests...");

  setTimeout(() => {
    pointerDown(584, 685);
    pointerMove(561, 587);
    pointerUp(561, 587);

    pointerDown(561, 587);
    pointerMove(584, 685);
    pointerUp(584, 685);
  }, 3000);
}
