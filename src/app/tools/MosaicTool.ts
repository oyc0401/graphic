import { paintState, SessionId } from "../paintState";
import { BrushTool } from "./BrushTool";
import type { ToolConfig } from "./Tool";

export class MosaicSessionTool extends BrushTool {
  config: ToolConfig = {
    allowCanvasResizeHandle: false,
  };

  canUse() {
    return (
      paintState.getSessionMode() &&
      paintState.getSessionId() === SessionId.Mosaic
    );
  }
}
