export type KeyboardShortcutAction =
  | "undo"
  | "redo"
  | "selectAll"
  | "cancel"
  | "deleteSelection"
  | "setBrushTool"
  | "setEraserTool"
  | "setLiquifyTool"
  | "setSelectTool"
  | "temporaryPan"
  | "temporaryZoom"
  | "temporaryColorPicker";

export type KeyboardShortcutKey =
  | "ctrl"
  | "cmd"
  | "shift"
  | "space"
  | "z"
  | "c"
  | "a"
  | "b"
  | "e"
  | "l"
  | "s"
  | "escape"
  | "delete";

export type KeyboardShortcut = {
  action: KeyboardShortcutAction;
  keys: readonly KeyboardShortcutKey[];
  preventDefault?: boolean;
};

const isMacPlatform =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform);

const systemModifierKey = isMacPlatform ? "cmd" : "ctrl";

export const keyboardShortcuts = [
  {
    action: "undo",
    keys: [systemModifierKey, "z"],
  },
  {
    action: "redo",
    keys: [systemModifierKey, "shift", "z"],
  },
  {
    action: "selectAll",
    keys: [systemModifierKey, "a"],
  },
  {
    action: "cancel",
    keys: ["escape"],
  },
  {
    action: "deleteSelection",
    keys: ["delete"],
  },
  {
    action: "deleteSelection",
    keys: [systemModifierKey, "delete"],
  },
  {
    action: "setBrushTool",
    keys: ["b"],
  },
  {
    action: "setEraserTool",
    keys: ["e"],
  },
  {
    action: "setLiquifyTool",
    keys: ["l"],
  },
  {
    action: "setSelectTool",
    keys: ["s"],
  },
  {
    action: "temporaryPan",
    keys: ["space"],
  },
  {
    action: "temporaryZoom",
    keys: ["z"],
  },
  {
    action: "temporaryColorPicker",
    keys: ["c"],
  },
] as const satisfies readonly KeyboardShortcut[];

export type TemporaryKeyboardShortcutAction = Extract<
  KeyboardShortcutAction,
  "temporaryPan" | "temporaryZoom" | "temporaryColorPicker"
>;

export const temporaryKeyActionPriority = {
  temporaryPan: 300,
  temporaryZoom: 200,
  temporaryColorPicker: 100,
} as const satisfies Record<TemporaryKeyboardShortcutAction, number>;
