import { Platform } from "react-native";
import { apiBaseUrl } from "./config";

const g = globalThis as Record<string, unknown>;
const DEV = "__DEV__";

describe("apiBaseUrl", () => {
  const saved = {
    os: Platform.OS,
    window: g["window"],
    dev: g[DEV],
    env: process.env["EXPO_PUBLIC_API_URL"],
  };

  beforeEach(() => {
    delete process.env["EXPO_PUBLIC_API_URL"];
    Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
    g["window"] = { location: { protocol: "http:", hostname: "localhost", origin: "http://localhost:8081" } };
  });
  afterEach(() => {
    Object.defineProperty(Platform, "OS", { value: saved.os, configurable: true });
    g["window"] = saved.window;
    g[DEV] = saved.dev;
    if (saved.env === undefined) delete process.env["EXPO_PUBLIC_API_URL"];
    else process.env["EXPO_PUBLIC_API_URL"] = saved.env;
  });

  // `pnpm dev` serves web from Metro on :8081, which answers /api/* with index.html and a 200.
  it("points the web dev server at the dev API, not at Metro", () => {
    g[DEV] = true;
    expect(apiBaseUrl()).toBe("http://localhost:3000");
  });

  it("stays same-origin in a production web build (served by the API)", () => {
    g[DEV] = false;
    expect(apiBaseUrl()).toBe("");
  });

  it("honours EXPO_PUBLIC_API_URL", () => {
    g[DEV] = true;
    process.env["EXPO_PUBLIC_API_URL"] = "https://api.example.com/";
    expect(apiBaseUrl()).toBe("https://api.example.com");
  });
});
