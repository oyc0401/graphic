import { languagePack, Letter } from "./languagePack";

export function setLanguage(lang) {
  if (languagePack[lang]) {
    currentPack = languagePack[lang];
  } else {
    currentPack = languagePack.en;
  }
}

let currentPack = languagePack[window.lang] ?? languagePack.en;
export function getLetter(key: Letter) {
  return currentPack[key];
}
