export function createEmitter() {
  const handlers = new Map();
  const api = {
    on(name, fn) {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name).add(fn);
      return () => api.off(name, fn);
    },
    off(name, fn) {
      handlers.get(name)?.delete(fn);
    },
    once(name, fn) {
      const off = api.on(name, (payload) => {
        off();
        fn(payload);
      });
      return off;
    },
    emit(name, payload) {
      const set = handlers.get(name);
      if (set) {
        for (const fn of [...set]) {
          try {
            fn(payload);
          } catch (error) {
            console.error(`Error in "${name}" handler`, error);
          }
        }
      }
      const any = handlers.get("*");
      if (any && name !== "*") for (const fn of [...any]) fn(name, payload);
    },
  };
  return api;
}
