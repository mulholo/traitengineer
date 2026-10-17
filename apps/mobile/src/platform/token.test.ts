import type * as TokenModule from "./token.native";

const mockKeychain = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (k: string) => mockKeychain.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockKeychain.set(k, v),
  deleteItemAsync: async (k: string) => void mockKeychain.delete(k),
}));

/** A fresh copy of the module, as after an app launch (module state such as the cached token is reset). */
function launchApp(): typeof TokenModule {
  let mod: typeof TokenModule | undefined;
  jest.isolateModules(() => {
    // require (not import): Jest evaluates it inside the isolated registry.
    mod = require("./token.native") as typeof TokenModule;
  });
  if (!mod) throw new Error("module not loaded");
  return mod;
}

beforeEach(() => {
  mockKeychain.clear();
  (globalThis as { mockMmkvStore?: Map<string, string> }).mockMmkvStore?.clear(); // fresh install
});

test("a session token left in the keychain by a previous install is discarded on first launch", async () => {
  mockKeychain.set("te.session-token", "stale-token-from-deleted-app");
  expect(await launchApp().getSessionToken()).toBeNull();
  expect(mockKeychain.has("te.session-token")).toBe(false);
});

test("within the same install the token persists across launches", async () => {
  await launchApp().setSessionToken("live-token");
  expect(await launchApp().getSessionToken()).toBe("live-token");
});
