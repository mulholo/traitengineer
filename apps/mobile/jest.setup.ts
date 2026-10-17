import type * as ReactQuery from "@tanstack/react-query";

// Native modules that have no JS fallback under Jest.
jest.mock("react-native-mmkv", () => {
  // Global so data survives jest.resetModules() (tests use that to simulate an app restart).
  const g = globalThis as { mockMmkvStore?: Map<string, string> };
  const store = (g.mockMmkvStore ??= new Map<string, string>());
  return {
    createMMKV: () => ({
      getString: (k: string) => store.get(k),
      set: (k: string, v: string) => store.set(k, v),
      remove: (k: string) => store.delete(k),
    }),
  };
});

// TanStack Query schedules multi-minute GC timers for queries and mutations. Unref them so they never keep the
// Jest process alive after the tests finish.
// require (not import): jest.setup is evaluated before the test modules are loaded.
const { timeoutManager } = require("@tanstack/react-query") as typeof ReactQuery;
timeoutManager.setTimeoutProvider({
  setTimeout: (cb: () => void, ms: number) => {
    const t = setTimeout(cb, ms);
    (t as unknown as { unref?: () => void }).unref?.();
    return t;
  },
  clearTimeout: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
  setInterval: (cb: () => void, ms: number) => {
    const t = setInterval(cb, ms);
    (t as unknown as { unref?: () => void }).unref?.();
    return t;
  },
  clearInterval: (t) => clearInterval(t as ReturnType<typeof setInterval>),
});
