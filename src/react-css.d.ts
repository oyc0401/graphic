import "react";

// style={{ "--custom-var": ... }} 형태의 CSS 커스텀 프로퍼티를 허용한다.
declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
