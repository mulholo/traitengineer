// Native modules that have no JS fallback under Jest.
jest.mock("react-native-mmkv", () => {
  const store = new Map<string, string>();
  return {
    createMMKV: () => ({
      getString: (k: string) => store.get(k),
      set: (k: string, v: string) => store.set(k, v),
      remove: (k: string) => store.delete(k),
    }),
  };
});
