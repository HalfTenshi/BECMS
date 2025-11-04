const handlers = new Map(); // eventName -> Set<fn>

export function on(eventName, fn) {
  const set = handlers.get(eventName) || new Set();
  set.add(fn);
  handlers.set(eventName, set);
  return () => set.delete(fn);
}

export async function emit(eventName, payload) {
  const set = handlers.get(eventName);
  if (!set || set.size === 0) return;
  for (const fn of set) {
    await Promise.resolve(fn(payload));
  }
}
