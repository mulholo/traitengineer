import * as SecureStore from "expo-secure-store";

const KEY = "te.session-token";
let cached: string | null | undefined;

/** Native: the Better Auth session token lives in the keychain and is sent as a bearer token. */
export async function getSessionToken(): Promise<string | null> {
  if (cached === undefined) cached = await SecureStore.getItemAsync(KEY);
  return cached;
}

export async function setSessionToken(token: string | null): Promise<void> {
  cached = token;
  if (token) await SecureStore.setItemAsync(KEY, token);
  else await SecureStore.deleteItemAsync(KEY);
}
