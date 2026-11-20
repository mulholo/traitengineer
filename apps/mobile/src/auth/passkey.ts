import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/client";
import { apiOrigin } from "../config";

/** Web: WebAuthn via Better Auth's passkey client (same-origin cookie session). */
const client = createAuthClient({ baseURL: `${apiOrigin()}/api/auth`, plugins: [passkeyClient()] });

export const passkeysSupported = typeof window !== "undefined" && "PublicKeyCredential" in window;

export async function signInWithPasskey(): Promise<void> {
  const res = await client.signIn.passkey();
  if (res?.error) throw new Error(res.error.message ?? "Passkey sign-in failed");
}

/** Registering a passkey needs a session signed in within the last day; confirm who you are, then retry. */
export class SessionNotFreshError extends Error {
  constructor() {
    super("Confirm it's you to add a passkey.");
    this.name = "SessionNotFreshError";
  }
}

export async function addPasskey(name: string): Promise<void> {
  const res = await client.passkey.addPasskey({ name });
  if (res?.error && "code" in res.error && res.error.code === "SESSION_NOT_FRESH")
    throw new SessionNotFreshError();
  if (res?.error) throw new Error(res.error.message ?? "Could not add passkey");
}
