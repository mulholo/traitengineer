/** Web: the session lives in an httpOnly cookie, so there is no token to store or send. */
export async function getSessionToken(): Promise<string | null> {
  return null;
}
export async function setSessionToken(_token: string | null): Promise<void> {}
