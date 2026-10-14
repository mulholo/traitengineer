import { accounts } from "@te/db";
import { createTestDb } from "@te/db";
import { describe, expect, test } from "vitest";
import { createContainerFromHandle } from "../src/container.ts";
import { testEnv, useApi } from "./harness.ts";

const h = useApi();
const PASSWORD = "correct horse battery staple";
const median = (xs: number[]) => xs.toSorted((a, b) => a - b)[1] ?? 0;

/** Sign up through Better Auth (allowed only under NODE_ENV=test) and return the email. */
async function signUp(email = `owner-${crypto.randomUUID()}@example.test`, password = PASSWORD) {
  const res = await h.json("POST", "/api/auth/sign-up/email", { body: { email, password, name: "Owner" } });
  expect(res.status).toBe(200);
  return email;
}

async function signIn(email: string, password: string, ip = "203.0.113.1") {
  const res = await h.request("POST", "/api/auth/sign-in/email", {
    body: { email, password },
    headers: { "fly-client-ip": ip },
  });
  const text = await res.text();
  return { status: res.status, text, body: text ? (JSON.parse(text) as Record<string, unknown>) : {}, res };
}

describe("every /v1 route requires auth", () => {
  test("unauthenticated requests get 401 problem+json for every documented /v1 operation", async () => {
    const doc = await h.json<{ paths: Record<string, Record<string, unknown>> }>("GET", "/openapi.json");
    const ops = Object.entries(doc.body.paths)
      .filter(([path]) => path.startsWith("/v1"))
      .flatMap(([path, methods]) =>
        Object.keys(methods).map(
          (m) => [m.toUpperCase(), path.replace("{id}", crypto.randomUUID())] as const,
        ),
      );
    expect(ops.length).toBeGreaterThan(20);
    for (const [method, path] of ops) {
      const res = await h.request(method, path, method === "GET" || method === "DELETE" ? {} : { body: {} });
      expect(res.status, `${method} ${path}`).toBe(401);
      expect(res.headers.get("content-type")).toBe("application/problem+json");
    }
    expect((await h.request("GET", "/v1/me", { token: "garbage" })).status).toBe(401);
    expect((await h.request("GET", "/v1/me", { token: "te_pat_garbage" })).status).toBe(401);
  });
});

describe("sign-in", () => {
  test("mobile can use the session token as a bearer token", async () => {
    const email = await signUp();
    const { status, body } = await signIn(email, PASSWORD, "203.0.113.10");
    expect(status).toBe(200);
    const me = await h.json("GET", "/v1/me", { token: body["token"] as string });
    expect(me.status).toBe(200);
    expect(me.body["email"]).toBe(email);
  });

  test("unknown email and wrong password are indistinguishable (status, body and timing)", async () => {
    const email = await signUp();
    const timings = { unknown: [] as number[], wrong: [] as number[] };
    let unknownRes = { status: 0, text: "" };
    let wrongRes = { status: 0, text: "" };
    for (let i = 0; i < 3; i++) {
      let t = performance.now();
      unknownRes = await signIn(`nobody-${i}@example.test`, PASSWORD, `198.51.100.${i}`);
      timings.unknown.push(performance.now() - t);
      t = performance.now();
      wrongRes = await signIn(email, `${PASSWORD}-nope`, `198.51.100.${i + 10}`);
      timings.wrong.push(performance.now() - t);
    }
    expect(unknownRes.status).toBe(401);
    expect(wrongRes.status).toBe(401);
    expect(unknownRes.text).toBe(wrongRes.text);
    const ratio = median(timings.unknown) / median(timings.wrong);
    // Both paths run a full scrypt hash; allow generous noise but catch a short-circuit (which would be ~100x).
    expect(ratio).toBeGreaterThan(0.33);
    expect(ratio).toBeLessThan(3);
  });

  test("failed sign-ins are throttled per email (across IPs), and the lock expires", async () => {
    const email = await signUp();
    for (let i = 0; i < 5; i++)
      expect((await signIn(email, "wrong-password-123", `192.0.2.${i}`)).status).toBe(401);
    const locked = await signIn(email, PASSWORD, "192.0.2.99");
    expect(locked.status).toBe(429);
    expect(locked.res.headers.get("retry-after")).toBe("900");
    expect(locked.body["code"]).toBe("rate_limited");

    h.clock.now = new Date(h.clock.now.getTime() + 15 * 60_000 + 1000);
    expect((await signIn(email, PASSWORD, "192.0.2.99")).status).toBe(200);
  });

  test("failed sign-ins are throttled per IP (across emails), even for unknown emails", async () => {
    const ip = "192.0.2.200";
    for (let i = 0; i < 5; i++) await signIn(`ghost-${i}@example.test`, "wrong-password-123", ip);
    expect((await signIn("another@example.test", "whatever-whatever", ip)).status).toBe(429);
  });

  test("passwords shorter than 12 characters are rejected", async () => {
    const res = await h.json("POST", "/api/auth/sign-up/email", {
      body: { email: "short@example.test", password: "elevenchars", name: "x" },
    });
    expect(res.status).toBe(400);
  });
});

describe("password change", () => {
  test("requires the current password and revokes all other sessions", async () => {
    const email = await signUp();
    const a = (await signIn(email, PASSWORD, "203.0.113.20")).body["token"] as string;
    const b = (await signIn(email, PASSWORD, "203.0.113.21")).body["token"] as string;
    expect((await h.request("GET", "/v1/me", { token: b })).status).toBe(200);

    const wrong = await h.request("POST", "/api/auth/change-password", {
      token: a,
      body: { currentPassword: "not-the-password", newPassword: "a brand new password" },
    });
    expect(wrong.status).toBeGreaterThanOrEqual(400);

    // Client does not ask for revocation; the server forces it.
    const ok = await h.request("POST", "/api/auth/change-password", {
      token: a,
      body: { currentPassword: PASSWORD, newPassword: "a brand new password", revokeOtherSessions: false },
    });
    expect(ok.status).toBe(200);
    expect((await h.request("GET", "/v1/me", { token: b })).status).toBe(401);
    expect((await signIn(email, "a brand new password", "203.0.113.22")).status).toBe(200);
  });
});

describe("the password hash never leaves the server", () => {
  test("not in sign-in, session, /v1/me, or export responses", async () => {
    const email = await signUp();
    const [account] = await h.handle.db.select({ password: accounts.password }).from(accounts);
    const hashes = (await h.handle.db.select({ password: accounts.password }).from(accounts))
      .map((r) => r.password)
      .filter(Boolean);
    expect(account).toBeDefined();
    const signedIn = await signIn(email, PASSWORD, "203.0.113.30");
    const token = signedIn.body["token"] as string;
    const bodies = [
      signedIn.text,
      await (await h.request("GET", "/api/auth/get-session", { token })).text(),
      await (await h.request("GET", "/v1/me", { token })).text(),
      await (await h.request("GET", "/v1/export", { token })).text(),
      await (await h.request("GET", "/v1/export?format=markdown", { token })).text(),
    ];
    for (const body of bodies) {
      for (const hash of hashes) expect(body).not.toContain(hash);
      expect(body).not.toMatch(/"password"/);
    }
  });
});

describe("personal access tokens", () => {
  test("scopes are enforced and revocation works", async () => {
    const { token: session } = await h.session();
    const read = await h.json("POST", "/v1/tokens", {
      token: session,
      body: { name: "reader", scope: "read" },
    });
    const write = await h.json("POST", "/v1/tokens", {
      token: session,
      body: { name: "writer", scope: "write" },
    });
    expect(read.status).toBe(201);
    const readToken = read.body["token"] as string;
    const writeToken = write.body["token"] as string;

    expect((await h.request("GET", "/v1/change-targets", { token: readToken })).status).toBe(200);
    const denied = await h.json("POST", "/v1/change-targets", { token: readToken, body: { title: "x" } });
    expect(denied.status).toBe(403);
    expect(denied.body["code"]).toBe("insufficient_scope");
    expect(
      (await h.request("POST", "/v1/change-targets", { token: writeToken, body: { title: "x" } })).status,
    ).toBe(201);
    expect((await h.json("GET", "/v1/me", { token: readToken })).body["scopes"]).toEqual(["read"]);

    // Tokens cannot mint tokens.
    expect(
      (await h.request("POST", "/v1/tokens", { token: writeToken, body: { name: "child", scope: "write" } }))
        .status,
    ).toBe(403);

    const listed = await h.json<{ items: unknown[] }>("GET", "/v1/tokens", { token: session });
    expect(JSON.stringify(listed.body)).not.toContain("te_pat_");
    expect((await h.request("DELETE", `/v1/tokens/${read.body["id"]}`, { token: session })).status).toBe(204);
    expect((await h.request("GET", "/v1/change-targets", { token: readToken })).status).toBe(401);
  });
});

describe("cross-user isolation over REST", () => {
  test("user B cannot read or change user A's rows", async () => {
    const a = await h.session();
    const b = await h.session();
    const target = await h.json("POST", "/v1/change-targets", { token: a.token, body: { title: "A only" } });
    const tid = target.body["id"] as string;
    const tool = await h.json("POST", "/v1/tools", {
      token: a.token,
      body: { changeTargetId: tid, type: "evidence_log" },
    });
    const toolId = tool.body["id"] as string;
    const entry = await h.json("POST", "/v1/entries", {
      token: a.token,
      body: { toolId, clientId: crypto.randomUUID(), payload: { summary: "A's" } },
    });
    const reminder = await h.json("POST", "/v1/reminders", {
      token: a.token,
      body: { toolId, schedule: { type: "daily", time: "08:00" } },
    });

    const asB = (method: string, path: string, body?: unknown) =>
      h.request(method, path, { token: b.token, ...(body ? { body } : {}) });
    for (const [method, path, body] of [
      ["GET", `/v1/change-targets/${tid}`],
      ["PATCH", `/v1/change-targets/${tid}`, { title: "hijack" }],
      ["DELETE", `/v1/change-targets/${tid}`],
      ["GET", `/v1/change-targets/${tid}/summary`],
      ["GET", `/v1/tools/${toolId}`],
      ["PATCH", `/v1/tools/${toolId}`, { name: "hijack" }],
      ["DELETE", `/v1/tools/${toolId}`],
      ["GET", `/v1/entries/${entry.body["id"]}`],
      ["PATCH", `/v1/entries/${entry.body["id"]}`, { payload: { summary: "hijack" } }],
      ["DELETE", `/v1/entries/${entry.body["id"]}`],
      ["PATCH", `/v1/reminders/${reminder.body["id"]}`, { enabled: false }],
      ["POST", `/v1/reminders/${reminder.body["id"]}/test`],
      ["DELETE", `/v1/reminders/${reminder.body["id"]}`],
      ["POST", "/v1/tools", { changeTargetId: tid, type: "evidence_log" }],
      ["POST", "/v1/entries", { toolId, clientId: crypto.randomUUID(), payload: { summary: "x" } }],
    ] as const) {
      expect((await asB(method, path, body)).status, `${method} ${path}`).toBe(404);
    }
    for (const path of [
      "/v1/change-targets",
      `/v1/tools?changeTargetId=${tid}`,
      `/v1/entries?toolId=${toolId}`,
      "/v1/reminders",
    ]) {
      const res = await h.json<{ items: unknown[] }>("GET", path, { token: b.token });
      expect(res.body.items, path).toEqual([]);
    }
    expect((await h.json("GET", `/v1/change-targets/${tid}`, { token: a.token })).body["title"]).toBe(
      "A only",
    );
  });
});

describe("production mode", () => {
  test("sign-up is 403 on every route and the test session route does not exist", async () => {
    const handle = await createTestDb();
    try {
      const { app } = createContainerFromHandle(
        testEnv({ NODE_ENV: "production", DATABASE_URL: "postgres://unused", LOG_LEVEL: "silent" }),
        handle,
      );
      const post = (path: string, body: unknown) =>
        app.request(`http://localhost:3000${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      for (const path of ["/api/auth/sign-up/email", "/api/auth/sign-up/anything"]) {
        const res = await post(path, {
          email: "intruder@example.test",
          password: "a long enough password",
          name: "x",
        });
        expect(res.status, path).toBe(403);
      }
      expect((await post("/api/test/session", {})).status).toBe(404);
      const users = await handle.db.query.users.findMany();
      expect(users).toEqual([]);
    } finally {
      await handle.close();
    }
  });
});

describe("write rate limit", () => {
  const limited = useApi({ WRITE_RATE_LIMIT_PER_MINUTE: "3" });
  test("more than N writes per minute per user is 429; reads are unaffected", async () => {
    const { token } = await limited.session();
    for (let i = 0; i < 3; i++)
      expect(
        (await limited.request("POST", "/v1/change-targets", { token, body: { title: `t${i}` } })).status,
      ).toBe(201);
    const res = await limited.request("POST", "/v1/change-targets", {
      token,
      body: { title: "one too many" },
    });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await limited.request("GET", "/v1/change-targets", { token })).status).toBe(200);
    const other = await limited.session();
    expect(
      (
        await limited.request("POST", "/v1/change-targets", {
          token: other.token,
          body: { title: "other user" },
        })
      ).status,
    ).toBe(201);
  });
});
