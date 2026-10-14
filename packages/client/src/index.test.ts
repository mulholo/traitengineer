import { expect, test } from "vitest";
import { createApiClient, isProblem } from "./index.ts";

test("adds the bearer token from getToken and parses JSON", async () => {
  let seen: Request | undefined;
  const client = createApiClient({
    baseUrl: "https://api.example.test",
    getToken: async () => "te_pat_abc",
    fetch: async (input) => {
      seen = input as Request;
      return new Response(JSON.stringify({ status: "ok", db: "ok" }), {
        headers: { "content-type": "application/json" },
      });
    },
  });
  const { data } = await client.GET("/health");
  expect(data).toEqual({ status: "ok", db: "ok" });
  expect(seen?.url).toBe("https://api.example.test/health");
  expect(seen?.headers.get("authorization")).toBe("Bearer te_pat_abc");
});

test("isProblem recognises RFC 9457 bodies", () => {
  expect(isProblem({ type: "x", title: "Not found", status: 404, code: "not_found" })).toBe(true);
  expect(isProblem({ items: [] })).toBe(false);
});
