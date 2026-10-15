/** Turn a notification deep link (`traitengineer://log/<toolId>`) into an Expo Router path (`/log/<toolId>`). */
export function pathFromDeepLink(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  const match = url.match(/^traitengineer:\/\/(.*)$/);
  if (!match) return undefined;
  const path = `/${match[1] ?? ""}`.replace(/\/+$/, "");
  return path === "" ? "/" : path;
}
