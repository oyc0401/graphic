import type { CoreTool } from "@/core/types";
import type { HistoryCount, HistoryResponse } from "@/core/history/history";
import { getManager } from "@/core/utils/cachedManager";
import { getLiquifyManager } from "../gl/tool/liquify/liquify";

export interface EditSession {
  tool: CoreTool;
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

  getActiveSession() {
    return this.activeSession;
  }

  hasActiveSession() {
    return this.activeSession !== null;
  }

  getActiveSessionTool(): CoreTool | null {
    return this.activeSession?.tool ?? null;
  }

  applyActiveSession() {
    this.activeSession?.apply();
    this.activeSession = null;
  }

  discardActiveSession() {
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
