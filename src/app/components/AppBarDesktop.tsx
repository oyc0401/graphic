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

import { ColorIndicatorButton, MainMenuToggleButton } from "./dropdown";
import { colorState } from "../colorState";
import { historyState, redo, undo } from "../history";
import { getLetter } from "../i18n/language";

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

export default function AppBarDesktop() {
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
        <div id="menu-bar">
          <SelectionToolButton />

          <div className="div-bar"></div>
          <div className="mini-buttons">
            <LiquifyToolButton />
          </div>
          <div className="div-bar"></div>

          <BrushToolButton />
          <EraserToolButton />
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
      </div>
    </>
  );
}

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

const SelectionToolButton = observer(() => {
  const isSelected =
    paintState.toolId === "select" || paintState.toolId === "selection";

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
    paintState.toolId === "brush" && paintState.brushId === "brush";

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
    paintState.toolId === "brush" && paintState.brushId === "eraser";

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
    paintState.toolId === "brush" && paintState.brushId === "liquify";

  return (
    <button
      id="select-liquify"
      className={`select-mini ${isSelected ? "selected" : ""}`}
      onClick={() => toolManager.setLiquifyTool()}
    >
      <LiquifyIcon width={20} height={20} />
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
      <p className="label">{getLetter("size")}</p>
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
      <p className="label">{getLetter("opacity")}</p>
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
