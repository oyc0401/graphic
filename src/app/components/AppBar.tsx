import { useEffect, useState } from "react";
import AppBarDesktop from "./AppBarDesktop";
import AppBarMobile from "./AppbarMobile";
import { isSmallSize } from "../utils/screen";
import { existLang, getLetter, getSuggestedLang } from "../i18n/language";
import { languagePack } from "../i18n/languagePack";

export default function AppBar() {
  const [isMobile, setIsMobile] = useState(isSmallSize());

  useEffect(() => {
    const checkWidth = () => setIsMobile(isSmallSize());
    checkWidth(); // 초기 체크
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  // useEffect(() => {
  //   const shown = localStorage.getItem("langAlertShown");
  //   const suggestedLang = getSuggestedLang();

  //   if (!shown && suggestedLang) {
  //     const suggestedPack = languagePack[suggestedLang];
  //     let response = confirm(suggestedPack.you_can_translation);

  //     if (response) {
  //       alert(`페이지 이동: ${suggestedLang}`);
  //     }
  //     // 다시 안 뜨게 저장
  //     localStorage.setItem("langAlertShown", "true");
  //   }
  // }, []);

  return isMobile ? <AppBarMobile /> : <AppBarDesktop />;
}
