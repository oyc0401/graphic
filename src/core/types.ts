export interface Pointer {
  x: number;
  y: number;
}

export type CoreTool = "brush" | "eraser" | "select" | "selection";

export type CoreSessionTool = "liquify";

export interface CoreToolState {
  tool: CoreTool | CoreSessionTool;
}

export interface Tangent {
  x: number;
  y: number;
}
