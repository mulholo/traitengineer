import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { useApi } from "./harness.ts";

const base = mkdtempSync(join(tmpdir(), "te-web-"));
const dir = join(base, "web");
mkdirSync(join(dir, "_expo/static/js"), { recursive: true });
writeFileSync(join(dir, "index.html"), "<!doctype html><title>Trait Engineer</title>");
writeFileSync(join(dir, "_expo/static/js/entry-abc.js"), "console.log(1)");
writeFileSync(join(base, "secret.txt"), "nope");

const h = useApi({ WEB_DIST_DIR: dir });

describe("web app serving", () => {
  test("serves static assets with long-lived caching", async () => {
    const res = await h.request("GET", "/_expo/static/js/entry-abc.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/javascript");
    expect(res.headers.get("cache-control")).toContain("immutable");
  });

  test("falls back to index.html for client routes", async () => {
    for (const path of ["/", "/targets/123", "/log/abc", "/settings"]) {
      const res = await h.request("GET", path);
      expect(res.status, path).toBe(200);
      expect(await res.text()).toContain("<title>Trait Engineer</title>");
    }
  });

  test("reserved prefixes never fall through to the web app", async () => {
    for (const path of ["/v1/nope", "/api/nope", "/.well-known/nope", "/mcp/x"]) {
      const res = await h.request("GET", path);
      expect(res.headers.get("content-type") ?? "", path).not.toContain("text/html");
    }
    expect((await h.request("GET", "/health")).headers.get("content-type")).toContain("application/json");
  });

  test("path traversal cannot escape the web root", async () => {
    const res = await h.request("GET", "/..%2fsecret.txt");
    expect(await res.text()).not.toContain("nope");
  });
});
