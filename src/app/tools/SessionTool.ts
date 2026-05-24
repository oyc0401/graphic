import { paintState, SessionId } from "../paintState";
import { LiquifySessionTool } from "./LiquifyTool";
import { MosaicSessionTool } from "./MosaicTool";
import type { Tool, ToolConfig } from "./Tool";

export class SessionTool implements Tool {
  config: ToolConfig = {
    allowCanvasResizeHandle: false,
  };

  private liquifyTool = new LiquifySessionTool();
  private mosaicTool = new MosaicSessionTool();

  enter() {}

  exit() {
    this.liquifyTool.exit();
    this.mosaicTool.exit();
  }

  canUse() {
    return paintState.getSessionMode();
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
    return paintState.getSessionId() === SessionId.Mosaic
      ? this.mosaicTool
      : this.liquifyTool;
  }
}
