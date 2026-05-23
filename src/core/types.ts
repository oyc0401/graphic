export interface Pointer {
  x: number;
  y: number;
}

export type CoreTool = "brush" | "eraser";

export type CoreSessionTool = "liquify";

export type LiquifyTool =
  | "push"
  | "twirlClockwise"
  | "twirlCounterClockwise"
  | "bloat"
  | "pucker";

export interface Tangent {
  x: number;
  y: number;
}
