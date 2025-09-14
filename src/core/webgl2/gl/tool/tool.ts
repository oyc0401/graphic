import { getLiquifyManager, installLiquifyManager } from "./liquify/liquify";
import { getBrushManager } from "./brush/brushTool";
import { setDrawingFlag } from "../history/workQueue";

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

export async function installTools(canvas, gl) {
  await installLiquifyManager(canvas, gl);
  console.log("Tool Installed");
}

export class BrushTool implements Tool {
  drawManager;

  constructor(canvas, gl) {
    this.drawManager = getBrushManager(canvas, gl);
  }
  enter() {
    // console.log("brush enter");
    this.drawManager.enter();
  }
  start(pointer: Pointer) {
    setDrawingFlag(true);
    this.drawManager.start(pointer);
  }
  stroke(p1: Pointer, p2: Pointer) {
    this.drawManager.stroke(p1, p2);
    this.drawManager.brush();
  }
  end() {
    //console.log("brush end");
    this.drawManager.end("brush");
  }
  cancel() {
    setDrawingFlag(false);
    this.drawManager.cancel();
  }
  exit() {
    // console.log("brush exit");
  }
}

export class EraserTool implements Tool {
  drawManager;
  constructor(canvas, gl) {
    this.drawManager = getBrushManager(canvas, gl);
  }
  enter() {
    this.drawManager.enter();
  }
  start(pointer: Pointer) {
    this.drawManager.start(pointer);
  }
  stroke(p1: Pointer, p2: Pointer) {
    this.drawManager.stroke(p1, p2);
    this.drawManager.eraser();
  }
  end() {
    this.drawManager.end("eraser");
  }
  cancel() {
    this.drawManager.cancel();
  }
  exit() {}
}

export class LiquifyTool implements Tool {
  liquifyManager;
  constructor(canvas, gl) {
    this.liquifyManager = getLiquifyManager(canvas, gl);
  }
  enter() {
    //console.log("liquify enter");
    this.liquifyManager.enter();
  }
  start(pointer: Pointer) {
    // console.log("liquify start");
    this.liquifyManager.start(pointer);
  }
  stroke(p1: Pointer, p2: Pointer) {
    this.liquifyManager.push(p1, p2);
    this.liquifyManager.render();
  }
  end() {
    //console.log("liquify end");
    this.liquifyManager.end();
  }
  cancel() {
    this.liquifyManager.cancel();
  }
  exit() {
    //console.log("liquify exit");
    this.liquifyManager.exit();
  }
}
