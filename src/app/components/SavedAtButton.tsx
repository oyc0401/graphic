import { observer } from "mobx-react-lite";
import { documentState } from "../documentState";
import { saveDrawing } from "../file/file";
import { getLetter } from "../i18n/language";

/** undo 왼쪽의 저장 상태 표시. 클릭하면 저장한다. */
export const SavedAtButton = observer(() => {
  const savedAt = documentState.getLastSavedAt();
  const isDirty = documentState.getDirty() || savedAt === null;

  const time =
    savedAt === null
      ? null
      : new Date(savedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

  const label = isDirty
    ? time === null
      ? getLetter("not_saved")
      : `${getLetter("not_saved")} · ${time}`
    : `${getLetter("saved")} ${time}`;

  return (
    <button
      id="saved-at-button"
      className="header-button"
      onClick={() => saveDrawing()}
      style={{
        width: "auto",
        padding: "0 8px",
        fontSize: 12,
        whiteSpace: "nowrap",
        opacity: isDirty ? 1 : 0.6,
      }}
    >
      {label}
    </button>
  );
});
