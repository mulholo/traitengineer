import type { Context, Hono } from "hono";
import type { Env } from "../env.ts";
import type { AppEnv } from "./types.ts";

/**
 * Domain ↔ app association files. They let the OS treat the native app and this domain as the same "site", so
 * password managers (iCloud Keychain, 1Password) offer the domain's saved logins in the app and native passkeys
 * can use this domain as their relying party.
 *
 * - iOS: `apple-app-site-association` lists `<Team ID>.<bundle ID>` under `webcredentials`. Apple's CDN fetches
 *   it over HTTPS with no redirects and expects JSON; the app opts in with `webcredentials:<host>` in
 *   `ios.associatedDomains`.
 * - Android: `assetlinks.json` grants the app (by signing certificate fingerprint) `get_login_creds`.
 *
 * Each file is served only once its env vars are set, so a deploy without them keeps answering 404.
 */
const CACHE = { "Cache-Control": "public, max-age=3600" };

export function mountAppLinks(app: Hono<AppEnv>, env: Env) {
  const appleAppId = env.APPLE_TEAM_ID ? `${env.APPLE_TEAM_ID}.${env.IOS_BUNDLE_ID}` : undefined;
  const aasa = appleAppId ? { webcredentials: { apps: [appleAppId] } } : undefined;
  const handleAasa = (c: Context<AppEnv>) => (aasa ? c.json(aasa, 200, CACHE) : c.notFound());
  // Apple checks `/.well-known/` first; the root path is the legacy location.
  app.get("/.well-known/apple-app-site-association", handleAasa);
  app.get("/apple-app-site-association", handleAasa);

  const fingerprints =
    env.ANDROID_CERT_SHA256?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const assetLinks = fingerprints.length
    ? [
        {
          relation: ["delegate_permission/common.get_login_creds"],
          target: {
            namespace: "android_app",
            package_name: env.ANDROID_PACKAGE,
            sha256_cert_fingerprints: fingerprints,
          },
        },
      ]
    : undefined;
  app.get("/.well-known/assetlinks.json", (c) =>
    assetLinks ? c.json(assetLinks, 200, CACHE) : c.notFound(),
  );
}
