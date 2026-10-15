import { expect, test } from "vitest";
import { createGitHubArchiveStore } from "../src/archive/github.ts";

test("commits all files in one commit on top of the default branch", async () => {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  const responses: Record<string, unknown> = {
    "GET /repos/me/archive": { default_branch: "main" },
    "GET /repos/me/archive/git/ref/heads/main": { object: { sha: "head-sha" } },
    "GET /repos/me/archive/git/commits/head-sha": { tree: { sha: "base-tree" } },
    "POST /repos/me/archive/git/trees": { sha: "new-tree" },
    "POST /repos/me/archive/git/commits": { sha: "new-commit" },
    "PATCH /repos/me/archive/git/refs/heads/main": { object: { sha: "new-commit" } },
  };
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push({ method, url: url.pathname, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer t0ken");
    const body = responses[`${method} ${url.pathname}`];
    return body ? new Response(JSON.stringify(body), { status: 200 }) : new Response("nope", { status: 404 });
  };
  const store = createGitHubArchiveStore({ repo: "me/archive", token: "t0ken", fetch: fakeFetch });
  const result = await store.writeSnapshot(
    [
      { path: "README.md", content: "# hi" },
      { path: "users/u/traitengineer.md", content: "md" },
    ],
    "Nightly archive 2026-10-15",
  );
  expect(result).toEqual({ id: "new-commit" });
  expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual(Object.keys(responses));
  expect(calls[3]?.body).toEqual({
    base_tree: "base-tree",
    tree: [
      { path: "README.md", mode: "100644", type: "blob", content: "# hi" },
      { path: "users/u/traitengineer.md", mode: "100644", type: "blob", content: "md" },
    ],
  });
  expect(calls[4]?.body).toEqual({
    message: "Nightly archive 2026-10-15",
    tree: "new-tree",
    parents: ["head-sha"],
  });
  expect(calls[5]?.body).toEqual({ sha: "new-commit", force: false });
});

test("surfaces GitHub errors", async () => {
  const store = createGitHubArchiveStore({
    repo: "me/archive",
    token: "x",
    fetch: async () => new Response("Bad credentials", { status: 401 }),
  });
  await expect(store.writeSnapshot([], "m")).rejects.toThrow(/401 Bad credentials/);
});
