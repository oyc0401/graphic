/** keyboard.ts */
import { redo, undo } from "../history";
import { InputMode, paintState } from "../paintState";
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
  KeyS: "s",
  Escape: "escape",
  Delete: "delete",
};

const temporaryActionMode = {
  temporaryPan: InputMode.Pan,
  temporaryZoom: InputMode.Zoom,
  temporaryColorPicker: InputMode.ColorPicker,
} as const;

const commandShortcuts = keyboardShortcuts.filter(
  (shortcut): shortcut is CommandShortcut =>
    !(shortcut.action in temporaryKeyActionPriority),
);

const temporaryShortcuts = keyboardShortcuts.filter(
  (shortcut): shortcut is TemporaryShortcut =>
    shortcut.action in temporaryKeyActionPriority,
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
} satisfies Record<CommandShortcutAction, () => void>;

const pressedModifiersInOrder: KeyboardShortcutKey[] = [];
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
  if (key && isModifierKey(key) && !event.repeat) {
    pressModifier(key);
  }
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
    if (isModifierKey(key)) {
      releaseModifier(key);
    }
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

function pressModifier(key: KeyboardShortcutKey) {
  if (!pressedModifiersInOrder.includes(key)) {
    pressedModifiersInOrder.push(key);
  }
}

function logPressedKeys(phase: "keydown" | "keyup", event: KeyboardEvent) {
  if (!DEBUG_KEYBOARD) return;

  // console.log("[keyboard]", phase, event.code, [...pressedModifiersInOrder]);
}

function logRawKeyboardEvent(phase: "keydown" | "keyup", event: KeyboardEvent) {
  if (!DEBUG_KEYBOARD) return;

  // console.log("[keyboard:raw]", phase, event);
}

function releaseModifier(key: KeyboardShortcutKey) {
  const index = pressedModifiersInOrder.indexOf(key);
  if (index >= 0) {
    pressedModifiersInOrder.splice(index, 1);
  }
}

function findMatchingCommandShortcut(
  event: KeyboardEvent,
  key: KeyboardShortcutKey | null,
) {
  if (!key) return undefined;

  const pressedCommandKeys = getPressedCommandKeys(event, key);
  return commandShortcuts.find((shortcut) =>
    isSameKeySequence(shortcut.keys, pressedCommandKeys),
  );
}

function getPressedCommandKeys(event: KeyboardEvent, key: KeyboardShortcutKey) {
  if (key === "ctrl" || key === "shift") {
    return pressedModifiersInOrder;
  }

  return [...pressedModifiersInOrder, key];
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
  if (pressedModifiersInOrder.includes("ctrl")) return;
  if (pressedModifiersInOrder.includes("cmd")) return;

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
  return temporaryShortcuts.find(
    (shortcut) => shortcut.keys.length === 1 && shortcut.keys[0] === key,
  );
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
  if (activeAction) {
    paintState.setInputMode(temporaryActionMode[activeAction]);
    return;
  }

  paintState.setInputMode(InputMode.DEFAULT);
}

function getHighestPriorityTemporaryAction() {
  return Object.entries(pressedTemporaryActions)
    .filter(([, isPressed]) => isPressed)
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
