import { describe, expect, it } from "vitest";
import { GestureMachine } from "./gestureMachine";

describe("GestureMachine", () => {
  it("그냥 드로잉", () => {
    const machine = new GestureMachine();

    expect(machine.currentState()).toBe("Ready");

    machine.input({ time: 0, type: "down", pointerId: 1, x: 10, y: 10 });
    expect(machine.currentState()).toBe("Draw");

    machine.input({ time: 20, type: "move", pointerId: 1, x: 20, y: 20 });
    expect(machine.currentState()).toBe("Draw");

    machine.input({ time: 40, type: "up", pointerId: 1, x: 20, y: 20 });
    expect(machine.currentState()).toBe("Ready");
  });

  it("핀치줌이 되기", () => {
    const machine = new GestureMachine();

    machine.input({ time: 0, type: "down", pointerId: 1, x: 100, y: 100 });
    expect(machine.currentState()).toBe("Draw");

    expect(machine.input({ time: 80, type: "down", pointerId: 2, x: 200, y: 100 })).toEqual([{ type: "cancel" }]);
    expect(machine.currentState()).toBe("Pinch");

    machine.input({ time: 100, type: "move", pointerId: 2, x: 220, y: 100 });
    expect(machine.currentState()).toBe("Pinch");
  });

  it("undo 발생", () => {
    const machine = new GestureMachine();

    machine.input({ time: 0, type: "down", pointerId: 1, x: 100, y: 100 });
    expect(machine.currentState()).toBe("Draw");

    expect(machine.input({ time: 50, type: "down", pointerId: 2, x: 200, y: 100 })).toEqual([{ type: "cancel" }]);
    expect(machine.currentState()).toBe("Pinch");

    machine.input({ time: 80, type: "move", pointerId: 2, x: 1200, y: 100 });
    expect(machine.currentState()).toBe("Pinch");

    machine.input({ time: 100, type: "up", pointerId: 1, x: 100, y: 100 });
    expect(machine.currentState()).toBe("PinchFinish");

    expect(machine.input({ time: 120, type: "up", pointerId: 2, x: 1200, y: 100 })).toEqual([{ type: "undo" }]);
    expect(machine.currentState()).toBe("Ready");
  });

  it("redo 발생", () => {
    const machine = new GestureMachine();

    machine.input({ time: 0, type: "down", pointerId: 1, x: 100, y: 100 });
    expect(machine.currentState()).toBe("Draw");

    expect(machine.input({ time: 40, type: "down", pointerId: 2, x: 200, y: 100 })).toEqual([{ type: "cancel" }]);
    expect(machine.currentState()).toBe("Pinch");

    machine.input({ time: 70, type: "down", pointerId: 3, x: 150, y: 200 });
    expect(machine.currentState()).toBe("PinchOver");

    machine.input({ time: 90, type: "move", pointerId: 3, x: 150, y: 1200 });
    expect(machine.currentState()).toBe("PinchOver");

    machine.input({ time: 100, type: "up", pointerId: 1, x: 100, y: 100 });
    expect(machine.currentState()).toBe("PinchFinish2");

    machine.input({ time: 120, type: "up", pointerId: 2, x: 200, y: 100 });
    expect(machine.currentState()).toBe("PinchFinish3");

    expect(machine.input({ time: 140, type: "up", pointerId: 3, x: 150, y: 1200 })).toEqual([{ type: "redo" }]);
    expect(machine.currentState()).toBe("Ready");
  });

  it("두 번째 down이 150ms를 넘으면 무시하고 Draw 유지", () => {
    const machine = new GestureMachine();

    machine.input({ time: 0, type: "down", pointerId: 1, x: 100, y: 100 });
    expect(machine.currentState()).toBe("Draw");

    machine.input({ time: 151, type: "down", pointerId: 2, x: 200, y: 100 });
    expect(machine.currentState()).toBe("Draw");
  });

  it("두 손가락 up 완료가 150ms를 넘으면 undo 없이 종료", () => {
    const machine = new GestureMachine();

    machine.input({ time: 0, type: "down", pointerId: 1, x: 100, y: 100 });
    expect(machine.currentState()).toBe("Draw");

    expect(machine.input({ time: 50, type: "down", pointerId: 2, x: 200, y: 100 })).toEqual([{ type: "cancel" }]);
    expect(machine.currentState()).toBe("Pinch");

    machine.input({ time: 100, type: "up", pointerId: 1, x: 100, y: 100 });
    expect(machine.currentState()).toBe("PinchFinish");

    machine.input({ time: 201, type: "up", pointerId: 2, x: 200, y: 100 });
    expect(machine.currentState()).toBe("Ready");
  });

  it("세 손가락 up 완료가 150ms를 넘으면 redo 없이 종료", () => {
    const machine = new GestureMachine();

    machine.input({ time: 0, type: "down", pointerId: 1, x: 100, y: 100 });
    expect(machine.currentState()).toBe("Draw");

    expect(machine.input({ time: 40, type: "down", pointerId: 2, x: 200, y: 100 })).toEqual([{ type: "cancel" }]);
    expect(machine.currentState()).toBe("Pinch");

    machine.input({ time: 70, type: "down", pointerId: 3, x: 150, y: 200 });
    expect(machine.currentState()).toBe("PinchOver");

    machine.input({ time: 100, type: "up", pointerId: 1, x: 100, y: 100 });
    expect(machine.currentState()).toBe("PinchFinish2");

    machine.input({ time: 120, type: "up", pointerId: 2, x: 200, y: 100 });
    expect(machine.currentState()).toBe("PinchFinish3");

    machine.input({ time: 221, type: "up", pointerId: 3, x: 150, y: 200 });
    expect(machine.currentState()).toBe("Ready");
  });
});
