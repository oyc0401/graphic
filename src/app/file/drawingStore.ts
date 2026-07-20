/** drawingStore.ts — IndexedDB에 그림을 PNG Blob으로 영속화하는 저장소 */

export type DrawingRecord = {
  id: string;
  name: string;
  png: Blob;
  width: number;
  height: number;
  transparentBackground: boolean;
  updatedAt: number;
};

const DB_NAME = "painton";
const STORE_NAME = "drawings";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export function getDrawing(id: string): Promise<DrawingRecord | undefined> {
  return withStore("readonly", (store) => store.get(id));
}

export function putDrawing(record: DrawingRecord): Promise<IDBValidKey> {
  return withStore("readwrite", (store) => store.put(record));
}

export function deleteDrawing(id: string): Promise<undefined> {
  return withStore("readwrite", (store) => store.delete(id));
}

/** 최근 수정 순 정렬. ponytail: Blob 포함 전체 로드 — 그림 수백 장 수준까진 문제 없음 */
export async function listDrawings(): Promise<DrawingRecord[]> {
  const all = await withStore<DrawingRecord[]>("readonly", (store) => store.getAll());
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

const ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

export function createDrawingId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ID_CHARS[b % ID_CHARS.length]).join("");
}
