/* src/components/AppBar.jsx */
import React from "react";
import { paintState } from "../paintState";
import { toolManager } from "../draw";
import { menuState } from "../ui/menuState";
import { hexToRgb, rgbToHex } from "../utils/color";
import { downloadImage, openFile, resetImage } from "../file";
import { observer } from "mobx-react-lite";
// AppBar.jsx 상단
import MenuIcon from "../assets/menu.svg?react";
import UndoIcon from "../assets/undo.svg?react";
import RedoIcon from "../assets/redo_disabled.svg?react";

import BrushIcon from "../assets/brush.svg?react";
import EraserIcon from "../assets/eraser.svg?react";
import LiquifyIcon from "../assets/liquify.svg?react";
import SelectionIcon from "../assets/select_rectangle.svg?react";

import NewIcon from "../assets/new.svg?react";
import OpenIcon from "../assets/open.svg?react";
import SaveIcon from "../assets/save.svg?react";
import { useRef, useEffect } from "react";

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

const MainMenuToggleButton = observer(() => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuState.showMenu) return;

    const handleClickOutside = (e: PointerEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        menuState.setShowMenu(false);
      }
    };

    document.addEventListener("pointerdown", handleClickOutside);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
    };
  }, [menuState.showMenu]);

  const toggleMenu = () => {
    menuState.setShowMenu(!menuState.showMenu);
  };

  return (
    <>
      <button
        id="menu-button"
        className="header-button"
        onClick={toggleMenu}
        ref={buttonRef}
      >
        <MenuIcon />
      </button>

      {menuState.showMenu && (
        <div id="main-menu" ref={menuRef}>
          <button id="new-button" onClick={resetImage}>
            <NewIcon /> <p>새로 만들기</p>
          </button>
          <button id="open-button" onClick={openFile}>
            <OpenIcon /> <p>열기</p>
          </button>
          <button id="save-button" onClick={downloadImage}>
            <SaveIcon />
            <p>저장</p>
          </button>
        </div>
      )}
    </>
  );
});

export default function AppBar() {
  /** 선택 툴 버튼 콜백 */
  const selectTool = (id) => {
    switch (id) {
      case "brush":
        toolManager.setBrushTool();
        break;
      case "eraser":
        toolManager.setEraserTool();
        break;
      case "liquify":
        toolManager.setLiquifyTool();
        break;
      case "select":
        toolManager.setSelectTool();
        break;
      default:
        break;
    }
  };

  /** 색상 팔레트 콜백 */
  const chooseColor = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    paintState.setColor(r, g, b);
  };

  // --------------------------- JSX ---------------------------
  return (
    <div id="appbar">
      {/* ===== 헤더 ===== */}
      <div id="header">
        <MainMenuToggleButton  />

        <div className="flex-1" />

        <button id="undo-button" className="header-button">
          <UndoIcon />
        </button>
        <button id="redo-button" className="header-button">
          <RedoIcon />
        </button>

        {/* <MainMenu /> */}
      </div>

      {/* ===== 툴바 ===== */}
      <div id="menu-bar">
        <SelectionToolButton />

        <div className="div-bar"></div>
        <div className="mini-buttons">
          <LiquifyToolButton />
          <button className="select-mini"></button>
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
                    border: hex === "#FFFFFF" ? "1px solid #E3E3E3" : undefined,
                  }}
                />
              </div>
            ))}
          </div>

          <ColorIndicatorButton />
        </div>
      </div>
    </div>
  );
}

const SelectionToolButton = observer(() => {
  const isSelected =
    paintState.toolId === "select" || paintState.toolId === "selection";

  return (
    <button
      id="select-selection"
      className={`select-button ${isSelected ? "selected" : ""}`}
      onClick={() => toolManager.setSelectTool()}
    >
      <SelectionIcon />
      <p>선택</p>
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
      <BrushIcon />
      <p>브러시</p>
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
      <EraserIcon />
      <p>지우개</p>
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
            paintState.setBrushSize(positionToSize(e.target.value / 1000));
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

const ColorIndicatorButton = observer(() => {
  const colorHex = rgbToHex(paintState.getColor());

  return (
    <button id="choose-color" className="select-button">
      <div
        id="color-icon"
        className="button-icon"
        style={{ background: colorHex }}
      />
      <p>색</p>
    </button>
  );
});
