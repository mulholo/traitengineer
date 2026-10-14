/**
 * Native passkeys need associated domains (webcredentials) for the production host and a native WebAuthn
 * module; deferred until the domain exists (ADR 0029). Passkeys can be managed and used on the web app.
 */
export const passkeysSupported = false;

export async function signInWithPasskey(): Promise<void> {
  throw new Error("Passkeys are available in the web app for now.");
}

export async function addPasskey(_name: string): Promise<void> {
  throw new Error("Passkeys are available in the web app for now.");
}
