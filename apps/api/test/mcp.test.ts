import { createHash, randomBytes } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { describe, expect, test } from "vitest";
import { useApi } from "./harness.ts";

const h = useApi();
const BASE = "http://localhost:3000";
const path = (url: unknown) => new URL(String(url)).pathname;

/** An MCP SDK client speaking real Streamable HTTP to the in-process app. */
async function mcpClient(token: string) {
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), {
    requestInit: { headers: { authorization: `Bearer ${token}` } },
    fetch: (input, init) => Promise.resolve(h.container.app.request(new Request(input, init))),
  });
  const client = new Client({ name: "api-test", version: "1.0.0" });
  // The SDK's transport class declares optional members without `| undefined`, which trips
  // exactOptionalPropertyTypes; the runtime shape is exactly a Transport.
  await client.connect(transport as unknown as Transport);
  return client;
}

describe("/mcp authentication", () => {
  test("unauthenticated requests get 401 with RFC 9728 resource metadata in WWW-Authenticate", async () => {
    const res = await h.request("POST", "/mcp", { body: { jsonrpc: "2.0", id: 1, method: "tools/list" } });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe(
      `Bearer resource_metadata="${BASE}/.well-known/oauth-protected-resource/mcp", scope="read write"`,
    );
    for (const token of ["garbage", "te_pat_nope", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig"]) {
      expect((await h.request("POST", "/mcp", { token, body: {} })).status).toBe(401);
    }
  });

  test("a personal access token works with the SDK's Streamable HTTP client; read tokens cannot write", async () => {
    const { token: session } = await h.session();
    const write = await h.json("POST", "/v1/tokens", {
      token: session,
      body: { name: "claude code", scope: "write" },
    });
    const read = await h.json("POST", "/v1/tokens", {
      token: session,
      body: { name: "reader", scope: "read" },
    });

    const client = await mcpClient(write.body["token"] as string);
    expect((await client.listTools()).tools.length).toBe(7);
    const created = (await client.callTool({
      name: "create_change_target",
      arguments: { title: "Via MCP", oldPattern: "", desiredDefault: "", why: "" },
    })) as unknown as { structuredContent: { tool: { id: string } } };
    const logged = (await client.callTool({
      name: "log_entry",
      arguments: { toolId: created.structuredContent.tool.id, payload: { summary: "Logged over HTTP" } },
    })) as { isError?: boolean };
    expect(logged.isError).toBeFalsy();
    // Visible through REST too: same core rules, same data.
    const entries = await h.json<{ items: { source: string }[] }>("GET", "/v1/entries", { token: session });
    expect(entries.body.items[0]?.source).toBe("mcp");

    const reader = await mcpClient(read.body["token"] as string);
    const denied = (await reader.callTool({
      name: "log_entry",
      arguments: { toolId: created.structuredContent.tool.id, payload: { summary: "nope" } },
    })) as { isError?: boolean };
    expect(denied.isError).toBe(true);
  });
});

describe("OAuth discovery and authorisation for MCP clients", () => {
  test("discovery → dynamic registration → authorize (PKCE) → consent → token → /mcp", async () => {
    // 1. Discovery, as an MCP client does after the 401.
    const prm = await h.json<{
      resource: string;
      authorization_servers: string[];
      scopes_supported: string[];
    }>("GET", "/.well-known/oauth-protected-resource/mcp");
    expect(prm.status).toBe(200);
    expect(prm.body.resource).toBe(`${BASE}/mcp`);
    expect(prm.body.scopes_supported).toEqual(expect.arrayContaining(["read", "write"]));
    const issuer = prm.body.authorization_servers[0] ?? "";
    expect(issuer).toBe(`${BASE}/api/auth`);

    const asm = await h.json<Record<string, string | string[]>>(
      "GET",
      `/.well-known/oauth-authorization-server${new URL(issuer).pathname}`,
    );
    expect(asm.status).toBe(200);
    expect(asm.body["code_challenge_methods_supported"]).toEqual(expect.arrayContaining(["S256"]));
    const bare = await h.json<Record<string, unknown>>("GET", "/.well-known/oauth-authorization-server");
    expect(bare.body["issuer"]).toBe(issuer);

    // 2. Dynamic client registration (public client, like Claude).
    const redirectUri = "https://claude.example.test/api/mcp/auth_callback";
    const reg = await h.json<{ client_id: string }>("POST", path(asm.body["registration_endpoint"]), {
      body: {
        client_name: "Test MCP client",
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      },
    });
    expect(reg.status, JSON.stringify(reg.body)).toBeLessThan(300);
    const clientId = reg.body.client_id;

    // 3. Authorize with PKCE as the signed-in owner → redirected to our consent page.
    const { token: session, userId } = await h.session();
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const authorize = new URL(String(asm.body["authorization_endpoint"]));
    authorize.search = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "read write offline_access",
      state: "xyz",
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: `${BASE}/mcp`,
    }).toString();
    const authRes = await h.request("GET", `${authorize.pathname}${authorize.search}`, { token: session });
    expect(authRes.status, await authRes.clone().text()).toBeGreaterThanOrEqual(300);
    const consentUrl = new URL(authRes.headers.get("location") ?? "", BASE);
    expect(consentUrl.pathname).toBe("/consent");
    expect(consentUrl.searchParams.get("scope")).toContain("write");

    // 4. The owner approves on the consent screen.
    const consent = await h.json<{ url?: string; redirect_uri?: string }>(
      "POST",
      "/api/auth/oauth2/consent",
      {
        token: session,
        body: { accept: true, oauth_query: consentUrl.search.slice(1) },
      },
    );
    expect(consent.status, JSON.stringify(consent.body)).toBe(200);
    const callback = new URL(consent.body.url ?? consent.body.redirect_uri ?? "");
    expect(`${callback.origin}${callback.pathname}`).toBe(redirectUri);
    expect(callback.searchParams.get("state")).toBe("xyz");
    const code = callback.searchParams.get("code") ?? "";

    // 5. Exchange the code (PKCE verifier, no client secret).
    const tokenRes = await h.container.app.request(`${BASE}${path(asm.body["token_endpoint"])}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: verifier,
        resource: `${BASE}/mcp`,
      }),
    });
    const tokens = (await tokenRes.json()) as { access_token: string; refresh_token?: string; scope: string };
    expect(tokenRes.status, JSON.stringify(tokens)).toBe(200);
    expect(tokens.scope).toContain("write");

    // 6. The access token works on /mcp as the owner.
    const client = await mcpClient(tokens.access_token);
    const created = (await client.callTool({
      name: "create_change_target",
      arguments: { title: "Created over OAuth", oldPattern: "", desiredDefault: "", why: "" },
    })) as { isError?: boolean };
    expect(created.isError).toBeFalsy();
    const mine = await h.json<{ items: { title: string }[] }>("GET", "/v1/change-targets", {
      token: session,
    });
    expect(mine.body.items.map((t) => t.title)).toContain("Created over OAuth");
    expect(userId).toBeTruthy();

    // A wrong PKCE verifier is rejected (code reuse is also refused).
    const replay = await h.container.app.request(`${BASE}${path(asm.body["token_endpoint"])}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: "wrong",
      }),
    });
    expect(replay.status).toBeGreaterThanOrEqual(400);
  });

  test("without a session, authorize sends the user to the sign-in page", async () => {
    const reg = await h.json<{ client_id: string }>("POST", "/api/auth/oauth2/register", {
      body: {
        client_name: "x",
        redirect_uris: ["https://x.example.test/cb"],
        token_endpoint_auth_method: "none",
      },
    });
    const qs = new URLSearchParams({
      response_type: "code",
      client_id: reg.body.client_id,
      redirect_uri: "https://x.example.test/cb",
      scope: "read",
      code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
      code_challenge_method: "S256",
      state: "s",
    });
    const res = await h.request("GET", `/api/auth/oauth2/authorize?${qs}`);
    expect(new URL(res.headers.get("location") ?? "", BASE).pathname).toBe("/sign-in");
  });
});
