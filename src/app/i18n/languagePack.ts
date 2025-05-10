const en_pack = {
  current_language: "English",
  paint: "paint",
  tools: "Tools",
  select: "Select",
  brush: "Brush",
  eraser: "Eraser",
  size: "Size",
  opacity: "Opacity",
  color: "Color",
  choose_color: "Choose Color",
  new: "New",
  open: "Open",
  save: "Save",
  undo: "Undo",
  redo: "Redo",
  you_can_translation:
    "Would you like to switch to the English version of the site?",
};

const ko_pack: typeof en_pack = {
  current_language: "한국어",
  paint: "그림판",
  tools: "도구",
  select: "선택",
  brush: "브러시",
  eraser: "지우개",
  size: "크기",
  opacity: "투명도",
  color: "색",
  choose_color: "색 선택",
  new: "새로 만들기",
  open: "열기",
  save: "저장",
  undo: "뒤로 가기",
  redo: "앞으로 가기",
  you_can_translation: "한국어 페이지로 이동하시겠습니까?",
};

export const languagePack = {
  en: en_pack,
  ko: ko_pack,
};

export type Letter = keyof typeof en_pack;
