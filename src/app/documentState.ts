import { makeAutoObservable, reaction } from "mobx";
import { historyState } from "./history";

/** 현재 편집 중인 문서(그림)의 메타 상태 — id/이름/저장 시각/변경 여부 */
class DocumentState {
  private _id = "";
  private _name = "";
  private _lastSavedAt: number | null = null;
  private _dirty = false;

  constructor() {
    makeAutoObservable(this);
  }

  getId() {
    return this._id;
  }
  getName() {
    return this._name;
  }
  getLastSavedAt() {
    return this._lastSavedAt;
  }
  getDirty() {
    return this._dirty;
  }

  setId(id: string) {
    this._id = id;
  }
  setName(name: string) {
    this._name = name;
  }
  setLastSavedAt(time: number | null) {
    this._lastSavedAt = time;
  }
  setDirty(dirty: boolean) {
    this._dirty = dirty;
  }
}

export const documentState = new DocumentState();

// 캔버스를 바꾸는 모든 작업(스트로크, undo/redo, 리사이즈 등)은 히스토리 카운트를 바꾼다.
// ponytail: 카운트 변화 = 수정으로 근사. 로드/저장 직후 setDirty(false)로 오탐을 지운다.
reaction(
  () => [historyState.getUndoCount(), historyState.getRedoCount()],
  () => documentState.setDirty(true),
);
