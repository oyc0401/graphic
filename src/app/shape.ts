import type { ShapeKind } from "@/core/types";
import { makeAutoObservable } from "mobx";
import { paintState, ShapeId } from "./paintState";
import { getLayerWorker } from "./worker/workerPool";

type ShapeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export class ShapeState {
  kind: ShapeId | null = null;
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  visible = false;
  showHint = false;
  showHandle = false;
  active = false;
  hover = "";

  constructor() {
    makeAutoObservable(this);
  }

  setKind(kind: ShapeId | null) {
    this.kind = kind;
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

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  setRect(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  setVisible(visible: boolean) {
    this.visible = visible;
  }

  setShowHint(value: boolean) {
    this.showHint = value;
  }

  setShowHandle(value: boolean) {
    this.showHandle = value;
  }

  setHover(value: string) {
    this.hover = value;
  }
}

export const shape = new ShapeState();

export let beforeShapePos: ShapeRect = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
};

export function createShape(
  kind: ShapeId,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (paintState.getSessionId() !== null) return;

  shape.setKind(kind);
  shape.setRect(x, y, width, height);
  shape.setVisible(true);
  shape.setShowHint(true);
  shape.setShowHandle(true);
  shape.active = false;

  beforeShapePos = { x, y, width, height };
}

export function applyShape() {
  if (shape.visible) {
    getLayerWorker().applyShape();
  }

  hideShape();
}

export function discardShape() {
  if (shape.visible || shape.showHint) {
    getLayerWorker().discardShape();
  }

  hideShape();
}

export function shapeCancel() {
  if (paintState.getPointerdown()) {
    if (shape.active && shape.visible) {
      shape.setRect(
        beforeShapePos.x,
        beforeShapePos.y,
        beforeShapePos.width,
        beforeShapePos.height,
      );
      getLayerWorker().transformShape(
        shape.x,
        shape.y,
        shape.width,
        shape.height,
      );
    } else if (!shape.visible) {
      discardShape();
    }
    shape.active = false;
    return;
  }

  discardShape();
}

export function toCoreShapeKind(shapeId: ShapeId): ShapeKind {
  return shapeId;
}

function hideShape() {
  shape.setKind(null);
  shape.setVisible(false);
  shape.setShowHint(false);
  shape.setShowHandle(false);
  shape.active = false;
  shape.setHover("default");
}
