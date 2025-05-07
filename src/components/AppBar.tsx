import { useEffect, useState } from "react";
import AppBarDesktop from "./AppBarDesktop";
import AppBarMobile from "./AppbarMobile";

export default function AppBar() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkWidth = () => setIsMobile(window.innerWidth < 800);
    checkWidth(); // 초기 체크
    window.addEventListener("resize", checkWidth);
    console.log('크기 체크!',window.innerWidth)
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  return isMobile ? <AppBarMobile /> : <AppBarDesktop />;
}
