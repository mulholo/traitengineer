import { expect, test } from "@playwright/test";
import { createUser, signIn } from "./helpers";

test("sign-in page has no sign-up or forgot-password links", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByText(/sign up|create account|forgot/i)).toHaveCount(0);
});

test("wrong password shows one generic message", async ({ page, request }) => {
  const { email } = await createUser(request);
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("definitely not it");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
});

test("sign in → create target → log an entry in three taps → see it on Today", async ({ page, request }) => {
  const { email } = await createUser(request);
  await signIn(page, email);

  await page.getByRole("link", { name: "Targets" }).first().click();
  await page.getByTestId("new-target").click();
  await page.getByLabel("Title").fill("Default to action");
  await page.getByLabel("Desired default").fill("Ship the first version");
  await page.getByRole("button", { name: "Create target" }).click();
  await expect(page.getByRole("heading", { name: "Default to action" })).toBeVisible();

  await page.getByRole("link", { name: "Today" }).first().click();
  // Tap 1: Log. Tap 2 (typing): what I did — autofocused. Tap 3: Save.
  await page.getByTestId("log-button").first().click();
  const summary = page.getByLabel("What did you do?");
  await expect(summary).toBeFocused();
  await summary.fill("Sent the proposal without a third rewrite");
  await expect(page.getByTestId("save-entry")).toBeInViewport();
  await page.getByTestId("save-entry").click();

  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
  await expect(page.getByText("Sent the proposal without a third rewrite")).toBeVisible();
  await expect(page.getByText("Logged today")).toBeVisible();
});

test("log offline: banner shows waiting entries, then syncs on reconnect", async ({
  page,
  request,
  context,
}) => {
  const { email, token } = await createUser(request);
  const t = await request.post("/v1/change-targets", {
    headers: { authorization: `Bearer ${token}` },
    data: { title: "Offline target" },
  });
  const target = (await t.json()) as { id: string };
  await request.post("/v1/tools", {
    headers: { authorization: `Bearer ${token}` },
    data: { changeTargetId: target.id, type: "evidence_log" },
  });
  await signIn(page, email);

  await context.setOffline(true);
  await page.getByTestId("log-button").first().click();
  await page.getByLabel("What did you do?").fill("Logged while offline");
  await page.getByTestId("save-entry").click();
  await expect(page.getByTestId("sync-banner")).toHaveText("1 entry waiting to sync");
  await expect(page.getByText("Logged while offline")).toBeVisible(); // optimistic

  await context.setOffline(false);
  await expect(page.getByTestId("sync-banner")).toHaveCount(0, { timeout: 15_000 });
  const entries = await request.get("/v1/entries", { headers: { authorization: `Bearer ${token}` } });
  const body = (await entries.json()) as { items: { payload: { summary: string } }[] };
  expect(body.items.map((e) => e.payload.summary)).toEqual(["Logged while offline"]);
});

test("an entry logged offline survives a reload and syncs once (persisted mutation, idempotent clientId)", async ({
  page,
  request,
  context,
}) => {
  const { email, token } = await createUser(request);
  const auth = { authorization: `Bearer ${token}` };
  const target = (await (
    await request.post("/v1/change-targets", { headers: auth, data: { title: "Reload target" } })
  ).json()) as { id: string };
  await request.post("/v1/tools", {
    headers: auth,
    data: { changeTargetId: target.id, type: "evidence_log" },
  });
  await signIn(page, email);

  await context.setOffline(true);
  await page.getByTestId("log-button").first().click();
  await page.getByLabel("What did you do?").fill("Survives a reload");
  await page.getByTestId("save-entry").click();
  await expect(page.getByTestId("sync-banner")).toBeVisible();
  await page.waitForTimeout(1000); // let the persister flush (throttled)
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByText("Survives a reload").first()).toBeVisible();
  await expect(async () => {
    const body = (await (await request.get("/v1/entries", { headers: auth })).json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  }).toPass({ timeout: 15_000 });
});
