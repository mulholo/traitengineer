/** Web key-value storage (localStorage). Native uses MMKV (storage.native.ts). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

const memory = new Map<string, string>();

export const kvStorage: KeyValueStorage = {
  getItem: (key) => {
    try {
      return safeLocalStorage()?.getItem(key) ?? memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  },
  setItem: (key, value) => {
    memory.set(key, value);
    try {
      safeLocalStorage()?.setItem(key, value);
    } catch {
      // storage full or blocked: memory copy is enough for this session
    }
  },
  removeItem: (key) => {
    memory.delete(key);
    try {
      safeLocalStorage()?.removeItem(key);
    } catch {
      // ignore
    }
  },
};
