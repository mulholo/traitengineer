import * as SecureStore from "expo-secure-store";
import { kvStorage } from "./storage";

const KEY = "te.session-token";
/** Lives in MMKV, which iOS deletes with the app, unlike the keychain. */
const INSTALL_MARKER = "te.install-marker";
let cached: string | null | undefined;

/**
 * iOS keeps keychain items after an app is deleted, so a reinstall would come back signed in. On the first
 * launch of a fresh install (no MMKV marker yet) drop any leftover session token.
 */
async function forgetSessionFromPreviousInstall(): Promise<void> {
  if (kvStorage.getItem(INSTALL_MARKER)) return;
  await SecureStore.deleteItemAsync(KEY);
  kvStorage.setItem(INSTALL_MARKER, new Date().toISOString());
}

/** Native: the Better Auth session token lives in the keychain and is sent as a bearer token. */
export async function getSessionToken(): Promise<string | null> {
  if (cached === undefined) {
    await forgetSessionFromPreviousInstall();
    cached = await SecureStore.getItemAsync(KEY);
  }
  return cached;
}

export async function setSessionToken(token: string | null): Promise<void> {
  cached = token;
  if (token) {
    kvStorage.setItem(INSTALL_MARKER, kvStorage.getItem(INSTALL_MARKER) ?? new Date().toISOString());
    await SecureStore.setItemAsync(KEY, token);
  } else {
    await SecureStore.deleteItemAsync(KEY);
  }
}
