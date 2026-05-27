export interface Pointer {
  x: number;
  y: number;
}

export type CoreTool = "brush" | "eraser" | "pencil";

export type CoreSessionTool = "liquify" | "mosaic";

export type ShapeKind = "rect" | "ellipse" | "line" | "curve";

export type MosaicMode = "pixel" | "blur" | "restore";

export type LiquifyTool =
  | "push"
  | "twirlClockwise"
  | "twirlCounterClockwise"
  | "bloat"
  | "pucker"
  | "restore";

export interface Tangent {
  x: number;
  y: number;
}
