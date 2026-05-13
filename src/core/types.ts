export interface Pointer {
  x: number;
  y: number;
}

export type CoreTool = "brush" | "eraser";

export type CoreSessionTool = "liquify";

export interface CoreToolState {
  tool: CoreTool;
}

export interface Tangent {
  x: number;
  y: number;
}
