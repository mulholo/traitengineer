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

export async function addPasskey(name: string): Promise<void> {
  const res = await client.passkey.addPasskey({ name });
  if (res?.error) throw new Error(res.error.message ?? "Could not add passkey");
}
