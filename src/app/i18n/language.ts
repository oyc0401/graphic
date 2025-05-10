import { languagePack, Letter } from "./languagePack";

export function setLanguage(id) {
  if (languagePack[id]) {
    currentPack = languagePack[id];
  } else {
    currentPack = languagePack.en;
  }
}

let currentPack = languagePack.en;
export function getLetter(key: Letter) {
  return currentPack[key];
}
