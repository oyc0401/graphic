import { useEffect, useState } from "react";
import AppBarDesktop from "./AppBarDesktop";
import AppBarMobile from "./AppbarMobile";
import { isSmallSize } from "../utils/screen";

export default function AppBar() {
  const [isMobile, setIsMobile] = useState(isSmallSize());

  useEffect(() => {
    const checkWidth = () => setIsMobile(isSmallSize());
    checkWidth(); // 초기 체크
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  return isMobile ? <AppBarMobile /> : <AppBarDesktop />;
}
