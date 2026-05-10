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

    machine.input({ time: 170, type: "up", pointerId: 2, x: 200, y: 100 });
    expect(machine.currentState()).toBe("Draw");

    machine.input({ time: 180, type: "up", pointerId: 1, x: 100, y: 100 });
    expect(machine.currentState()).toBe("Ready");
  });

  it("Pinch에서 세 번째 down이 150ms를 넘으면 무시하고 Pinch 유지", () => {
    const machine = new GestureMachine();

    machine.input({ time: 0, type: "down", pointerId: 1, x: 100, y: 100 });
    expect(machine.currentState()).toBe("Draw");

    expect(machine.input({ time: 40, type: "down", pointerId: 2, x: 200, y: 100 })).toEqual([{ type: "cancel" }]);
    expect(machine.currentState()).toBe("Pinch");

    machine.input({ time: 191, type: "down", pointerId: 3, x: 150, y: 200 });
    expect(machine.currentState()).toBe("Pinch");

    machine.input({ time: 210, type: "up", pointerId: 3, x: 150, y: 200 });
    expect(machine.currentState()).toBe("Pinch");
  });

  it("두 손가락 up 완료가 150ms를 넘으면 undo 없이 종료", () => {
    const machine = new GestureMachine();

    machine.input({ time: 0, type: "down", pointerId: 1, x: 100, y: 100 });
    expect(machine.currentState()).toBe("Draw");

    expect(machine.input({ time: 50, type: "down", pointerId: 2, x: 200, y: 100 })).toEqual([{ type: "cancel" }]);
    expect(machine.currentState()).toBe("Pinch");

    machine.input({ time: 100, type: "up", pointerId: 1, x: 100, y: 100 });
    expect(machine.currentState()).toBe("PinchFinish");

    // CheckUndo 다음은 d <= 150 여부와 관계없이 종료된다.
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

    // CheckRedo 다음은 d <= 150 여부와 관계없이 종료된다.
    machine.input({ time: 221, type: "up", pointerId: 3, x: 150, y: 200 });
    expect(machine.currentState()).toBe("Ready");
  });
});

describe("GestureMachine 무시 이벤트들", () => {
  it("Ready에서 down이 아닌 입력은 무시", () => {
    const machine = new GestureMachine();

    expect(machine.currentState()).toBe("Ready");

    expect(machine.input({ time: 0, type: "move", pointerId: 1, x: 100, y: 100 })).toEqual([]);
    expect(machine.currentState()).toBe("Ready");

    expect(machine.input({ time: 10, type: "up", pointerId: 1, x: 100, y: 100 })).toEqual([]);
    expect(machine.currentState()).toBe("Ready");
  });

  it("Draw에서 move는 이벤트 없이 Draw 유지", () => {
    const machine = new GestureMachine();

    machine.input({ time: 0, type: "down", pointerId: 1, x: 100, y: 100 });
    expect(machine.currentState()).toBe("Draw");

    expect(machine.input({ time: 20, type: "move", pointerId: 1, x: 200, y: 200 })).toEqual([]);
    expect(machine.currentState()).toBe("Draw");
  });

  it("Pinch에서 move는 이벤트 없이 Pinch 유지", () => {
    const machine = new GestureMachine();

    machine.input({ time: 0, type: "down", pointerId: 1, x: 100, y: 100 });
    machine.input({ time: 80, type: "down", pointerId: 2, x: 200, y: 100 });
    expect(machine.currentState()).toBe("Pinch");

    expect(machine.input({ time: 100, type: "move", pointerId: 2, x: 220, y: 100 })).toEqual([]);
    expect(machine.currentState()).toBe("Pinch");
  });

  it("PinchFinish에서 up이 아닌 입력은 무시", () => {
    const machine = new GestureMachine();

    machine.input({ time: 0, type: "down", pointerId: 1, x: 100, y: 100 });
    machine.input({ time: 80, type: "down", pointerId: 2, x: 200, y: 100 });
    machine.input({ time: 100, type: "up", pointerId: 1, x: 100, y: 100 });
    expect(machine.currentState()).toBe("PinchFinish");

    expect(machine.input({ time: 110, type: "move", pointerId: 2, x: 220, y: 100 })).toEqual([]);
    expect(machine.currentState()).toBe("PinchFinish");
  });

  it("PinchOver에서 up이 아닌 입력은 무시", () => {
    const machine = new GestureMachine();

    machine.input({ time: 0, type: "down", pointerId: 1, x: 100, y: 100 });
    machine.input({ time: 40, type: "down", pointerId: 2, x: 200, y: 100 });
    machine.input({ time: 70, type: "down", pointerId: 3, x: 150, y: 200 });
    expect(machine.currentState()).toBe("PinchOver");

    expect(machine.input({ time: 90, type: "move", pointerId: 3, x: 150, y: 1200 })).toEqual([]);
    expect(machine.currentState()).toBe("PinchOver");
  });

  it("PinchFinish2에서 up이 아닌 입력은 무시", () => {
    const machine = new GestureMachine();

    machine.input({ time: 0, type: "down", pointerId: 1, x: 100, y: 100 });
    machine.input({ time: 40, type: "down", pointerId: 2, x: 200, y: 100 });
    machine.input({ time: 70, type: "down", pointerId: 3, x: 150, y: 200 });
    machine.input({ time: 100, type: "up", pointerId: 1, x: 100, y: 100 });
    expect(machine.currentState()).toBe("PinchFinish2");

    expect(machine.input({ time: 110, type: "move", pointerId: 2, x: 220, y: 100 })).toEqual([]);
    expect(machine.currentState()).toBe("PinchFinish2");
  });

  it("PinchFinish3에서 up이 아닌 입력은 무시", () => {
    const machine = new GestureMachine();

    machine.input({ time: 0, type: "down", pointerId: 1, x: 100, y: 100 });
    machine.input({ time: 40, type: "down", pointerId: 2, x: 200, y: 100 });
    machine.input({ time: 70, type: "down", pointerId: 3, x: 150, y: 200 });
    machine.input({ time: 100, type: "up", pointerId: 1, x: 100, y: 100 });
    machine.input({ time: 120, type: "up", pointerId: 2, x: 200, y: 100 });
    expect(machine.currentState()).toBe("PinchFinish3");

    expect(machine.input({ time: 130, type: "move", pointerId: 3, x: 150, y: 1200 })).toEqual([]);
    expect(machine.currentState()).toBe("PinchFinish3");
  });
});

describe("GestureMachine cancel 입력", () => {
  it("Ready에서 cancel은 무시", () => {
    const machine = new GestureMachine();

    expect(machine.input({ time: 0, type: "cancel", pointerId: 1, x: 100, y: 100 })).toEqual([]);
    expect(machine.currentState()).toBe("Ready");
  });

  it("Draw에서 cancel은 이벤트 없이 Ready로 이동", () => {
    const machine = new GestureMachine();

    machine.input({ time: 0, type: "down", pointerId: 1, x: 100, y: 100 });
    expect(machine.currentState()).toBe("Draw");

    expect(machine.input({ time: 10, type: "cancel", pointerId: 1, x: 100, y: 100 })).toEqual([]);
    expect(machine.currentState()).toBe("Ready");
  });

  it("Pinch에서 cancel은 up처럼 PinchFinish로 이동", () => {
    const machine = new GestureMachine();

    machine.input({ time: 0, type: "down", pointerId: 1, x: 100, y: 100 });
    machine.input({ time: 80, type: "down", pointerId: 2, x: 200, y: 100 });
    expect(machine.currentState()).toBe("Pinch");

    expect(machine.input({ time: 100, type: "cancel", pointerId: 2, x: 200, y: 100 })).toEqual([]);
    expect(machine.currentState()).toBe("PinchFinish");
  });

  it("PinchFinish에서 cancel은 undo 없이 Ready로 이동", () => {
    const machine = new GestureMachine();

    machine.input({ time: 0, type: "down", pointerId: 1, x: 100, y: 100 });
    machine.input({ time: 80, type: "down", pointerId: 2, x: 200, y: 100 });
    machine.input({ time: 100, type: "up", pointerId: 1, x: 100, y: 100 });
    expect(machine.currentState()).toBe("PinchFinish");

    expect(machine.input({ time: 110, type: "cancel", pointerId: 2, x: 200, y: 100 })).toEqual([]);
    expect(machine.currentState()).toBe("Ready");
  });

  it("PinchOver에서 cancel은 up처럼 PinchFinish2로 이동", () => {
    const machine = new GestureMachine();

    machine.input({ time: 0, type: "down", pointerId: 1, x: 100, y: 100 });
    machine.input({ time: 40, type: "down", pointerId: 2, x: 200, y: 100 });
    machine.input({ time: 70, type: "down", pointerId: 3, x: 150, y: 200 });
    expect(machine.currentState()).toBe("PinchOver");

    expect(machine.input({ time: 90, type: "cancel", pointerId: 3, x: 150, y: 200 })).toEqual([]);
    expect(machine.currentState()).toBe("PinchFinish2");
  });

  it("PinchFinish2에서 cancel은 up처럼 PinchFinish3로 이동", () => {
    const machine = new GestureMachine();

    machine.input({ time: 0, type: "down", pointerId: 1, x: 100, y: 100 });
    machine.input({ time: 40, type: "down", pointerId: 2, x: 200, y: 100 });
    machine.input({ time: 70, type: "down", pointerId: 3, x: 150, y: 200 });
    machine.input({ time: 100, type: "up", pointerId: 1, x: 100, y: 100 });
    expect(machine.currentState()).toBe("PinchFinish2");

    expect(machine.input({ time: 110, type: "cancel", pointerId: 2, x: 200, y: 100 })).toEqual([]);
    expect(machine.currentState()).toBe("PinchFinish3");
  });

  it("PinchFinish3에서 cancel은 redo 없이 Ready로 이동", () => {
    const machine = new GestureMachine();

    machine.input({ time: 0, type: "down", pointerId: 1, x: 100, y: 100 });
    machine.input({ time: 40, type: "down", pointerId: 2, x: 200, y: 100 });
    machine.input({ time: 70, type: "down", pointerId: 3, x: 150, y: 200 });
    machine.input({ time: 100, type: "up", pointerId: 1, x: 100, y: 100 });
    machine.input({ time: 120, type: "up", pointerId: 2, x: 200, y: 100 });
    expect(machine.currentState()).toBe("PinchFinish3");

    expect(machine.input({ time: 130, type: "cancel", pointerId: 3, x: 150, y: 200 })).toEqual([]);
    expect(machine.currentState()).toBe("Ready");
  });
});
