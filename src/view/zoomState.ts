// zoomState.ts
import { makeAutoObservable } from "mobx";

export class ZoomRectState {
    sx = 0;
    sy = 0;
    ex = 0;
    ey = 0;

    constructor() {
        makeAutoObservable(this);
    }

    setStart(x: number, y: number) {
        this.sx = this.ex = x;
        this.sy = this.ey = y;
    }

    updateEnd(x: number, y: number) {
        this.ex = x;
        this.ey = y;
    }

    reset() {
        this.sx = this.sy = this.ex = this.ey = 0;
    }
}

export const zoomRect = new ZoomRectState();
