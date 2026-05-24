import {
  BrushId,
  LiquifyToolId,
  MosaicToolId,
  paintState,
  SessionId,
  ToolId,
} from "../paintState";
import { toolManager } from "../tools/toolManager";
import { hexToRgb } from "../utils/color";
import { observer } from "mobx-react-lite";
import type { ReactNode } from "react";

import UndoIcon from "../assets/undo.svg?react";
import RedoIcon from "../assets/redo.svg?react";
import UndoOffIcon from "../assets/undo_disabled.svg?react";
import RedoOffIcon from "../assets/redo_disabled.svg?react";

import BrushIcon from "../assets/brush.svg?react";
import EraserIcon from "../assets/eraser.svg?react";
import LiquifyIcon from "../assets/liquify.svg?react";
import SelectionIcon from "../assets/select_rectangle.svg?react";

import { ColorIndicatorButton, MainMenuToggleButton } from "./dropdown";
import { colorState } from "../colorState";
import { historyState, redo, undo } from "../history";
import { getLetter } from "../i18n/language";
import {
  CircleCheck,
  CircleX,
  Expand,
  Grid2X2,
  Pipette,
  RotateCcw,
  RotateCw,
  Search,
  Shrink,
  Waves,
} from "lucide-react";
import {
  BrushAlphaSlider,
  BrushSizeSlider,
  MosaicStrengthSlider,
} from "./BrushSliders";

const hexColors = [
  "#000000",
  "#FFFFFF",
  "#FF6F61",
  "#98FF98",
  "#FFA75F",
  "#ACE7FF",
  "#FFED65",
  "#E5B5FF",
];

function AppBarDesktop() {
  /** 색상 팔레트 콜백 */
  const chooseColor = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    colorState.setColorFromRGB(r, g, b);
  };

  // --------------------------- JSX ---------------------------
  return (
    <>
      <div
        style={{
          height: 133,
          width: "100%",
        }}
      ></div>
      <div id="appbar">
        {/* ===== 헤더 ===== */}
        <div id="header">
          <MainMenuToggleButton />

          <div style={{ flex: 1 }} />
          <HistoryButtons />
        </div>

        {/* ===== 툴바 ===== */}
        {paintState.getSessionMode() ? (
          paintState.getSessionId() === SessionId.Mosaic ? (
            <MosaicMenuBar />
          ) : (
            <LiquifyMenuBar />
          )
        ) : (
          <div id="menu-bar">
            <SelectionToolButton />

            <div className="div-bar"></div>
            <div className="mini-buttons">
              <ZoomToolButton />
              <ColorPickerToolButton />
            </div>
            <div className="div-bar"></div>

            <BrushToolButton />
            <EraserToolButton />
            <div className="div-bar"></div>
            <LiquifyToolButton />
            <MosaicToolButton />
            <div className="div-bar"></div>
            {/* ===== 슬라이더 ===== */}
            <div className="brush-control-group">
              <BrushSizeSlider />

              <BrushAlphaSlider />
            </div>

            <div className="div-bar"></div>
            {/* ===== 색상 팔레트 ===== */}
            <div className="flex flex-row items-center">
              <div id="color-box">
                {hexColors.map((hex) => (
                  <div
                    key={hex}
                    className="select-color"
                    onClick={() => chooseColor(hex)}
                  >
                    <div
                      className="circle-shape"
                      style={{
                        background: hex,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <ColorIndicatorButton />
          </div>
        )}
      </div>
    </>
  );
}

export default observer(AppBarDesktop);

const LiquifyMenuBar = observer(() => {
  return (
    <div id="menu-bar">
      <button
        className="select-button"
        aria-label={getLetter("apply")}
        onClick={() => toolManager.commitSession()}
      >
        <CircleCheck color="#16a34a" size={32} strokeWidth={2.4} />
        <p>{getLetter("apply")}</p>
      </button>
      <button
        className="select-button"
        aria-label={getLetter("cancel")}
        onClick={() => toolManager.discardSession()}
      >
        <CircleX color="#dc2626" size={32} strokeWidth={2.4} />
        <p>{getLetter("cancel")}</p>
      </button>

      <div className="div-bar"></div>

      <LiquifySessionToolButton
        toolId={LiquifyToolId.Push}
        label={getLetter("liquify_push")}
        icon={<LiquifyIcon width={32} height={32} />}
      />
      <LiquifySessionToolButton
        toolId={LiquifyToolId.TwirlCounterClockwise}
        label={getLetter("liquify_twirl_left")}
        icon={<RotateCcw size={32} strokeWidth={2.2} />}
        strokeIcon
      />
      <LiquifySessionToolButton
        toolId={LiquifyToolId.TwirlClockwise}
        label={getLetter("liquify_twirl_right")}
        icon={<RotateCw size={32} strokeWidth={2.2} />}
        strokeIcon
      />
      <LiquifySessionToolButton
        toolId={LiquifyToolId.Bloat}
        label={getLetter("liquify_bloat")}
        icon={<Expand size={32} strokeWidth={2.2} />}
        strokeIcon
      />
      <LiquifySessionToolButton
        toolId={LiquifyToolId.Pucker}
        label={getLetter("liquify_pucker")}
        icon={<Shrink size={32} strokeWidth={2.2} />}
        strokeIcon
      />
      <LiquifySessionToolButton
        toolId={LiquifyToolId.Restore}
        label={getLetter("liquify_restore")}
        icon={<EraserIcon width={32} height={32} />}
      />

      <div className="div-bar"></div>
      <div className="brush-control-group">
        <BrushSizeSlider />
        <BrushAlphaSlider label={getLetter("liquify_strength")} />
      </div>
    </div>
  );
});

const LiquifySessionToolButton = observer(
  ({
    toolId,
    label,
    icon,
    strokeIcon = false,
  }: {
    toolId: LiquifyToolId;
    label: string;
    icon: ReactNode;
    strokeIcon?: boolean;
  }) => {
    const isSelected = paintState.getLiquifyToolId() === toolId;

    return (
      <button
        className={`select-button ${strokeIcon ? "stroke-icon-button" : ""} ${isSelected ? "selected" : ""}`}
        aria-label={label}
        onClick={() => toolManager.setLiquifyTool(toolId)}
      >
        {icon}
        <p>{label}</p>
      </button>
    );
  },
);

const MosaicMenuBar = observer(() => {
  return (
    <div id="menu-bar">
      <button
        className="select-button"
        aria-label={getLetter("apply")}
        onClick={() => toolManager.commitSession()}
      >
        <CircleCheck color="#16a34a" size={32} strokeWidth={2.4} />
        <p>{getLetter("apply")}</p>
      </button>
      <button
        className="select-button"
        aria-label={getLetter("cancel")}
        onClick={() => toolManager.discardSession()}
      >
        <CircleX color="#dc2626" size={32} strokeWidth={2.4} />
        <p>{getLetter("cancel")}</p>
      </button>

      <div className="div-bar"></div>

      <MosaicModeButton
        modeId={MosaicToolId.Pixel}
        label={getLetter("mosaic_pixel")}
        icon={<Grid2X2 size={32} strokeWidth={2.2} />}
        strokeIcon
      />
      <MosaicModeButton
        modeId={MosaicToolId.Blur}
        label={getLetter("mosaic_blur")}
        icon={<Waves size={32} strokeWidth={2.2} />}
        strokeIcon
      />
      <MosaicModeButton
        modeId={MosaicToolId.Restore}
        label={getLetter("mosaic_restore")}
        icon={<EraserIcon width={32} height={32} />}
      />

      <div className="div-bar"></div>
      <div className="brush-control-group">
        <BrushSizeSlider />
        <MosaicStrengthSlider />
      </div>
    </div>
  );
});

const MosaicModeButton = observer(
  ({
    modeId,
    label,
    icon,
    strokeIcon = false,
  }: {
    modeId: MosaicToolId;
    label: string;
    icon: ReactNode;
    strokeIcon?: boolean;
  }) => {
    const isSelected = paintState.getMosaicToolId() === modeId;

    return (
      <button
        className={`select-button ${strokeIcon ? "stroke-icon-button" : ""} ${isSelected ? "selected" : ""}`}
        aria-label={label}
        onClick={() => toolManager.setMosaicMode(modeId)}
      >
        {icon}
        <p>{label}</p>
      </button>
    );
  },
);

const HistoryButtons = observer(() => {
  const canUndo = historyState.getUndoCount() > 0;
  const canRedo = historyState.getRedoCount() > 0;

  return (
    <>
      <button
        aria-label="undo-button"
        className="header-button"
        disabled={!canUndo}
        onClick={undo}
      >
        {canUndo ? <UndoIcon /> : <UndoOffIcon />}
      </button>
      <button
        aria-label="redo-button"
        className="header-button"
        disabled={!canRedo}
        onClick={redo}
      >
        {canRedo ? <RedoIcon /> : <RedoOffIcon />}
      </button>
    </>
  );
});

const SelectionToolButton = observer(() => {
  const isSelected =
    paintState.getSelectedToolId() === ToolId.Select ||
    paintState.getSelectedToolId() === ToolId.Selection;

  return (
    <button
      id="select-selection"
      className={`select-button ${isSelected ? "selected" : ""}`}
      onClick={() => toolManager.setSelectTool()}
    >
      <SelectionIcon width={32} height={32} />
      <p>{getLetter("select")}</p>
    </button>
  );
});

const BrushToolButton = observer(() => {
  const isSelected =
    paintState.getSelectedToolId() === ToolId.Brush &&
    paintState.getBrushId() === BrushId.Brush;

  return (
    <button
      id="select-brush"
      className={`select-button ${isSelected ? "selected" : ""}`}
      onClick={() => toolManager.setBrushTool()}
    >
      <BrushIcon width={32} height={32} />
      <p>{getLetter("brush")}</p>
    </button>
  );
});

const EraserToolButton = observer(() => {
  const isSelected =
    paintState.getSelectedToolId() === ToolId.Brush &&
    paintState.getBrushId() === BrushId.Eraser;

  return (
    <button
      id="select-eraser"
      className={`select-button ${isSelected ? "selected" : ""}`}
      onClick={() => toolManager.setEraserTool()}
    >
      <EraserIcon width={32} height={32} />
      <p>{getLetter("eraser")}</p>
    </button>
  );
});

const LiquifyToolButton = observer(() => {
  const isSelected =
    paintState.getSessionMode() &&
    paintState.getSessionId() === SessionId.Liquify;

  return (
    <button
      id="select-liquify"
      className={`select-button ${isSelected ? "selected" : ""}`}
      onClick={() => toolManager.setLiquifyTool()}
    >
      <LiquifyIcon width={32} height={32} />
      <p>{getLetter("liquify")}</p>
    </button>
  );
});

const MosaicToolButton = observer(() => {
  const isSelected =
    paintState.getSessionMode() &&
    paintState.getSessionId() === SessionId.Mosaic;

  return (
    <button
      id="select-mosaic"
      className={`select-button ${isSelected ? "selected" : ""}`}
      onClick={() => toolManager.setMosaicTool()}
    >
      <Grid2X2 size={32} strokeWidth={2.2} />
      <p>{getLetter("mosaic")}</p>
    </button>
  );
});

const ZoomToolButton = observer(() => {
  const isSelected = paintState.getSelectedToolId() === ToolId.Zoom;

  return (
    <button
      id="select-zoom"
      className={`select-mini ${isSelected ? "selected" : ""}`}
      aria-label="zoom"
      onClick={() => toolManager.setZoomTool()}
    >
      <Search
        color={isSelected ? "#3587ff" : "#222222"}
        size={20}
        strokeWidth={2.2}
      />
    </button>
  );
});

const ColorPickerToolButton = observer(() => {
  const isSelected = paintState.getSelectedToolId() === ToolId.ColorPicker;

  return (
    <button
      id="select-color-picker"
      className={`select-mini ${isSelected ? "selected" : ""}`}
      aria-label={getLetter("color_picker")}
      onClick={() => toolManager.setColorPickerTool()}
    >
      <Pipette
        color={isSelected ? "#3587ff" : "#222222"}
        size={20}
        strokeWidth={2.2}
      />
    </button>
  );
});
