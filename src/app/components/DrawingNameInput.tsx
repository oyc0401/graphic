import { useRef } from "react";
import { observer } from "mobx-react-lite";
import { documentState } from "../documentState";
import { getLetter } from "../i18n/language";

// CJK 등 전각 문자는 2칸 폭으로 근사해 input 너비를 잡는다
function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    width += ch.charCodeAt(0) > 0x2e7f ? 2 : 1;
  }
  return width;
}

/** 메뉴 버튼 옆 그림 이름 — 클릭해서 바로 수정한다 */
export const DrawingNameInput = observer(() => {
  const name = documentState.getName();
  const nameOnFocus = useRef<string | null>(null);

  return (
    <input
      id="drawing-name-input"
      value={name}
      aria-label={getLetter("rename")}
      onFocus={() => {
        nameOnFocus.current = name;
      }}
      onChange={(e) => documentState.setName(e.target.value)}
      onBlur={() => {
        const trimmed = documentState.getName().trim() || getLetter("untitled");
        documentState.setName(trimmed);
        if (nameOnFocus.current !== null && trimmed !== nameOnFocus.current) {
          documentState.setDirty(true); // 이름도 저장 대상
        }
        nameOnFocus.current = null;
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") {
          (e.target as HTMLInputElement).blur();
        }
      }}
      style={{
        width: `${Math.min(Math.max(displayWidth(name) + 1, 4), 28)}ch`,
        border: "none",
        background: "transparent",
        font: "inherit",
        fontSize: 13,
        fontWeight: 500,
        color: "inherit",
        padding: "4px 6px",
        borderRadius: 6,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    />
  );
});
