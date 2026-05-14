export interface ToolConfig {
  allowCanvasResizeHandle: boolean;
  cursorClass?: string;
}

export type ToolPointerEvent = PointerEvent;

export interface Tool {
  config: ToolConfig;

  canUse(): boolean;

  enter(): void;
  exit(): void;

  down(e: ToolPointerEvent): void;
  move(e: ToolPointerEvent): void;
  up(e: ToolPointerEvent): void;
  cancel(): void;
}
