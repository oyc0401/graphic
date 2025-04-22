// src/svg.d.ts
declare module "*.svg?react" {
  import * as React from "react";
  const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  export default ReactComponent;
}

declare module "*?worker" {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

interface Window {
  showOpenFilePicker?: any;
}
