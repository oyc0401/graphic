import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  deleteDrawing,
  listDrawings,
  type DrawingRecord,
} from "../file/drawingStore";
import {
  drawingPath,
  landingPath,
  paintPath,
} from "../file/initialRouteSession";
import { getLetter } from "../i18n/language";
import "./dashboard.css";

const DISPLAY_FONT_URL =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&display=swap";

/** /{locale}/dashboard — 저장된 그림 목록 페이지. landing.html의 디자인을 따른다. */
export function Dashboard() {
  const [items, setItems] = useState<DrawingRecord[] | null>(null);

  useEffect(() => {
    document.title = `${getLetter("dashboard")} — PaintOn`;

    // 랜딩과 같은 디스플레이 폰트(Bricolage Grotesque)를 로드한다
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = DISPLAY_FONT_URL;
    document.head.appendChild(link);

    listDrawings()
      .then(setItems)
      .catch((err) => {
        console.error("그림 목록 로드 실패:", err);
        setItems([]);
      });
  }, []);

  const remove = async (id: string) => {
    if (!window.confirm(getLetter("delete_drawing_confirm"))) return;
    await deleteDrawing(id);
    setItems((prev) => prev?.filter((d) => d.id !== id) ?? null);
  };

  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <a className="brand" href={landingPath()}>
            <img src="/icon-192.png" alt="" width={26} height={26} />
            PaintOn
          </a>
          <a className="btn" href={paintPath()}>
            <Plus size={16} />
            {getLetter("new_drawing")}
          </a>
        </div>
      </header>

      <main className="wrap">
        <div className="dashboard-head">
          <h1>{getLetter("dashboard")}</h1>
          {items !== null && items.length > 0 && (
            <span className="count">{items.length}</span>
          )}
        </div>

        {items !== null && items.length === 0 && (
          <div className="empty">
            <div className="board" aria-hidden="true" />
            <p>{getLetter("no_drawings")}</p>
            <a className="btn" href={paintPath()}>
              <Plus size={16} />
              {getLetter("new_drawing")}
            </a>
          </div>
        )}

        <div className="drawing-grid">
          {items?.map((drawing) => (
            <DrawingCard
              key={drawing.id}
              drawing={drawing}
              onDelete={() => remove(drawing.id)}
            />
          ))}
        </div>
      </main>
    </>
  );
}

function DrawingCard({
  drawing,
  onDelete,
}: {
  drawing: DrawingRecord;
  onDelete: () => void;
}) {
  const [thumbUrl, setThumbUrl] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(drawing.png);
    setThumbUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [drawing.png]);

  return (
    <a className="drawing-card" href={drawingPath(drawing.id)}>
      <div className="thumb">
        {thumbUrl && <img src={thumbUrl} alt={drawing.name} />}
      </div>
      <h3>{drawing.name}</h3>
      <time dateTime={new Date(drawing.updatedAt).toISOString()}>
        {new Date(drawing.updatedAt).toLocaleString()}
      </time>
      <button
        className="delete-btn"
        aria-label={getLetter("delete")}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 size={16} />
      </button>
    </a>
  );
}
