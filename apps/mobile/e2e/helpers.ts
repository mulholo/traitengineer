import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const PASSWORD = "e2e password that is long";

/** Create a fresh owner through the API (sign-up is only possible under NODE_ENV=test). */
export async function createUser(request: APIRequestContext, prefix = "e2e") {
  const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
  const res = await request.post("/api/auth/sign-up/email", {
    data: { email, password: PASSWORD, name: "Sam" },
  });
  expect(res.ok()).toBeTruthy();
  const { token } = (await res.json()) as { token: string };
  return { email, token };
}

/** Seed realistic data through the REST API (two targets, ~20 entries over 8 weeks, a reminder). */
export async function seedData(request: APIRequestContext, token: string) {
  const headers = { authorization: `Bearer ${token}` };
  const post = async (path: string, data: unknown) => {
    const res = await request.post(path, { headers, data });
    expect(res.ok(), `${path}: ${await res.text()}`).toBeTruthy();
    return (await res.json()) as Record<string, string>;
  };
  const action = await post("/v1/change-targets", {
    title: "Default to action rather than over-planning",
    oldPattern: "Rewrite the plan until the moment has passed",
    desiredDefault: "Ship the first good-enough version",
    why: "Momentum compounds",
  });
  const voice = await post("/v1/change-targets", {
    title: "Speak up early",
    oldPattern: "Wait until I'm certain",
    desiredDefault: "Share the half-formed thought",
    why: "My best ideas die in my head",
  });
  const tool = await post("/v1/tools", { changeTargetId: action["id"], type: "evidence_log" });
  await post("/v1/tools", { changeTargetId: voice["id"], type: "evidence_log" });
  const now = Date.now();
  const summaries = [
    "Sent the proposal without a third rewrite",
    "Started before the plan was perfect",
    "Shipped the draft for feedback",
  ];
  for (let i = 0; i < 20; i++) {
    await post("/v1/entries", {
      toolId: tool["id"],
      clientId: crypto.randomUUID(),
      occurredAt: new Date(now - (i * 2.7 + 1) * 86_400_000).toISOString(),
      source: "web",
      payload: {
        summary: summaries[i % 3],
        expected: "That it would go badly",
        happened: "It was fine",
        supports: "Good enough is good enough",
        difficulty: (i % 5) + 1,
        tags: ["work"],
      },
    });
  }
  await post("/v1/reminders", {
    toolId: tool["id"],
    schedule: { type: "weekdays", time: "18:00" },
    title: "What did you do differently today?",
  });
  return { actionId: action["id"] ?? "", toolId: tool["id"] ?? "" };
}

export async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
}
