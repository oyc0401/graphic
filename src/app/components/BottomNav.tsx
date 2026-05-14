import { useEffect, useState } from "react";
import { isSmallSize } from "../utils/screen";
import { BrushId, paintState, ToolId } from "../paintState";
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

export function BottomNav() {
  const [isMobile, setIsMobile] = useState(isSmallSize());

  useEffect(() => {
    const checkWidth = () => setIsMobile(isSmallSize());
    checkWidth(); // 초기 체크
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  if (!isMobile) {
    return <></>;
  }

  return (
    <>
      {/* <div style={{ height: 44, width: "100%" }}></div>
      <div id="navigation">
        <div className="mobile-navigation">
          <BrushToolButton />
          <EraserToolButton />
          <div style={{ flex: 1 }} />
          <MobileColorIndicatorButton />
        </div>
      </div> */}
    </>
  );
}

const BrushToolButton = observer(() => {
  const isSelected =
    paintState.getToolId() === ToolId.Brush && paintState.getBrushId() === BrushId.Brush;

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
    paintState.getToolId() === ToolId.Brush && paintState.getBrushId() === BrushId.Eraser;

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
