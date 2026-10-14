import { createMMKV } from "react-native-mmkv";
import type { KeyValueStorage } from "./storage";

export type { KeyValueStorage } from "./storage";

const mmkv = createMMKV({ id: "traitengineer" });

/** Native key-value storage backed by MMKV (fast, synchronous; used for the query cache). */
export const kvStorage: KeyValueStorage = {
  getItem: (key) => mmkv.getString(key) ?? null,
  setItem: (key, value) => mmkv.set(key, value),
  removeItem: (key) => {
    mmkv.remove(key);
  },
};
