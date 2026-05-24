export interface ToolConfig {
  allowCanvasResizeHandle: boolean;
  cursorClass?: string;
}

export interface Tool {
  config: ToolConfig;

  canUse(): boolean;

  enter(): void;
  exit(): void;

  down(e: PointerEvent): void;
  move(e: PointerEvent): void;
  up(e: PointerEvent): void;
  cancel(): void;
}
