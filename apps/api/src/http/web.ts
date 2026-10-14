import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Hono } from "hono";
import type { AppEnv } from "./types.ts";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

/** apps/mobile/dist/web relative to this file (local dev); Docker sets WEB_DIST_DIR explicitly. */
export const defaultWebDistDir = fileURLToPath(new URL("../../../mobile/dist/web", import.meta.url));

/**
 * Serve the Expo web export from the same origin as the API, with an SPA fallback to index.html for every
 * path not reserved by the API.
 */
export function mountWeb(app: Hono<AppEnv>, opts: { dir: string; reserved: readonly string[] }) {
  const root = resolve(opts.dir);
  const indexPath = join(root, "index.html");
  if (!existsSync(indexPath)) return false;
  const isReserved = (path: string) => opts.reserved.some((p) => path === p || path.startsWith(`${p}/`));

  app.get("*", (c, next) => {
    const path = decodeURIComponent(c.req.path);
    if (isReserved(path)) return next();
    const candidate = normalize(join(root, path));
    if (candidate.startsWith(root + sep) && existsSync(candidate) && statSync(candidate).isFile()) {
      const immutable = path.startsWith("/_expo/static/") || path.startsWith("/assets/");
      return c.body(readFileSync(candidate), 200, {
        "content-type": TYPES[extname(candidate)] ?? "application/octet-stream",
        "cache-control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=300",
      });
    }
    // Client-side route: hand back the SPA shell.
    return c.body(readFileSync(indexPath), 200, {
      "content-type": TYPES[".html"] ?? "text/html",
      "cache-control": "no-cache",
    });
  });
  return true;
}
