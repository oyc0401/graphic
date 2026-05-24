/** keyboard.ts */
import { redo, undo } from "../history";
import {
  InputMode,
  LiquifyToolId,
  MosaicToolId,
  paintState,
  SessionId,
  TemporaryToolId,
} from "../paintState";
import { position } from "../position";
import { cancel, toolManager } from "../draw";
import { applySelection, canvasSelect, selectionDelete } from "../selection";
import {
  keyboardShortcuts,
  temporaryKeyActionPriority,
  type KeyboardShortcut,
  type KeyboardShortcutAction,
  type KeyboardShortcutKey,
  type TemporaryKeyboardShortcutAction,
} from "./keyboardShortcutConfig";
import { addWheelListener } from "./wheelEvent";

type CommandShortcutAction = Exclude<
  KeyboardShortcutAction,
  TemporaryKeyboardShortcutAction
>;

type CommandShortcut = KeyboardShortcut & {
  action: CommandShortcutAction;
};

type TemporaryShortcut = KeyboardShortcut & {
  action: TemporaryKeyboardShortcutAction;
};

const eventCodeToShortcutKey: Partial<Record<string, KeyboardShortcutKey>> = {
  ControlLeft: "ctrl",
  ControlRight: "ctrl",
  MetaLeft: "cmd",
  MetaRight: "cmd",
  ShiftLeft: "shift",
  ShiftRight: "shift",
  Space: "space",
  KeyZ: "z",
  KeyC: "c",
  KeyA: "a",
  KeyB: "b",
  KeyE: "e",
  KeyL: "l",
  KeyP: "p",
  KeyR: "r",
  KeyS: "s",
  Escape: "escape",
  Delete: "delete",
};

const commonCommandShortcuts = keyboardShortcuts.commonShortcuts.filter(
  isCommandShortcut,
);
const mainCommandShortcuts = keyboardShortcuts.mainShortcuts.filter(
  isCommandShortcut,
);
const liquifyCommandShortcuts = keyboardShortcuts.liquifyShortcuts.filter(
  isCommandShortcut,
);
const mosaicCommandShortcuts = keyboardShortcuts.mosaicShortcuts.filter(
  isCommandShortcut,
);
const temporaryShortcuts = keyboardShortcuts.commonShortcuts.filter(
  isTemporaryShortcut,
);
const mainTemporaryShortcuts = keyboardShortcuts.mainShortcuts.filter(
  isTemporaryShortcut,
);

const commandHandlers = {
  undo,
  redo,
  selectAll() {
    applySelection();
    canvasSelect(0, 0, position.width, position.height);
  },
  cancel,
  deleteSelection: selectionDelete,
  setBrushTool() {
    toolManager.setBrushTool();
  },
  setEraserTool() {
    toolManager.setEraserTool();
  },
  setLiquifyTool() {
    toolManager.setLiquifyTool();
  },
  setSelectTool() {
    toolManager.setSelectTool();
  },
  setLiquifyPushTool() {
    toolManager.setLiquifyTool(LiquifyToolId.Push);
  },
  setLiquifyTwirlCounterClockwiseTool() {
    toolManager.setLiquifyTool(LiquifyToolId.TwirlCounterClockwise);
  },
  setLiquifyTwirlClockwiseTool() {
    toolManager.setLiquifyTool(LiquifyToolId.TwirlClockwise);
  },
  setLiquifyBloatTool() {
    toolManager.setLiquifyTool(LiquifyToolId.Bloat);
  },
  setLiquifyPuckerTool() {
    toolManager.setLiquifyTool(LiquifyToolId.Pucker);
  },
  setLiquifyRestoreTool() {
    toolManager.setLiquifyTool(LiquifyToolId.Restore);
  },
  setMosaicPixelMode() {
    toolManager.setMosaicMode(MosaicToolId.Pixel);
  },
  setMosaicBlurMode() {
    toolManager.setMosaicMode(MosaicToolId.Blur);
  },
  setMosaicRestoreMode() {
    toolManager.setMosaicMode(MosaicToolId.Restore);
  },
} satisfies Record<CommandShortcutAction, () => void>;

const DEBUG_KEYBOARD = true;

const pressedTemporaryActions: Record<
  TemporaryKeyboardShortcutAction,
  boolean
> = {
  temporaryPan: false,
  temporaryZoom: false,
  temporaryColorPicker: false,
};

const alwaysPreventDefaultCodes = new Set(["Tab", "Enter"]);
const alwaysPreventDefaultKeys = new Set<KeyboardShortcutKey>(["space"]);

export function addKeyboardEvent() {
  addKeyActionChangeEventListener();
  addWheelListener();

  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);
}

function handleKeyDown(event: KeyboardEvent) {
  if (isEditableTarget(event.target)) return;

  logRawKeyboardEvent("keydown", event);

  const key = getShortcutKey(event);
  logPressedKeys("keydown", event);

  const commandShortcut = findMatchingCommandShortcut(event, key);
  if (commandShortcut) {
    preventShortcutDefault(event, commandShortcut);
    runCommand(commandShortcut);
    return;
  }

  preventReservedBrowserDefault(event, key);

  if (key && !event.repeat) {
    pressTemporaryShortcut(key, event);
  }

  if (event.repeat) return;

  if (event.code === "AltLeft") {
    paintState.setShowBrushCursorPreview(true);
  }
}

function handleKeyUp(event: KeyboardEvent) {
  logRawKeyboardEvent("keyup", event);

  const key = getShortcutKey(event);
  if (key) {
    releaseTemporaryShortcut(key);
  }
  logPressedKeys("keyup", event);

  preventReservedBrowserDefault(event, key);

  if (event.code === "AltLeft") {
    event.preventDefault();
    paintState.setShowBrushCursorPreview(false);
  }
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function getShortcutKey(event: KeyboardEvent) {
  return eventCodeToShortcutKey[event.code] ?? null;
}

function isModifierKey(key: KeyboardShortcutKey) {
  return key === "ctrl" || key === "cmd" || key === "shift";
}

function isCommandShortcut(
  shortcut: KeyboardShortcut,
): shortcut is CommandShortcut {
  return !(shortcut.action in temporaryKeyActionPriority);
}

function isTemporaryShortcut(
  shortcut: KeyboardShortcut,
): shortcut is TemporaryShortcut {
  return shortcut.action in temporaryKeyActionPriority;
}

function logPressedKeys(phase: "keydown" | "keyup", event: KeyboardEvent) {
  if (!DEBUG_KEYBOARD) return;

  // console.log("[keyboard]", phase, event.code, getPressedModifierKeys(event));
}

function logRawKeyboardEvent(phase: "keydown" | "keyup", event: KeyboardEvent) {
  if (!DEBUG_KEYBOARD) return;

  // console.log("[keyboard:raw]", phase, event);
}

function findMatchingCommandShortcut(
  event: KeyboardEvent,
  key: KeyboardShortcutKey | null,
) {
  if (!key) return undefined;

  const pressedCommandKeys = getPressedCommandKeys(event, key);
  return getActiveCommandShortcuts().find((shortcut) =>
    isSameKeySequence(shortcut.keys, pressedCommandKeys),
  );
}

function getActiveCommandShortcuts(): readonly CommandShortcut[] {
  if (!paintState.getSessionMode()) {
    return [...commonCommandShortcuts, ...mainCommandShortcuts];
  }

  if (paintState.getSessionId() === SessionId.Liquify) {
    return [...commonCommandShortcuts, ...liquifyCommandShortcuts];
  }

  return [...commonCommandShortcuts, ...mosaicCommandShortcuts];
}

function getPressedCommandKeys(event: KeyboardEvent, key: KeyboardShortcutKey) {
  if (isModifierKey(key)) {
    return getPressedModifierKeys(event);
  }

  return [...getPressedModifierKeys(event), key];
}

function getPressedModifierKeys(event: KeyboardEvent) {
  const keys: KeyboardShortcutKey[] = [];

  if (event.ctrlKey) keys.push("ctrl");
  if (event.metaKey) keys.push("cmd");
  if (event.shiftKey) keys.push("shift");

  return keys;
}

function isSameKeySequence(
  a: readonly KeyboardShortcutKey[],
  b: readonly KeyboardShortcutKey[],
) {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

function runCommand(shortcut: CommandShortcut) {
  commandHandlers[shortcut.action]();
}

function preventShortcutDefault(
  event: KeyboardEvent,
  shortcut: KeyboardShortcut,
) {
  if (shortcut.preventDefault !== false) {
    event.preventDefault();
  }
}

function preventReservedBrowserDefault(
  event: KeyboardEvent,
  key: KeyboardShortcutKey | null,
) {
  if (
    alwaysPreventDefaultCodes.has(event.code) ||
    (key && alwaysPreventDefaultKeys.has(key))
  ) {
    event.preventDefault();
  }
}

function pressTemporaryShortcut(
  key: KeyboardShortcutKey,
  event: KeyboardEvent,
) {
  if (event.ctrlKey) return;
  if (event.metaKey) return;

  const shortcut = findTemporaryShortcutByKey(key);
  if (!shortcut) return;

  preventShortcutDefault(event, shortcut);
  setTemporaryAction(shortcut.action, true);
}

function releaseTemporaryShortcut(key: KeyboardShortcutKey) {
  const shortcut = findTemporaryShortcutByKey(key);
  if (!shortcut) return;

  setTemporaryAction(shortcut.action, false);
}

function findTemporaryShortcutByKey(key: KeyboardShortcutKey) {
  return getActiveTemporaryShortcuts().find(
    (shortcut) => shortcut.keys.length === 1 && shortcut.keys[0] === key,
  );
}

function getActiveTemporaryShortcuts(): readonly TemporaryShortcut[] {
  if (!paintState.getSessionMode()) {
    return [...temporaryShortcuts, ...mainTemporaryShortcuts];
  }

  return temporaryShortcuts;
}

function setTemporaryAction(
  action: TemporaryKeyboardShortcutAction,
  isPressed: boolean,
) {
  pressedTemporaryActions[action] = isPressed;
  applyTemporaryAction();
}

function applyTemporaryAction() {
  if (paintState.getPointerdown()) return;

  const activeAction = getHighestPriorityTemporaryAction();

  switch (activeAction) {
    case "temporaryPan":
      paintState.setInputMode(InputMode.Pan);
      return;
    case "temporaryZoom":
      paintState.setInputMode(InputMode.Zoom);
      return;
    case "temporaryColorPicker":
      paintState.setTemporaryToolId(TemporaryToolId.ColorPicker);
      return;
  }

  paintState.setInputMode(InputMode.DEFAULT);
  paintState.setTemporaryToolId(null);
}

function getHighestPriorityTemporaryAction() {
  const activeActions = new Set(
    getActiveTemporaryShortcuts().map((shortcut) => shortcut.action),
  );

  return Object.entries(pressedTemporaryActions)
    .filter(
      ([action, isPressed]) =>
        isPressed && activeActions.has(action as TemporaryKeyboardShortcutAction),
    )
    .map(([action]) => action as TemporaryKeyboardShortcutAction)
    .sort(
      (a, b) => temporaryKeyActionPriority[b] - temporaryKeyActionPriority[a],
    )[0];
}

function addKeyActionChangeEventListener() {
  window.addEventListener("pointerup", () => {
    setTimeout(() => {
      applyTemporaryAction();
    }, 0);
  });
}
