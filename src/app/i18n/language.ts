import { languagePack, Letter } from "./languagePack";

let currentLang = "en";

export function setLanguage(lang) {
  if (existLang(lang)) {
    currentLang = lang;
  } else {
    currentLang = "en";
  }
}

function getPathLanguage() {
  const [lang] = window.location.pathname.split("/").filter(Boolean);
  return existLang(lang) ? lang : null;
}

setLanguage(getPathLanguage() ?? "en");

export function getLetter(key: Letter, lang = currentLang) {
  let currentPack = languagePack[lang];
  return currentPack[key];
}

export function existLang(lang) {
  if (languagePack[lang]) return true;

  return false;
}

const getBrowserLang = () => {
  const lang = navigator.language || navigator.languages?.[0];
  return lang?.split("-")[0]; // 'ko-KR' → 'ko'
};

// 브라우저 언어가 현재 사이트 언어랑 다르고, 지원 목록에 있다면 true
export const getSuggestedLang = () => {
  const browserLang = getBrowserLang();
  if (browserLang && browserLang !== currentLang && languagePack[browserLang]) {
    return browserLang;
  }
  return null;
};
