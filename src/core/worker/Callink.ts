export function wrap<T extends Record<string, (...args: any) => any>>() {
  return new Proxy(
    {} as {
      [K in keyof T]: (
        payload: Parameters<T[K]>[0],
        transfer?: Transferable[],
      ) => void;
    },
    {
      get(_, propKey: string) {
        return (payload: any, transfer?: Transferable[]) => {
          self.postMessage({ type: propKey, payload }, transfer || []);
        };
      },
    },
  );
}

export function expose(worker, mainApi) {
  worker.onmessage = (e) => {
    const { type, payload } = e.data;
    mainApi[type]?.(payload);
  };
}

export class Callink {
  static wrap = wrap;
  static expose = expose;
}
