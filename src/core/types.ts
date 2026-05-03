export interface Pointer {
  x: number;
  y: number;
}

export type CoreTool = "brush" | "eraser" | "liquify" | "select" | "selection";

export interface CoreToolState {
  tool: CoreTool;
}

export interface Tangent {
  x: number;
  y: number;
}
