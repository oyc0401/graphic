import type { CoreSessionTool } from "@/core/types";
import type { HistoryCount, HistoryResponse } from "@/core/history/history";
import { getManager } from "@/core/utils/cachedManager";
import { getLiquifyManager } from "../gl/tool/liquify/liquify";
import { getMosaicManager } from "../gl/tool/mosaic/mosaic";

export interface EditSession {
  tool: CoreSessionTool;
  apply(): void;
  discard(): void;
  undo(): Promise<HistoryResponse | null>;
  redo(): Promise<HistoryResponse | null>;
  getHistoryCount(): HistoryCount;
}

class LiquifySession implements EditSession {
  readonly tool = "liquify";

  constructor(private liquifyManager) {}

  apply() {
    this.liquifyManager.applySession();
  }

  discard() {
    this.liquifyManager.discardSession();
  }

  undo() {
    return this.liquifyManager.undo();
  }

  redo() {
    return this.liquifyManager.redo();
  }

  getHistoryCount() {
    return this.liquifyManager.getHistoryCount();
  }
}

class MosaicSession implements EditSession {
  readonly tool = "mosaic";

  constructor(private mosaicManager) {}

  apply() {
    this.mosaicManager.applySession();
  }

  discard() {
    this.mosaicManager.discardSession();
  }

  undo() {
    return this.mosaicManager.undo();
  }

  redo() {
    return this.mosaicManager.redo();
  }

  getHistoryCount() {
    return this.mosaicManager.getHistoryCount();
  }
}

class SessionManager {
  private activeSession: EditSession | null = null;

  constructor(
    private canvas,
    private gl,
  ) {}

  startLiquifySession(): EditSession {
    const liquifyManager = getLiquifyManager(this.canvas, this.gl);
    liquifyManager.enter();
    this.activeSession = new LiquifySession(liquifyManager);
    return this.activeSession;
  }

  startMosaicSession(): EditSession {
    const mosaicManager = getMosaicManager(this.canvas, this.gl);
    mosaicManager.enter();
    this.activeSession = new MosaicSession(mosaicManager);
    return this.activeSession;
  }

  getActiveSession() {
    return this.activeSession;
  }

  hasActiveSession() {
    return this.activeSession !== null;
  }

  getActiveSessionTool(): CoreSessionTool | null {
    return this.activeSession?.tool ?? null;
  }

  commitSession() {
    this.activeSession?.apply();
    this.activeSession = null;
  }

  discardSession() {
    this.activeSession?.discard();
    this.activeSession = null;
  }

  undo() {
    return this.activeSession?.undo() ?? null;
  }

  redo() {
    return this.activeSession?.redo() ?? null;
  }

  getHistoryCount() {
    return this.activeSession?.getHistoryCount() ?? null;
  }
}

export function getSessionManager(canvas, gl) {
  return getManager(gl, "session", () => new SessionManager(canvas, gl));
}
