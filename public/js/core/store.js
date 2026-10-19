export function createStore(initial) {
  let state = { ...initial };
  const listeners = new Set();
  return {
    get() { return state; },
    set(patch) { state = { ...state, ...patch }; listeners.forEach((fn) => fn(state)); },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
