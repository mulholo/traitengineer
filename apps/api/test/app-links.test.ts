import { describe, expect, test } from "vitest";
import { useApi } from "./harness.ts";

describe("app association files when configured", () => {
  const h = useApi({ APPLE_TEAM_ID: "ABCDE12345", ANDROID_CERT_SHA256: "AA:BB, CC:DD" });

  test("apple-app-site-association lists the app under webcredentials, as JSON with no redirect", async () => {
    for (const path of ["/.well-known/apple-app-site-association", "/apple-app-site-association"]) {
      const res = await h.request("GET", path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get("content-type"), path).toContain("application/json");
      expect(await res.json()).toEqual({
        webcredentials: { apps: ["ABCDE12345.com.mulholo.traitengineer"] },
      });
    }
  });

  test("assetlinks.json grants get_login_creds to the Android app", async () => {
    const res = await h.request("GET", "/.well-known/assetlinks.json");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        relation: ["delegate_permission/common.get_login_creds"],
        target: {
          namespace: "android_app",
          package_name: "com.mulholo.traitengineer",
          sha256_cert_fingerprints: ["AA:BB", "CC:DD"],
        },
      },
    ]);
  });

  test("OAuth discovery under /.well-known still reaches Better Auth", async () => {
    const res = await h.request("GET", "/.well-known/oauth-authorization-server");
    expect(res.status).toBe(200);
  });
});

describe("app association files when not configured", () => {
  const h = useApi();

  test("answer 404", async () => {
    for (const path of [
      "/.well-known/apple-app-site-association",
      "/apple-app-site-association",
      "/.well-known/assetlinks.json",
    ]) {
      expect((await h.request("GET", path)).status, path).toBe(404);
    }
  });
});
