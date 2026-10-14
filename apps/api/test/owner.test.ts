import { createTestDb, type DbHandle } from "@te/db";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createContainerFromHandle, type Container } from "../src/container.ts";
import { createOwner, setOwnerPassword } from "../src/auth/owner.ts";
import { testEnv } from "./harness.ts";

let handle: DbHandle;
let c: Container;
beforeEach(async () => {
  handle = await createTestDb();
  c = createContainerFromHandle(
    testEnv({ NODE_ENV: "production", DATABASE_URL: "postgres://unused", LOG_LEVEL: "silent" }),
    handle,
  );
});
afterEach(async () => handle.close());

const signIn = (email: string, password: string) =>
  c.app.request("http://localhost:3000/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", "fly-client-ip": crypto.randomUUID() },
    body: JSON.stringify({ email, password }),
  });

describe("owner bootstrap", () => {
  test("creates exactly one owner who can then sign in (even with sign-up disabled)", async () => {
    await createOwner(c.auth, { email: "Owner@Example.test", password: "a very good password" });
    const res = await signIn("owner@example.test", "a very good password");
    expect(res.status).toBe(200);
    await expect(
      createOwner(c.auth, { email: "second@example.test", password: "a very good password" }),
    ).rejects.toThrow(/already exists/);
    expect(await handle.db.query.users.findMany()).toHaveLength(1);
  });

  test("rejects short passwords", async () => {
    await expect(createOwner(c.auth, { email: "o@example.test", password: "short" })).rejects.toThrow(
      /at least 12/,
    );
  });

  test("set-password changes the password and revokes every session", async () => {
    await createOwner(c.auth, { email: "o@example.test", password: "a very good password" });
    const token = (
      (await (await signIn("o@example.test", "a very good password")).json()) as { token: string }
    ).token;
    const me = () =>
      c.app.request("http://localhost:3000/v1/me", { headers: { authorization: `Bearer ${token}` } });
    expect((await me()).status).toBe(200);
    await setOwnerPassword(c.auth, { email: "o@example.test", password: "another good password" });
    expect((await me()).status).toBe(401);
    expect((await signIn("o@example.test", "a very good password")).status).toBe(401);
    expect((await signIn("o@example.test", "another good password")).status).toBe(200);
  });
});
