import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createUser, PASSWORD } from "./helpers";

test("MCP OAuth: authorize → sign-in → consent screen lists scopes → Allow redirects with a code", async ({
  page,
  request,
}, info) => {
  const { email } = await createUser(request);
  const redirectUri = "https://claude.example.test/api/mcp/auth_callback";
  const reg = await request.post("/api/auth/oauth2/register", {
    data: { client_name: "Claude", redirect_uris: [redirectUri], token_endpoint_auth_method: "none" },
  });
  const { client_id } = (await reg.json()) as { client_id: string };
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const qs = new URLSearchParams({
    response_type: "code",
    client_id,
    redirect_uri: redirectUri,
    scope: "read write",
    state: "st",
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: `${info.project.use.baseURL}/mcp`,
  });

  // Capture the final redirect to the (fake) client instead of leaving the app.
  let callback: URL | undefined;
  await page.route("https://claude.example.test/**", async (route) => {
    callback = new URL(route.request().url());
    await route.fulfill({ body: "ok" });
  });

  await page.goto(`/api/auth/oauth2/authorize?${qs}`);
  await expect(page).toHaveURL(/\/sign-in\?/);
  await expect(page.getByText("Sign in to connect an AI assistant")).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/consent\?/);
  await expect(page.getByRole("heading", { name: "Connect Claude?" })).toBeVisible();
  await expect(page.getByText(/Read your change targets/)).toBeVisible();
  await expect(page.getByText(/log entries on your behalf/)).toBeVisible();
  await page.screenshot({
    path: `../../docs/screenshots/${info.project.name}/12-consent.png`,
    fullPage: true,
  });
  await page.getByTestId("consent-allow").click();

  await expect.poll(() => callback?.searchParams.get("code") ?? null).not.toBeNull();
  expect(callback?.searchParams.get("state")).toBe("st");
});
