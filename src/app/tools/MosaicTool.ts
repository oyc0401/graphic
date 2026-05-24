import { MosaicToolId, paintState, SessionId } from "../paintState";
import { BrushSprayTool } from "./BrushSprayTool";
import { BrushTool } from "./BrushTool";
import type { Tool, ToolConfig } from "./Tool";

class MosaicBrushTool extends BrushTool {
  config: ToolConfig = {
    allowCanvasResizeHandle: false,
  };

  canUse() {
    return paintState.getSessionId() === SessionId.Mosaic;
  }
}

export class MosaicSessionTool implements Tool {
  config: ToolConfig = {
    allowCanvasResizeHandle: false,
  };

  private brushTool = new MosaicBrushTool();
  private restoreTool = new BrushSprayTool(
    () =>
      paintState.getSessionId() === SessionId.Mosaic &&
      paintState.getMosaicToolId() === MosaicToolId.Restore,
  );

  enter() {}

  exit() {
    this.brushTool.exit();
    this.restoreTool.exit();
  }

  canUse() {
    return paintState.getSessionId() === SessionId.Mosaic;
  }

  down(e: PointerEvent) {
    this.getActiveTool().down(e);
  }

  move(e: PointerEvent) {
    this.getActiveTool().move(e);
  }

  up(e: PointerEvent) {
    this.getActiveTool().up(e);
  }

  cancel() {
    this.getActiveTool().cancel();
  }

  private getActiveTool() {
    return paintState.getMosaicToolId() === MosaicToolId.Restore
      ? this.restoreTool
      : this.brushTool;
  }
}
