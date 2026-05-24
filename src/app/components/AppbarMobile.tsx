import "./mobile.css";
import {
  BrushId,
  LiquifyToolId,
  MosaicModeId,
  paintState,
  SessionId,
  ToolId,
} from "../paintState";
import { toolManager } from "../draw";
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
import { CircleCheck, CircleX, Expand, Grid2X2, Pipette, RotateCcw, RotateCw, Search, Shrink, Waves } from "lucide-react";
import { BrushAlphaSlider, BrushSizeSlider } from "./BrushSliders";

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
        {paintState.getSessionMode() ? (
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
        modeId={MosaicModeId.Pixel}
        label={getLetter("mosaic_pixel")}
        icon={<Grid2X2 size={24} strokeWidth={2.2} />}
      />
      <MosaicModeButton
        modeId={MosaicModeId.Blur}
        label={getLetter("mosaic_blur")}
        icon={<Waves size={24} strokeWidth={2.2} />}
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
  }: {
    modeId: MosaicModeId;
    label: string;
    icon: ReactNode;
  }) => {
    const isSelected = paintState.getMosaicModeId() === modeId;

    return (
      <button
        className={`header-button stroke-icon-button ${isSelected ? "selected" : ""}`}
        aria-label={label}
        onClick={() => toolManager.setMosaicMode(modeId)}
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
          <BrushSizeSlider />
          <BrushAlphaSlider
            label={
              paintState.getSessionMode() &&
              paintState.getSessionId() === SessionId.Mosaic
                ? getLetter("mosaic_strength")
                : undefined
            }
          />
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
  const isSelected =
    paintState.getSelectedToolId() === ToolId.Select ||
    paintState.getSelectedToolId() === ToolId.Selection;

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

const LiquifyToolButton = observer(() => {
  const isSelected =
    paintState.getSessionMode() && paintState.getSessionId() === SessionId.Liquify;

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
  const isSelected =
    paintState.getSessionMode() && paintState.getSessionId() === SessionId.Mosaic;

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
      className={`header-button ${isSelected ? "selected" : ""}`}
      aria-label="zoom"
      onClick={() => {
        toolManager.setZoomTool();
        menuState.setShowTools(false);
      }}
    >
      <Search
        color={isSelected ? "#3587ff" : "#222222"}
        size={24}
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
      className={`header-button ${isSelected ? "selected" : ""}`}
      aria-label={getLetter("color_picker")}
      onClick={() => {
        toolManager.setColorPickerTool();
        menuState.setShowTools(false);
      }}
    >
      <Pipette
        color={isSelected ? "#3587ff" : "#222222"}
        size={24}
        strokeWidth={2.2}
      />
    </button>
  );
});
