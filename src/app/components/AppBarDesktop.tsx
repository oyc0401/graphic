import {
  BrushId,
  LiquifyToolId,
  MosaicToolId,
  paintState,
  ShapeId,
  SessionId,
  ToolId,
} from "../paintState";
import { toolManager } from "../tools/toolManager";
import { hexToRgb } from "../utils/color";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState, type ReactNode } from "react";

import UndoIcon from "../assets/undo.svg?react";
import RedoIcon from "../assets/redo.svg?react";
import UndoOffIcon from "../assets/undo_disabled.svg?react";
import RedoOffIcon from "../assets/redo_disabled.svg?react";

import BrushIcon from "../assets/brush.svg?react";
import EraserIcon from "../assets/eraser.svg?react";
import LiquifyIcon from "../assets/liquify.svg?react";
import SelectionIcon from "../assets/select_rectangle.svg?react";

import { ColorIndicatorButton, MainMenuToggleButton } from "./dropdown";
import { SavedAtButton } from "./SavedAtButton";
import { DrawingNameInput } from "./DrawingNameInput";
import { colorState } from "../colorState";
import { historyState, redo, undo } from "../history";
import { getLetter } from "../i18n/language";
import { useClickOutside, useDropdownPosition } from "./menu-hooks";
import {
  ChevronDown,
  CircleCheck,
  CircleX,
  Expand,
  Grid2X2,
  LassoSelect,
  PaintBucket,
  Pencil as PencilIcon,
  Pipette,
  RotateCcw,
  RotateCw,
  Search,
  Square,
  Circle as CircleIcon,
  Shrink,
  Waves,
} from "lucide-react";
import {
  BrushAlphaSlider,
  BrushSizeSlider,
  FloodFillToleranceSlider,
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
          <DrawingNameInput />

          <div style={{ flex: 1 }} />
          <SavedAtButton />
          <HistoryButtons />
        </div>

        {/* ===== 툴바 ===== */}
        {paintState.getSessionId() !== null ? (
          paintState.getSessionId() === SessionId.Mosaic ? (
            <MosaicMenuBar />
          ) : (
            <LiquifyMenuBar />
          )
        ) : (
          <div id="menu-bar">
            <SelectionSplitButton />
            <ShapeSplitButton />

            <div className="div-bar"></div>
            <div className="mini-buttons">
              <FloodFillToolButton />
              <ZoomToolButton />
              <ColorPickerToolButton />
              <PencilToolButton />
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
              {paintState.getSelectedToolId() === ToolId.FloodFill ? (
                <FloodFillToleranceSlider />
              ) : (
                <BrushSizeSlider />
              )}

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
        onClick={() => toolManager.setMosaicTool(modeId)}
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

type SplitOption = {
  label: string;
  icon: (size: number) => ReactNode;
  strokeIcon?: boolean;
  isActive: boolean;
  activate: () => void;
};

/** 그림판식 스플릿 버튼 — 메인 버튼 + 아래 화살표 드롭다운. 마지막으로 쓴 모드를 메인 버튼이 유지한다. */
function SplitToolButton({
  id,
  options,
}: {
  id?: string;
  options: SplitOption[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [lastIdx, setLastIdx] = useState(0);

  const activeIdx = options.findIndex((o) => o.isActive);
  const mode = options[activeIdx >= 0 ? activeIdx : lastIdx];

  useEffect(() => {
    if (activeIdx >= 0) setLastIdx(activeIdx);
  }, [activeIdx]);

  useClickOutside([menuRef, wrapRef], () => setOpen(false));
  useDropdownPosition(wrapRef, menuRef, open, { offsetY: 4 });

  const pick = (option: SplitOption) => {
    option.activate();
    setOpen(false);
  };

  return (
    <>
      <div
        className={`select-split ${activeIdx >= 0 ? "selected" : ""}`}
        ref={wrapRef}
      >
        <button
          type="button"
          id={id}
          className={`select-button select-split-main ${mode.strokeIcon ? "stroke-icon-button" : ""} ${activeIdx >= 0 ? "selected" : ""}`}
          onClick={() => pick(mode)}
        >
          {mode.icon(32)}
          <p>{mode.label}</p>
        </button>
        <button
          type="button"
          className="select-split-arrow"
          aria-label={`${mode.label} ▾`}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronDown size={14} strokeWidth={2.2} />
        </button>
      </div>

      {open && (
        <div className="sub-menu" ref={menuRef}>
          {options.map((option) => (
            <button
              type="button"
              key={option.label}
              onClick={() => pick(option)}
            >
              <div className="menu-button-content">
                {option.icon(20)}
                <p>{option.label}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

const SelectionSplitButton = observer(() => {
  const tool = paintState.getSelectedToolId();

  return (
    <SplitToolButton
      id="select-selection"
      options={[
        {
          label: getLetter("select"),
          icon: (size) => <SelectionIcon width={size} height={size} />,
          isActive: tool === ToolId.Select,
          activate: () => toolManager.setSelectTool(),
        },
        {
          label: getLetter("freeform_select"),
          icon: (size) => <LassoSelect size={size} strokeWidth={2.2} />,
          strokeIcon: true,
          isActive: tool === ToolId.FreeformSelect,
          activate: () => toolManager.setFreeformSelectTool(),
        },
      ]}
    />
  );
});

const ShapeSplitButton = observer(() => {
  const isShapeTool = paintState.getSelectedToolId() === ToolId.Shape;
  const shapeId = paintState.getShapeId();

  return (
    <SplitToolButton
      id="select-shape"
      options={[
        {
          label: getLetter("shape_rect"),
          icon: (size) => <Square size={size} strokeWidth={2.2} />,
          strokeIcon: true,
          isActive: isShapeTool && shapeId === ShapeId.Rect,
          activate: () => toolManager.setShapeTool(ShapeId.Rect),
        },
        {
          label: getLetter("shape_ellipse"),
          icon: (size) => <CircleIcon size={size} strokeWidth={2.2} />,
          strokeIcon: true,
          isActive: isShapeTool && shapeId === ShapeId.Ellipse,
          activate: () => toolManager.setShapeTool(ShapeId.Ellipse),
        },
      ]}
    />
  );
});

const FloodFillToolButton = observer(() => {
  const isSelected = paintState.getSelectedToolId() === ToolId.FloodFill;

  return (
    <button
      id="select-flood-fill"
      className="select-mini"
      aria-label={getLetter("flood_fill")}
      onClick={() => toolManager.setFloodFillTool()}
      style={{ background: isSelected ? "#f5f5f5" : "transparent" }}
    >
      <PaintBucket
        color={isSelected ? "#3587ff" : "#222222"}
        size={20}
        strokeWidth={2.2}
        style={{ fill: "none", stroke: isSelected ? "#3587ff" : "#222222" }}
      />
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

const PencilToolButton = observer(() => {
  const isSelected =
    paintState.getSelectedToolId() === ToolId.Brush &&
    paintState.getBrushId() === BrushId.Pencil;

  return (
    <button
      type="button"
      id="select-pencil"
      className="select-mini"
      aria-label={getLetter("pencil")}
      onClick={() => toolManager.setPencilTool()}
      style={{ background: isSelected ? "#f5f5f5" : "transparent" }}
    >
      <PencilIcon
        color={isSelected ? "#3587ff" : "#222222"}
        size={20}
        strokeWidth={2.2}
        style={{ fill: "none", stroke: isSelected ? "#3587ff" : "#222222" }}
      />
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
  const isSelected = paintState.getSessionId() === SessionId.Liquify;

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
  const isSelected = paintState.getSessionId() === SessionId.Mosaic;

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
      className="select-mini"
      aria-label="zoom"
      onClick={() => toolManager.setZoomTool()}
      style={{ background: isSelected ? "#f5f5f5" : "transparent" }}
    >
      <Search
        color={isSelected ? "#3587ff" : "#222222"}
        size={20}
        strokeWidth={2.2}
        style={{ fill: "none", stroke: isSelected ? "#3587ff" : "#222222" }}
      />
    </button>
  );
});

const ColorPickerToolButton = observer(() => {
  const isSelected = paintState.getSelectedToolId() === ToolId.ColorPicker;

  return (
    <button
      id="select-color-picker"
      className="select-mini"
      aria-label={getLetter("color_picker")}
      onClick={() => toolManager.setColorPickerTool()}
      style={{ background: isSelected ? "#f5f5f5" : "transparent" }}
    >
      <Pipette
        color={isSelected ? "#3587ff" : "#222222"}
        size={20}
        strokeWidth={2.2}
        style={{ fill: "none", stroke: isSelected ? "#3587ff" : "#222222" }}
      />
    </button>
  );
});
