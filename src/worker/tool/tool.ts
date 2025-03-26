import { getLiquifyManager } from "./liquify";
import { getBrushManager } from "./brushTool";

interface Pointer {
  x: number;
  y: number;
}

interface Tool {
  enter(): void;
  start(pointer: Pointer): void;
  stroke(p1: Pointer, p2: Pointer): void;
  end(): void;
  cancel(): void;
  exit(): void;
}

export class BrushTool implements Tool {
  drawManager;
  async init(canvas, gl) {
    this.drawManager = getBrushManager(canvas, gl);
  }
  enter() {}
  start(pointer: Pointer) {}
  stroke(p1: Pointer, p2: Pointer) {
    this.drawManager.stroke(p1, p2);
    this.drawManager.brush();
  }
  end() {
    this.drawManager.end();
  }
  cancel() {
    this.drawManager.cancel();
  }
  exit() {}
}

export class EraserTool implements Tool {
  drawManager;
  async init(canvas, gl) {
    this.drawManager = getBrushManager(canvas, gl);
  }
  enter() {}
  start(pointer: Pointer) {}
  stroke(p1: Pointer, p2: Pointer) {
    this.drawManager.stroke(p1, p2);
    this.drawManager.eraser();
  }
  end() {
    this.drawManager.end();
  }
  cancel() {
    this.drawManager.cancel();
  }
  exit() {}
}

export class LiquifyTool implements Tool {
  liquifyManager;
  async init(canvas, gl) {
    this.liquifyManager = await getLiquifyManager(canvas, gl);
  }
  enter() {}
  start(pointer: Pointer) {
    this.liquifyManager.start(pointer);
  }
  stroke(p1: Pointer, p2: Pointer) {
    this.liquifyManager.push(p1, p2);
    this.liquifyManager.render();
  }
  end() {
    this.liquifyManager.end();
  }
  cancel() {
    this.liquifyManager.cancel();
  }
  exit() {
    this.liquifyManager.exit();
  }
}
