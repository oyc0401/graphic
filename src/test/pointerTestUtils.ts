import { paintState } from "@/app/paintState";
import { dispatch } from "../app/events/pointerEvents";

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

export function runPointerTests() {
  console.log("🧪 Running pointer tests...");

  pointerDown(584.09765625, 685.30859375);
  pointerMove(579.3046875, 686.796875);
  pointerMove(566.98828125, 685.39453125);
  pointerMove(538.55859375, 673.07421875);
  pointerMove(494.55078125, 646.08984375);
  pointerMove(467.125, 614.92578125);
  pointerMove(464.84375, 580.56640625);
  pointerMove(481.59765625, 535.91796875);
  pointerMove(515.73828125, 504.7109375);
  pointerMove(577.37109375, 489.99609375);
  pointerMove(637.54296875, 498.19140625);
  pointerMove(672.29296875, 522.9140625);
  pointerMove(683.953125, 560.24609375);
  pointerMove(657.390625, 599.6640625);
  pointerMove(605.984375, 620.859375);
  pointerMove(571.27734375, 622.03125);
  pointerMove(557.98828125, 614.50390625);
  pointerMove(554.6171875, 602.89453125);
  pointerMove(556.734375, 593.80078125);
  pointerMove(561.2734375, 587.80859375);
  pointerUp(561.95703125, 587.578125);
}
