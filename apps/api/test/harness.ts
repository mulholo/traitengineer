import { createRecordingPushSender, type PushMessage } from "@te/core";
import { createTestDb, type DbHandle } from "@te/db";
import { afterAll, beforeAll } from "vitest";
import { createContainerFromHandle, type Container } from "../src/container.ts";
import { loadEnv, type Env } from "../src/env.ts";

export const TEST_SECRET = "test-secret-test-secret-test-secret-0123456789";

export function testEnv(overrides: Record<string, string> = {}): Env {
  return loadEnv({
    NODE_ENV: "test",
    BETTER_AUTH_SECRET: TEST_SECRET,
    PUBLIC_URL: "http://localhost:3000",
    // Deterministic: no web build unless a test provides one (a local `expo export` must not change results).
    WEB_DIST_DIR: "/nonexistent-web-dist",
    ...overrides,
  });
}

export interface ApiHarness {
  container: Container;
  handle: DbHandle;
  clock: { now: Date };
  pushed: PushMessage[];
  request(
    method: string,
    path: string,
    opts?: { token?: string; body?: unknown; headers?: Record<string, string> },
  ): Promise<Response>;
  json<T = Record<string, unknown>>(
    method: string,
    path: string,
    opts?: { token?: string; body?: unknown; headers?: Record<string, string> },
  ): Promise<{ status: number; body: T; res: Response }>;
  /** A session token for a (new or existing) user via the test-only route. */
  session(email?: string): Promise<{ token: string; userId: string }>;
}

/** One app + in-memory PGlite per test file. */
export function useApi(envOverrides: Record<string, string> = {}): ApiHarness {
  const h = { clock: { now: new Date("2026-10-14T12:00:00Z") } } as ApiHarness;
  beforeAll(async () => {
    h.handle = await createTestDb();
    const push = createRecordingPushSender();
    h.pushed = push.sent;
    h.container = createContainerFromHandle(testEnv(envOverrides), h.handle, {
      push,
      now: () => h.clock.now,
    });
    h.request = (method, path, opts = {}) => {
      const headers: Record<string, string> = { ...opts.headers };
      if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;
      if (opts.body !== undefined) headers["content-type"] = "application/json";
      return Promise.resolve(
        h.container.app.request(`http://localhost:3000${path}`, {
          method,
          headers,
          ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
        }),
      );
    };
    h.json = async (method, path, opts) => {
      const res = await h.request(method, path, opts);
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : {}, res };
    };
    h.session = async (email = `user-${crypto.randomUUID()}@example.test`) => {
      const { body } = await h.json<{ token: string; userId: string }>("POST", "/api/test/session", {
        body: { email },
      });
      return body;
    };
  });
  afterAll(async () => {
    await h.handle.close();
  });
  return h;
}
