export type CommonKeyboardShortcutAction =
  | "undo"
  | "redo"
  | "cancel"
  | "temporaryPan"
  | "temporaryZoom";

export type MainKeyboardShortcutAction =
  | "selectAll"
  | "deleteSelection"
  | "setBrushTool"
  | "setEraserTool"
  | "setLiquifyTool"
  | "setSelectTool"
  | "temporaryColorPicker";

export type LiquifyKeyboardShortcutAction =
  | "setLiquifyPushTool"
  | "setLiquifyTwirlCounterClockwiseTool"
  | "setLiquifyTwirlClockwiseTool"
  | "setLiquifyBloatTool"
  | "setLiquifyPuckerTool"
  | "setLiquifyRestoreTool";

export type MosaicKeyboardShortcutAction =
  | "setMosaicPixelMode"
  | "setMosaicBlurMode"
  | "setMosaicRestoreMode";

export type KeyboardShortcutAction =
  | CommonKeyboardShortcutAction
  | MainKeyboardShortcutAction
  | LiquifyKeyboardShortcutAction
  | MosaicKeyboardShortcutAction;

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
  | "p"
  | "r"
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

export const keyboardShortcuts = {
  commonShortcuts: [
    {
      action: "undo",
      keys: [systemModifierKey, "z"],
    },
    {
      action: "redo",
      keys: [systemModifierKey, "shift", "z"],
    },
    {
      action: "cancel",
      keys: ["escape"],
    },
    {
      action: "temporaryPan",
      keys: ["space"],
    },
    {
      action: "temporaryZoom",
      keys: ["z"],
    },
  ],
  mainShortcuts: [
    {
      action: "selectAll",
      keys: [systemModifierKey, "a"],
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
      action: "temporaryColorPicker",
      keys: ["c"],
    },
  ],
  liquifyShortcuts: [
    {
      action: "setLiquifyPushTool",
      keys: ["p"],
    },
    {
      action: "setLiquifyTwirlCounterClockwiseTool",
      keys: ["l"],
    },
    {
      action: "setLiquifyTwirlClockwiseTool",
      keys: ["r"],
    },
    {
      action: "setLiquifyBloatTool",
      keys: ["b"],
    },
    {
      action: "setLiquifyPuckerTool",
      keys: ["s"],
    },
    {
      action: "setLiquifyRestoreTool",
      keys: ["e"],
    },
  ],
  mosaicShortcuts: [
    {
      action: "setMosaicPixelMode",
      keys: ["p"],
    },
    {
      action: "setMosaicBlurMode",
      keys: ["b"],
    },
    {
      action: "setMosaicRestoreMode",
      keys: ["e"],
    },
  ],
} as const satisfies Record<string, readonly KeyboardShortcut[]>;

export type TemporaryKeyboardShortcutAction = Extract<
  KeyboardShortcutAction,
  "temporaryPan" | "temporaryZoom" | "temporaryColorPicker"
>;

export const temporaryKeyActionPriority = {
  temporaryPan: 300,
  temporaryZoom: 200,
  temporaryColorPicker: 100,
} as const satisfies Record<TemporaryKeyboardShortcutAction, number>;
