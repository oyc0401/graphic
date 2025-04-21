/* src/components/AppBar.jsx */
import React from 'react';
import { toolManager, paintState, menuState } from '../legacy';   // 기존 모듈 그대로 사용
import { autorun } from 'mobx';                                   // (MobX 유지 시)

const hexColors = [
  '#000000', '#FFFFFF', '#FF6F61', '#98FF98',
  '#FFA75F', '#ACE7FF', '#FFED65', '#E5B5FF',
];

export default function AppBar() {
  /** 선택 툴 버튼 콜백 */
  const selectTool = (id) => {
    switch (id) {
      case 'brush':     toolManager.setBrushTool();     break;
      case 'eraser':    toolManager.setEraserTool();    break;
      case 'liquify':   toolManager.setLiquifyTool();   break;
      case 'select':    toolManager.setSelectTool();    break;
      default: break;
    }
  };

  /** 색상 팔레트 콜백 */
  const chooseColor = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    paintState.setColor(r, g, b);
  };

  /** 사이드 메뉴 열고 닫기 */
  const toggleMenu = () => menuState.setShowMenu(!menuState.showMenu);

  // --------------------------- JSX ---------------------------
  return (
    <div id="appbar">
      {/* ===== 헤더 ===== */}
      <div id="header">
        <button id="menu-button" className="header-button" onClick={toggleMenu}>
          <div id="menu-icon" />
        </button>

        <div className="flex-1" />

        <button id="undo-button" className="header-button">
          <div id="undo-icon" />
        </button>
        <button id="redo-button" className="header-button">
          <div id="redo-icon" />
        </button>

        {/* ▼ 드롭다운 메뉴 ▼ */}
        {menuState.showMenu && (
          <div id="main-menu">
            <button id="new-button"   onClick={resetImage}><div id="new-icon" />  <p>새로 만들기</p></button>
            <button id="open-button"  onClick={openFile}><div id="open-icon" /> <p>열기</p></button>
            <button id="save-button"  onClick={downloadImage}><div id="save-icon" /><p>저장</p></button>
          </div>
        )}
      </div>

      {/* ===== 툴바 ===== */}
      <div id="menu-bar">
        <button id="select-selection" className="select-button" onClick={() => selectTool('select')}>
          <div id="selection-icon" className="button-icon" /><p>선택</p>
        </button>

        {/* …중간 divider / mini‑buttons 그대로… */}

        <button id="select-brush" className="select-button"   onClick={() => selectTool('brush')}>
          <div id="brush-icon" className="button-icon" /><p>브러시</p>
        </button>
        <button id="select-eraser" className="select-button" onClick={() => selectTool('eraser')}>
          <div id="eraser-icon" className="button-icon" /><p>지우개</p>
        </button>

        {/* ===== 슬라이더 ===== */}
        <div className="brush-control-group">
          <label className="brush-control">
            <p className="label">크기</p>
            <input type="range"
                   min="1" max="1000"
                   value={paintState.sliderPos}     // MobX observable
                   onChange={(e) => paintState.setBrushSize(positionToSize(e.target.value/1000))}
                   className="slider" />
            <p className="value">{paintState.sizeLabel}</p>
          </label>

          <label className="brush-control">
            <p className="label">투명도</p>
            <input type="range"
                   min="1" max="100"
                   value={paintState.brushAlpha}
                   onChange={(e) => paintState.setBrushAlpha(+e.target.value)}
                   className="slider" />
            <p className="value">{paintState.brushAlpha}%</p>
          </label>
        </div>

        {/* ===== 색상 팔레트 ===== */}
        <div className="flex flex-row items-center">
          <div id="color-box">
            {hexColors.map((hex) => (
              <div key={hex} className="select-color" onClick={() => chooseColor(hex)}>
                <div className="circle-shape" style={{
                  background: hex,
                  border: hex === '#FFFFFF' ? '1px solid #E3E3E3' : undefined,
                }}/>
              </div>
            ))}
          </div>

          <button id="choose-color" className="select-button">
            <div id="color-icon" className="button-icon" style={{background: rgbToHex(paintState.getColor())}}/>
            <p>색</p>
          </button>
        </div>
      </div>
    </div>
  );
}
