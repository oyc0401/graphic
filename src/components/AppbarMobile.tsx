import "./mobile.css";
import { paintState } from "../paintState";
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
import { useRef } from "react";

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

export default function AppBarMobile() {
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
        <div className="mobile-appbar">
          <MainMenuToggleButton />
          <ToolsToggleButton />

          <div style={{ flex: 1 }} />

          <BrushToolButton />
          <EraserToolButton />

          <MobileColorIndicatorButton />
        </div>
      </div>
    </>
  );
}

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
        <p className={`${menuState.showTools ? "selected" : ""}`}>도구</p>
      </button>

      {menuState.showTools && (
        <div className="tools-bar" ref={menuRef}>
          <SelectionToolButton />
          <LiquifyToolButton />
          <div style={{ flex: 1 }} />
          <HistoryButtons />
        </div>
      )}
    </>
  );
});

const HistoryButtons = observer(() => {
  return (
    <>
      <button aria-label="undo-button" className="header-button" onClick={undo}>
        {historyState.getUndoCount() === 0 ? <UndoOffIcon /> : <UndoIcon />}
      </button>
      <button aria-label="redo-button" className="header-button" onClick={redo}>
        {historyState.getRedoCount() === 0 ? <RedoOffIcon /> : <RedoIcon />}
      </button>
    </>
  );
});

const BrushToolButton = observer(() => {
  const isSelected =
    paintState.toolId === "brush" && paintState.brushId === "brush";

  return (
    <button
      id="select-brush"
      className={`header-button ${isSelected ? "selected" : ""}`}
      onClick={() => toolManager.setBrushTool()}
    >
      <BrushIcon width={24} height={24} />
    </button>
  );
});

const EraserToolButton = observer(() => {
  const isSelected =
    paintState.toolId === "brush" && paintState.brushId === "eraser";

  return (
    <button
      id="select-eraser"
      className={`header-button ${isSelected ? "selected" : ""}`}
      onClick={() => toolManager.setEraserTool()}
    >
      <EraserIcon width={24} height={24} />
    </button>
  );
});

const SelectionToolButton = observer(() => {
  const isSelected =
    paintState.toolId === "select" || paintState.toolId === "selection";

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
    paintState.toolId === "brush" && paintState.brushId === "liquify";

  return (
    <button
      id="select-liquify"
      className={`header-button ${isSelected ? "selected" : ""}`}
      onClick={() => toolManager.setLiquifyTool()}
    >
      <LiquifyIcon />
    </button>
  );
});

function fixedNumber(number) {
  let sizeText = number.toFixed(1);
  if (sizeText.endsWith(".0")) {
    sizeText = sizeText.slice(0, -2);
  }
  return sizeText;
}

const BrushSizeSlider = observer(() => {
  const sliderValue = sizeToPosition(paintState.getBrushSize()); // ✅ 초기 값 계산

  return (
    <label className="brush-control">
      <p className="label">크기</p>
      <p className="value">{`${fixedNumber(paintState.getBrushSize())}px`}</p>
      <div className="slider-area">
        <input
          id="size-slider"
          type="range"
          min="1"
          max="1000"
          onChange={(e) => {
            paintState.setBrushSize(positionToSize(+e.target.value / 1000));
          }}
          value={sliderValue}
          className="slider"
        />
      </div>
    </label>
  );
});

const BrushAlphaSlider = observer(() => {
  return (
    <label className="brush-control">
      <p className="label">투명도</p>
      <p className="value">{paintState.getBrushAlpha()}%</p>
      <div className="slider-area">
        <input
          id="opacity-slider"
          type="range"
          min="1"
          max="100"
          value={paintState.getBrushAlpha()} // ✅ 상태 반영
          onChange={(e) => paintState.setBrushAlpha(+e.target.value)}
          className="slider"
        />
      </div>
    </label>
  );
});

function positionToSize(pos: number): number {
  const min = 1;
  const max = 3000;
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  const logValue = logMin + (logMax - logMin) * pos;
  return Math.exp(logValue);
}

function sizeToPosition(size: number): number {
  const min = 1;
  const max = 3000;
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  return ((Math.log(size) - logMin) / (logMax - logMin)) * 1000;
}
