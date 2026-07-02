export type GesturePosition = {
  x: number;
  y: number;
  scale: number;
};

export type GestureModuleOptions = {
  element: HTMLElement;
  // 카메라의 단일 진실원천은 외부(app position)다.
  // 제스처 시작 시점마다 live 값을 읽어오는 DI 콜백.
  getPosition: () => GesturePosition;
  minScale: number;
  maxScale: number;
  onPointerdown: (event: PointerEvent) => void;
  onPointermove: (event: PointerEvent) => void;
  onPointerup: (event: PointerEvent) => void;
  onPointercancel: (event: PointerEvent) => void;
  sceneChanged: (x: number, y: number, scale: number) => void;
  onPinchStart: () => void;
  onPinchEnd: () => void;
  onTwoFingerTap: () => void;
  onThreeFingerTap: () => void;
  onTwoFingerDoubleTap: () => void;
  onThreeFingerDoubleTap: () => void;
};

type GestureState =
  | "Ready"
  | "Draw"
  | "Pinch"
  | "ThreeFinger"
  | "CanceledThreeFinger";

type TrackedPointer = {
  pointerId: number;
  index: number;
  clientX: number;
  clientY: number;
  pointerType: string;
  isPrimary: boolean;
};

const PINCH_START_MS = 150;
const UNDO_TAP_MS = 150;
const REDO_TAP_MS = 200;
const DOUBLE_TAP_MS = 200;

export class GestureModule {
  private readonly element: HTMLElement;
  private readonly options: GestureModuleOptions;
  private readonly minScale: number;
  private readonly maxScale: number;
  private position: GesturePosition;
  private state: GestureState = "Ready";
  private pointerIndexCounter = 0;
  private pointerdownTime = 0;
  private lastPinchDistance = 0;
  private lastPinchCenter = { x: 0, y: 0 };
  private lastTwoFingerTapTime: number | null = null;
  private lastThreeFingerTapTime: number | null = null;
  private readonly pointers = new Map<number, TrackedPointer>();
  private readonly blockedPointerIds = new Set<number>();

  constructor(options: GestureModuleOptions) {
    this.element = options.element;
    this.options = options;
    this.minScale = options.minScale;
    this.maxScale = options.maxScale;
    this.position = { ...options.getPosition() };

    window.addEventListener("pointerdown", this.handlePointerdown, true);
    window.addEventListener("pointermove", this.handlePointermove, true);
    window.addEventListener("pointerup", this.handlePointerup, true);
    window.addEventListener("pointercancel", this.handlePointercancel, true);

    this.element.addEventListener("pointerdown", this.handleBubblePointerdown);
    window.addEventListener("pointermove", this.handleBubblePointermove);
    window.addEventListener("pointerup", this.handleBubblePointerup);
    window.addEventListener("pointercancel", this.handleBubblePointercancel);
  }

  destroy() {
    window.removeEventListener("pointerdown", this.handlePointerdown, true);
    window.removeEventListener("pointermove", this.handlePointermove, true);
    window.removeEventListener("pointerup", this.handlePointerup, true);
    window.removeEventListener("pointercancel", this.handlePointercancel, true);

    this.element.removeEventListener("pointerdown", this.handleBubblePointerdown);
    window.removeEventListener("pointermove", this.handleBubblePointermove);
    window.removeEventListener("pointerup", this.handleBubblePointerup);
    window.removeEventListener("pointercancel", this.handleBubblePointercancel);
    this.pointers.clear();
    this.blockedPointerIds.clear();
  }

  private handlePointerdown = (event: PointerEvent) => {
    if (!this.shouldHandlePointerdown(event)) return;

    if (this.isBlockedPointerId(event.pointerId)) {
      this.blockPointerEvent(event);
      return;
    }

    const now = performance.now();

    switch (this.state) {
      case "Ready":
        this.addPointer(event);
        this.pointerdownTime = now;
        this.state = "Draw";
        return;

      case "Draw": {
        event.preventDefault();
        const firstPointer = this.getPointers()[0];
        const elapsed = now - this.pointerdownTime;

        if (elapsed <= PINCH_START_MS) {
          if (firstPointer) {
            this.options.onPointercancel(this.createSyntheticPointerEvent(
              "pointercancel",
              firstPointer,
              event,
            ));
          }
        } else if (firstPointer) {
          this.options.onPointerup(this.createSyntheticPointerEvent(
            "pointerup",
            firstPointer,
            event,
          ));
        }

        this.enterPinch(event, now);
        return;
      }

      case "Pinch": {
        event.preventDefault();
        const elapsed = now - this.pointerdownTime;

        this.blockPointerEvent(event);
        this.addPointer(event);
        this.pointerdownTime = now;
        this.state = elapsed <= PINCH_START_MS
          ? "ThreeFinger"
          : "CanceledThreeFinger";
        return;
      }

      case "ThreeFinger":
        this.blockPointerEvent(event);
        this.addPointer(event);
        this.pointerdownTime = now;
        return;

      case "CanceledThreeFinger":
        this.blockPointerEvent(event);
        this.addPointer(event);
        return;
    }
  };

  private handlePointermove = (event: PointerEvent) => {
    if (this.isBlockedPointerId(event.pointerId)) {
      this.blockPointerEvent(event);
    }

    if (!this.hasPointer(event.pointerId)) {
      if (this.state === "Draw" && this.isPointerInsideElement(event)) {
        const now = performance.now();
        const firstPointer = this.getPointers()[0];
        const elapsed = now - this.pointerdownTime;

        if (elapsed <= PINCH_START_MS) {
          if (firstPointer) {
            this.options.onPointercancel(this.createSyntheticPointerEvent(
              "pointercancel",
              firstPointer,
              event,
            ));
          }
        } else if (firstPointer) {
          this.options.onPointerup(this.createSyntheticPointerEvent(
            "pointerup",
            firstPointer,
            event,
          ));
        }

        this.enterPinch(event, now);
      }
      return;
    }

    event.preventDefault();
    this.updatePointer(event);

    if (this.state === "Draw") return;

    if (
      this.state === "Pinch" ||
      this.state === "ThreeFinger" ||
      this.state === "CanceledThreeFinger"
    ) {
      const pointers = this.getPointers();
      if (pointers.length < 2) return;
      this.updatePinch(pointers[0], pointers[1]);
    }
  };

  private handlePointerup = (event: PointerEvent) => {
    if (this.isBlockedPointerId(event.pointerId)) {
      this.blockPointerEvent(event);
    }
    this.blockedPointerIds.delete(event.pointerId);

    const now = performance.now();

    if (this.state === "Draw") {
      return;
    }

    const wasTracked = this.endPointer(event);
    if (!wasTracked) return;

    this.finishPointerGesture(event, now);
  };

  private handlePointercancel = (event: PointerEvent) => {
    if (this.isBlockedPointerId(event.pointerId)) {
      this.blockPointerEvent(event);
    }
    this.blockedPointerIds.delete(event.pointerId);

    if (this.state === "Draw") {
      return;
    }

    const wasTracked = this.endPointer(event);
    if (!wasTracked) return;

    switch (this.state) {
      case "Ready":
        return;
      case "Pinch":
        this.finishGesture();
        return;
      case "ThreeFinger":
        if (this.pointers.size === 0) {
          this.finishGesture();
        } else {
          this.state = "CanceledThreeFinger";
        }
        return;
      case "CanceledThreeFinger":
        if (this.pointers.size === 0) {
          this.finishGesture();
        }
        return;
    }
  };

  private handleBubblePointerdown = (event: PointerEvent) => {
    if (this.state !== "Draw" || !this.hasPointer(event.pointerId)) return;
    this.options.onPointerdown(event);
  };

  private handleBubblePointermove = (event: PointerEvent) => {
    if (this.state !== "Draw" || !this.hasPointer(event.pointerId)) return;
    this.options.onPointermove(event);
  };

  private handleBubblePointerup = (event: PointerEvent) => {
    if (this.state !== "Draw" || !this.hasPointer(event.pointerId)) return;
    this.options.onPointerup(event);
    this.endPointer(event);
    this.finishGesture();
  };

  private handleBubblePointercancel = (event: PointerEvent) => {
    if (this.state !== "Draw" || !this.hasPointer(event.pointerId)) return;
    this.options.onPointercancel(event);
    this.endPointer(event);
    this.finishGesture();
  };

  private shouldHandlePointerdown(event: PointerEvent) {
    return this.state !== "Ready" || this.isPointerInsideElement(event);
  }

  private isPointerInsideElement(event: PointerEvent) {
    const target = event.target;
    return target instanceof Node && this.element.contains(target);
  }

  private addPointer(event: PointerEvent) {
    if (this.pointers.has(event.pointerId)) return;

    this.pointers.set(event.pointerId, {
      pointerId: event.pointerId,
      index: this.pointerIndexCounter,
      clientX: event.clientX,
      clientY: event.clientY,
      pointerType: event.pointerType,
      isPrimary: event.isPrimary,
    });
    this.pointerIndexCounter++;
  }

  private endPointer(event: PointerEvent) {
    if (!this.pointers.has(event.pointerId)) return false;
    this.pointers.delete(event.pointerId);
    return true;
  }

  private updatePointer(event: PointerEvent) {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) return;

    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
  }

  private getPointers() {
    return Array.from(this.pointers.values()).sort((a, b) => a.index - b.index);
  }

  private hasPointer(pointerId: number) {
    return this.pointers.has(pointerId);
  }

  private blockPointerEvent(event: PointerEvent) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!this.hasPointer(event.pointerId)) {
      this.blockedPointerIds.add(event.pointerId);
    }
  }

  private isBlockedPointerId(pointerId: number) {
    return this.blockedPointerIds.has(pointerId);
  }

  private enterPinch(event: PointerEvent, now: number) {
    this.blockPointerEvent(event);
    this.addPointer(event);

    const pointers = this.getPointers();
    if (pointers.length < 2) return;

    this.pointerdownTime = now;
    this.startPinch(pointers[0], pointers[1]);
    this.state = "Pinch";
  }

  private startPinch(firstPointer: TrackedPointer, secondPointer: TrackedPointer) {
    // 핀치 세션의 기준 카메라는 시작 시점의 live 값이다.
    // (휠/돋보기 등 외부 변경 후에도 stale 사본으로 튀지 않도록)
    this.position = { ...this.options.getPosition() };
    this.blockedPointerIds.add(firstPointer.pointerId);
    this.blockedPointerIds.add(secondPointer.pointerId);
    this.lastPinchCenter = this.averagePointers(firstPointer, secondPointer);
    this.lastPinchDistance = this.getDistance(firstPointer, secondPointer);
    this.options.onPinchStart();
  }

  private updatePinch(firstPointer: TrackedPointer, secondPointer: TrackedPointer) {
    const pinchCenter = this.averagePointers(firstPointer, secondPointer);
    const dx = pinchCenter.x - this.lastPinchCenter.x;
    const dy = pinchCenter.y - this.lastPinchCenter.y;

    const distance = this.getDistance(firstPointer, secondPointer);
    const scaleFactor = this.lastPinchDistance === 0
      ? 1
      : distance / this.lastPinchDistance;
    const nextScale = this.clampScale(this.position.scale * scaleFactor);

    this.position.x += dx;
    this.position.y += dy;
    this.zoomAtClientPoint(nextScale, pinchCenter);

    this.lastPinchCenter = pinchCenter;
    this.lastPinchDistance = distance;
    this.options.sceneChanged(
      this.position.x,
      this.position.y,
      this.position.scale,
    );
  }

  private finishPointerGesture(event: PointerEvent, now: number) {
    event.preventDefault();

    switch (this.state) {
      case "Ready":
        return;
      case "Pinch": {
        if (this.pointers.size > 0) return;

        const shouldResolveTap = now - this.pointerdownTime <= UNDO_TAP_MS;
        this.finishGesture();
        if (shouldResolveTap) {
          this.resolveTwoFingerTap(now);
        }
        return;
      }
      case "ThreeFinger": {
        if (this.pointers.size > 0) return;

        const shouldResolveTap = now - this.pointerdownTime <= REDO_TAP_MS;
        this.finishGesture();
        if (shouldResolveTap) {
          this.resolveThreeFingerTap(now);
        }
        return;
      }
      case "CanceledThreeFinger":
        if (this.pointers.size === 0) {
          this.finishGesture();
        }
        return;
      case "Draw":
        return;
    }
  }

  private finishGesture() {
    if (
      this.state === "Pinch" ||
      this.state === "ThreeFinger" ||
      this.state === "CanceledThreeFinger"
    ) {
      this.options.onPinchEnd();
    }

    this.state = "Ready";
    this.pointerIndexCounter = 0;
    this.pointerdownTime = 0;
    if (this.pointers.size === 0) {
      this.blockedPointerIds.clear();
    }
  }

  private averagePointers(
    firstPointer: TrackedPointer,
    secondPointer: TrackedPointer,
  ) {
    return {
      x: (firstPointer.clientX + secondPointer.clientX) / 2,
      y: (firstPointer.clientY + secondPointer.clientY) / 2,
    };
  }

  private getDistance(firstPointer: TrackedPointer, secondPointer: TrackedPointer) {
    return Math.hypot(
      firstPointer.clientX - secondPointer.clientX,
      firstPointer.clientY - secondPointer.clientY,
    );
  }

  private zoomAtClientPoint(nextScale: number, anchor: { x: number; y: number }) {
    const rect = this.element.getBoundingClientRect();
    const localX = anchor.x - rect.left;
    const localY = anchor.y - rect.top;
    const sceneX = (localX - this.position.x) / this.position.scale;
    const sceneY = (localY - this.position.y) / this.position.scale;

    this.position.scale = nextScale;
    this.position.x = localX - sceneX * nextScale;
    this.position.y = localY - sceneY * nextScale;
  }

  private clampScale(scale: number) {
    return Math.min(this.maxScale, Math.max(this.minScale, scale));
  }

  private resolveTwoFingerTap(now: number) {
    if (
      this.lastTwoFingerTapTime !== null &&
      now - this.lastTwoFingerTapTime <= DOUBLE_TAP_MS
    ) {
      this.lastTwoFingerTapTime = null;
      this.options.onTwoFingerDoubleTap();
      return;
    }

    this.lastTwoFingerTapTime = now;
    this.options.onTwoFingerTap();
  }

  private resolveThreeFingerTap(now: number) {
    if (
      this.lastThreeFingerTapTime !== null &&
      now - this.lastThreeFingerTapTime <= DOUBLE_TAP_MS
    ) {
      this.lastThreeFingerTapTime = null;
      this.options.onThreeFingerDoubleTap();
      return;
    }

    this.lastThreeFingerTapTime = now;
    this.options.onThreeFingerTap();
  }

  private createSyntheticPointerEvent(
    type: string,
    pointer: TrackedPointer,
    source: PointerEvent,
  ) {
    return new PointerEvent(type, {
      bubbles: source.bubbles,
      cancelable: source.cancelable,
      composed: source.composed,
      pointerId: pointer.pointerId,
      pointerType: pointer.pointerType,
      isPrimary: pointer.isPrimary,
      clientX: pointer.clientX,
      clientY: pointer.clientY,
      button: source.button,
      buttons: source.buttons,
      pressure: source.pressure,
      altKey: source.altKey,
      ctrlKey: source.ctrlKey,
      metaKey: source.metaKey,
      shiftKey: source.shiftKey,
    });
  }
}
