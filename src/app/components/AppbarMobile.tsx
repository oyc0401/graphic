import "./mobile.css";
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

import UndoIcon from "../assets/undo.svg?react";
import RedoIcon from "../assets/redo.svg?react";
import UndoOffIcon from "../assets/undo_disabled.svg?react";
import RedoOffIcon from "../assets/redo_disabled.svg?react";

import BrushIcon from "../assets/brush.svg?react";
import EraserIcon from "../assets/eraser.svg?react";
import LiquifyIcon from "../assets/liquify.svg?react";
import SelectionIcon from "../assets/select_rectangle.svg?react";

import {
  ColorIndicatorButton,
  MainMenuToggleButton,
  MobileColorIndicatorButton,
} from "./dropdown";
import { colorState } from "../colorState";
import { historyState, redo, undo } from "../history";
import { useClickOutside, useDropdownPosition } from "./menu-hooks";
import { menuState } from "../ui/menuState";
import { useRef, type ReactNode } from "react";
import { getLetter } from "../i18n/language";
import {
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

function AppBarMobile() {
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
          height: 44,
          width: "100%",
        }}
      ></div>
      <div id="appbar">
        {/* ===== 헤더 ===== */}
        {paintState.getSessionId() !== null ? (
          paintState.getSessionId() === SessionId.Mosaic ? (
            <MosaicMobileAppBar />
          ) : (
            <LiquifyMobileAppBar />
          )
        ) : (
          <div className="mobile-appbar">
            <MainMenuToggleButton />
            <ToolsToggleButton />

            <div style={{ flex: 1 }} />

            <SizeToggleButton />
            <BrushToolButton />
            <PencilToolButton />
            <EraserToolButton />

            <MobileColorIndicatorButton />
          </div>
        )}
      </div>
    </>
  );
}

export default observer(AppBarMobile);

const LiquifyMobileAppBar = observer(() => {
  return (
    <div className="mobile-appbar">
      <button
        className="header-button"
        aria-label={getLetter("apply")}
        onClick={() => toolManager.commitSession()}
      >
        <CircleCheck color="#16a34a" size={24} strokeWidth={2.4} />
      </button>
      <button
        className="header-button"
        aria-label={getLetter("cancel")}
        onClick={() => toolManager.discardSession()}
      >
        <CircleX color="#dc2626" size={24} strokeWidth={2.4} />
      </button>
      <div className="mobile-div-bar"></div>
      <LiquifySessionToolButton
        toolId={LiquifyToolId.Push}
        label={getLetter("liquify_push")}
        icon={<LiquifyIcon />}
      />
      <LiquifySessionToolButton
        toolId={LiquifyToolId.TwirlCounterClockwise}
        label={getLetter("liquify_twirl_left")}
        icon={<RotateCcw size={24} strokeWidth={2.2} />}
        strokeIcon
      />
      <LiquifySessionToolButton
        toolId={LiquifyToolId.TwirlClockwise}
        label={getLetter("liquify_twirl_right")}
        icon={<RotateCw size={24} strokeWidth={2.2} />}
        strokeIcon
      />
      <LiquifySessionToolButton
        toolId={LiquifyToolId.Bloat}
        label={getLetter("liquify_bloat")}
        icon={<Expand size={24} strokeWidth={2.2} />}
        strokeIcon
      />
      <LiquifySessionToolButton
        toolId={LiquifyToolId.Pucker}
        label={getLetter("liquify_pucker")}
        icon={<Shrink size={24} strokeWidth={2.2} />}
        strokeIcon
      />
      <LiquifySessionToolButton
        toolId={LiquifyToolId.Restore}
        label={getLetter("liquify_restore")}
        icon={<EraserIcon width={24} height={24} />}
      />
      <SizeToggleButton />
      <div style={{ flex: 1 }} />
      <HistoryButtons />
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
        className={`header-button ${strokeIcon ? "stroke-icon-button" : ""} ${isSelected ? "selected" : ""}`}
        aria-label={label}
        onClick={() => toolManager.setLiquifyTool(toolId)}
      >
        {icon}
      </button>
    );
  },
);

const MosaicMobileAppBar = observer(() => {
  return (
    <div className="mobile-appbar">
      <button
        className="header-button"
        aria-label={getLetter("apply")}
        onClick={() => toolManager.commitSession()}
      >
        <CircleCheck color="#16a34a" size={24} strokeWidth={2.4} />
      </button>
      <button
        className="header-button"
        aria-label={getLetter("cancel")}
        onClick={() => toolManager.discardSession()}
      >
        <CircleX color="#dc2626" size={24} strokeWidth={2.4} />
      </button>
      <div className="mobile-div-bar"></div>
      <MosaicModeButton
        modeId={MosaicToolId.Pixel}
        label={getLetter("mosaic_pixel")}
        icon={<Grid2X2 size={24} strokeWidth={2.2} />}
        strokeIcon
      />
      <MosaicModeButton
        modeId={MosaicToolId.Blur}
        label={getLetter("mosaic_blur")}
        icon={<Waves size={24} strokeWidth={2.2} />}
        strokeIcon
      />
      <MosaicModeButton
        modeId={MosaicToolId.Restore}
        label={getLetter("mosaic_restore")}
        icon={<EraserIcon width={24} height={24} />}
      />
      <SizeToggleButton />
      <div style={{ flex: 1 }} />
      <HistoryButtons />
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
        className={`header-button ${strokeIcon ? "stroke-icon-button" : ""} ${isSelected ? "selected" : ""}`}
        aria-label={label}
        onClick={() => toolManager.setMosaicTool(modeId)}
      >
        {icon}
      </button>
    );
  },
);

const ToolsToggleButton = observer(() => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useDropdownPosition(buttonRef, menuRef, menuState.showTools, {
    padding: 0,
  });

  const toggleMenu = () => {
    menuState.setShowTools(!menuState.showTools);
  };

  return (
    <>
      <button
        aria-label="tools-button"
        className="tools-button"
        onClick={toggleMenu}
        ref={buttonRef}
      >
        <p className={`${menuState.showTools ? "selected" : ""}`}>
          {getLetter("tools")}
        </p>
      </button>

      {menuState.showTools && (
        <div className="tools-bar" ref={menuRef}>
          <SelectionToolButton />
          <FreeformSelectionToolButton />
          <ShapeToolButton shapeId={ShapeId.Rect} />
          <ShapeToolButton shapeId={ShapeId.Ellipse} />
          <FloodFillToolButton />
          <LiquifyToolButton />
          <MosaicToolButton />
          <ZoomToolButton />
          <ColorPickerToolButton />
          <div style={{ flex: 1 }} />
          <HistoryButtons />
        </div>
      )}
    </>
  );
});

const SizeToggleButton = observer(() => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 메뉴 닫기
  useClickOutside([menuRef, buttonRef], () => {
    if (menuState.showSizeBar) {
      menuState.setShowSizeBar(false);
    }
  });

  useDropdownPosition(buttonRef, menuRef, menuState.showSizeBar, {
    padding: 0,
  });

  const toggleMenu = () => {
    menuState.setShowSizeBar(!menuState.showSizeBar);
  };

  return (
    <>
      <button
        aria-label="size-button"
        className="size-button"
        onClick={toggleMenu}
        ref={buttonRef}
      >
        {/* <p>{`${fixedNumber(paintState.getBrushSize())}px`}</p> */}
      </button>

      {menuState.showSizeBar && (
        <div className="size-bar" ref={menuRef}>
          {paintState.getSelectedToolId() === ToolId.FloodFill ? (
            <FloodFillToleranceSlider />
          ) : (
            <BrushSizeSlider />
          )}
          {paintState.getSessionId() === SessionId.Mosaic ? (
            <MosaicStrengthSlider />
          ) : (
            <BrushAlphaSlider />
          )}
        </div>
      )}
    </>
  );
});

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

const BrushToolButton = observer(() => {
  const isSelected =
    paintState.getSelectedToolId() === ToolId.Brush &&
    paintState.getBrushId() === BrushId.Brush;

  const toggleMenu = () => {
    menuState.setShowSizeBar(!menuState.showSizeBar);
  };

  const onClick = () => {
    toolManager.setBrushTool();
    toggleMenu();
  };

  return (
    <button
      id="select-brush"
      className={`header-button ${isSelected ? "selected" : ""}`}
      onClick={onClick}
    >
      <BrushIcon width={24} height={24} />
    </button>
  );
});

const PencilToolButton = observer(() => {
  const isSelected =
    paintState.getSelectedToolId() === ToolId.Brush &&
    paintState.getBrushId() === BrushId.Pencil;

  const toggleMenu = () => {
    menuState.setShowSizeBar(!menuState.showSizeBar);
  };

  const onClick = () => {
    toolManager.setPencilTool();
    toggleMenu();
  };

  return (
    <button
      id="select-pencil"
      className={`header-button stroke-icon-button ${isSelected ? "selected" : ""}`}
      onClick={onClick}
    >
      <PencilIcon size={24} strokeWidth={2.2} />
    </button>
  );
});

const EraserToolButton = observer(() => {
  const isSelected =
    paintState.getSelectedToolId() === ToolId.Brush &&
    paintState.getBrushId() === BrushId.Eraser;

  const toggleMenu = () => {
    menuState.setShowSizeBar(!menuState.showSizeBar);
  };

  const onClick = () => {
    toolManager.setEraserTool();
    toggleMenu();
  };

  return (
    <>
      <button
        id="select-eraser"
        className={`header-button ${isSelected ? "selected" : ""}`}
        onClick={onClick}
      >
        <EraserIcon width={24} height={24} />
      </button>
    </>
  );
});

const SelectionToolButton = observer(() => {
  const isSelected = paintState.getSelectedToolId() === ToolId.Select;

  return (
    <button
      id="select-selection"
      className={`header-button ${isSelected ? "selected" : ""}`}
      onClick={() => toolManager.setSelectTool()}
    >
      <SelectionIcon />
    </button>
  );
});

const FreeformSelectionToolButton = observer(() => {
  const isSelected = paintState.getSelectedToolId() === ToolId.FreeformSelect;

  return (
    <button
      id="select-freeform-selection"
      aria-label={getLetter("freeform_select")}
      className={`header-button stroke-icon-button ${isSelected ? "selected" : ""}`}
      onClick={() => toolManager.setFreeformSelectTool()}
    >
      <LassoSelect size={24} strokeWidth={2.2} />
    </button>
  );
});

const ShapeToolButton = observer(({ shapeId }: { shapeId: ShapeId }) => {
  const isSelected =
    paintState.getSelectedToolId() === ToolId.Shape &&
    paintState.getShapeId() === shapeId;
  const label =
    shapeId === ShapeId.Rect ? getLetter("shape_rect") : getLetter("shape_ellipse");
  const icon =
    shapeId === ShapeId.Rect ? (
      <Square size={24} strokeWidth={2.2} />
    ) : (
      <CircleIcon size={24} strokeWidth={2.2} />
    );

  return (
    <button
      aria-label={label}
      className={`header-button stroke-icon-button ${isSelected ? "selected" : ""}`}
      onClick={() => toolManager.setShapeTool(shapeId)}
    >
      {icon}
    </button>
  );
});

const FloodFillToolButton = observer(() => {
  const isSelected = paintState.getSelectedToolId() === ToolId.FloodFill;

  return (
    <button
      id="select-flood-fill"
      aria-label={getLetter("flood_fill")}
      className={`header-button stroke-icon-button ${isSelected ? "selected" : ""}`}
      onClick={() => {
        toolManager.setFloodFillTool();
        menuState.setShowTools(false);
      }}
    >
      <PaintBucket size={24} strokeWidth={2.2} />
    </button>
  );
});

const LiquifyToolButton = observer(() => {
  const isSelected = paintState.getSessionId() === SessionId.Liquify;

  const toggleMenu = () => {
    menuState.setShowSizeBar(!menuState.showSizeBar);
  };

  const onClick = () => {
    toolManager.setLiquifyTool();
    toggleMenu();
  };

  return (
    <button
      id="select-liquify"
      className={`header-button ${isSelected ? "selected" : ""}`}
      onClick={onClick}
    >
      <LiquifyIcon />
    </button>
  );
});

const MosaicToolButton = observer(() => {
  const isSelected = paintState.getSessionId() === SessionId.Mosaic;

  const toggleMenu = () => {
    menuState.setShowSizeBar(!menuState.showSizeBar);
  };

  const onClick = () => {
    toolManager.setMosaicTool();
    toggleMenu();
  };

  return (
    <button
      id="select-mosaic"
      className={`header-button ${isSelected ? "selected" : ""}`}
      aria-label={getLetter("mosaic")}
      onClick={onClick}
    >
      <Grid2X2 size={24} strokeWidth={2.2} />
    </button>
  );
});

const ZoomToolButton = observer(() => {
  const isSelected = paintState.getSelectedToolId() === ToolId.Zoom;

  return (
    <button
      id="select-zoom"
      className="header-button"
      aria-label="zoom"
      onClick={() => {
        toolManager.setZoomTool();
        menuState.setShowTools(false);
      }}
      style={{ background: "transparent", color: isSelected ? "#3587ff" : "#222222" }}
    >
      <Search
        color={isSelected ? "#3587ff" : "#222222"}
        size={24}
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
      className="header-button"
      aria-label={getLetter("color_picker")}
      onClick={() => {
        toolManager.setColorPickerTool();
        menuState.setShowTools(false);
      }}
      style={{ background: "transparent", color: isSelected ? "#3587ff" : "#222222" }}
    >
      <Pipette
        color={isSelected ? "#3587ff" : "#222222"}
        size={24}
        strokeWidth={2.2}
        style={{ fill: "none", stroke: isSelected ? "#3587ff" : "#222222" }}
      />
    </button>
  );
});
