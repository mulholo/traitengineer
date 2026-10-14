import { createApiClient } from "@te/client";
import { expect, test } from "vitest";
import { useApi } from "./harness.ts";

const h = useApi();

test("the generated client round-trips against the real app", async () => {
  const { token } = await h.session();
  const client = createApiClient({
    baseUrl: "http://localhost:3000",
    getToken: () => token,
    fetch: (input) => Promise.resolve(h.container.app.request(input as Request)),
  });
  const target = await client.POST("/v1/change-targets", { body: { title: "From the client" } });
  expect(target.response.status).toBe(201);
  const id = target.data?.id ?? "";
  const tool = await client.POST("/v1/tools", { body: { changeTargetId: id, type: "evidence_log" } });
  const entry = await client.POST("/v1/entries", {
    body: { toolId: tool.data?.id ?? "", clientId: crypto.randomUUID(), payload: { summary: "typed!" } },
  });
  expect(entry.data?.payload["summary"]).toBe("typed!");
  const got = await client.GET("/v1/change-targets/{id}", { params: { path: { id } } });
  expect(got.data?.title).toBe("From the client");
  const missing = await client.GET("/v1/change-targets/{id}", {
    params: { path: { id: crypto.randomUUID() } },
  });
  expect(missing.error?.code).toBe("not_found");
});
