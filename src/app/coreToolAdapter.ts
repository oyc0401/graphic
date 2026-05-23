import { BrushId, InputMode, paintState, SessionId, ToolId } from "./paintState";
import { getLayerWorker } from "./worker/workerPool";

export type WorkerToolTarget = BrushId | SessionId.Liquify | ToolId.Select | ToolId.Selection;
type WorkerPaintTool = "brush" | "eraser";
type WorkerSessionTool = "liquify";
type WorkerToolCommand = WorkerPaintTool | WorkerSessionTool;

export function getActiveToolId(): ToolId {
  let toolId = paintState.getSelectedToolId();
  if (paintState.getSessionMode()) toolId = ToolId.Session;
  if (paintState.getInputMode() === InputMode.Zoom) toolId = ToolId.Zoom;
  if (paintState.getInputMode() === InputMode.ColorPicker) {
    toolId = ToolId.ColorPicker;
  }

  return toolId;
}

function workerToolForTarget(target: WorkerToolTarget): WorkerToolCommand | null {
  switch (target) {
    case BrushId.Brush:
      return "brush";
    case BrushId.Eraser:
      return "eraser";
    case SessionId.Liquify:
      return "liquify";
    case ToolId.Select:
    case ToolId.Selection:
      return null;
  }
}

function workerToolForCurrentPaintState(): WorkerToolCommand {
  switch (paintState.getSelectedToolId()) {
    case ToolId.Brush:
      return paintState.getBrushId();
    case ToolId.Select:
    case ToolId.Selection:
    case ToolId.Session:
      return paintState.getBrushId();
    case ToolId.Zoom:
    case ToolId.ColorPicker:
      return paintState.getBrushId();
  }
}

function applyWorkerToolToPaintState(tool: WorkerToolCommand | null, fallbackTarget?: WorkerToolTarget) {
  switch (tool) {
    case "brush":
      paintState.setBrushId(BrushId.Brush);
      paintState.setSelectedToolId(ToolId.Brush);
      return;
    case "eraser":
      paintState.setBrushId(BrushId.Eraser);
      paintState.setSelectedToolId(ToolId.Brush);
      return;
    case "liquify":
      paintState.setSessionId(SessionId.Liquify);
      paintState.setSessionMode(true);
      return;
    case null:
      if (fallbackTarget === ToolId.Select || fallbackTarget === ToolId.Selection) {
        paintState.setSelectedToolId(fallbackTarget);
      }
      return;
  }
}

// worker 대상 도구를 app의 선택 상태에만 반영한다.
export function selectPaintToolForWorkerTarget(target: WorkerToolTarget) {
  applyWorkerToolToPaintState(workerToolForTarget(target), target);
}

// 지정한 worker 대상 도구가 현재 app에서 선택된 도구인지 확인한다.
export function isCurrentWorkerToolTarget(target: WorkerToolTarget) {
  if (target === ToolId.Select || target === ToolId.Selection) {
    return paintState.getSelectedToolId() === target;
  }
  return workerToolForCurrentPaintState() === workerToolForTarget(target);
}

// app의 도구 선택을 worker 도구 변경이나 세션 시작 명령으로 적용한다.
export function applyWorkerToolTarget(target: WorkerToolTarget) {
  const tool = workerToolForTarget(target);
  applyWorkerToolToPaintState(tool, target);
  if (tool === null) {
    return;
  }
  if (tool === "liquify") {
    return getLayerWorker().openSession(tool);
  }
  return getLayerWorker().setTool(tool);
}

// 현재 app 도구 상태를 기준으로 worker의 입력 도구나 세션 상태를 맞춘다.
export function syncWorkerToCurrentPaintTool() {
  const tool = workerToolForCurrentPaintState();
  if (tool === "liquify") {
    return getLayerWorker().openSession(tool);
  }
  return getLayerWorker().setTool(tool);
}
