import { expect, test, type Page } from "@playwright/test";
import { createUser, seedData, signIn } from "./helpers";

const OUT = "../../docs/screenshots";

async function shot(page: Page, project: string, name: string) {
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${OUT}/${project}/${name}.png`, fullPage: true });
}

test("every screen renders on web (screenshots for docs/screenshots)", async ({ page, request }, info) => {
  const project = info.project.name; // narrow (390px) | wide (1280px)
  const { email, token } = await createUser(request, "screens");
  const { actionId, toolId } = await seedData(request, token);

  await page.goto("/sign-in");
  await expect(page.getByTestId("screen-sign-in")).toBeVisible();
  await shot(page, project, "01-sign-in");

  await signIn(page, email);
  await expect(page.getByTestId("target-card")).toHaveCount(2);
  await shot(page, project, "02-today");

  await page.goto(`/log/${toolId}`);
  await expect(page.getByTestId("screen-log")).toBeVisible();
  await page.getByLabel("What did you do?").fill("Shipped the draft without polishing the intro");
  await shot(page, project, "03-quick-log");

  await page.goto("/targets");
  await expect(page.getByTestId("screen-targets")).toBeVisible();
  await shot(page, project, "04-targets");

  await page.goto("/targets/new");
  await expect(page.getByTestId("screen-target-new")).toBeVisible();
  await shot(page, project, "05-target-new");

  await page.goto(`/targets/${actionId}`);
  await expect(page.getByTestId("weekly-chart")).toBeVisible();
  await expect(page.getByTestId("entry-card").first()).toBeVisible();
  await shot(page, project, "06-target-detail");

  await page.goto(`/targets/${actionId}/edit`);
  await expect(page.getByTestId("screen-target-edit")).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("Default to action rather than over-planning");
  await shot(page, project, "07-target-edit");

  await page.goto(`/targets/${actionId}`);
  await page.getByTestId("entry-card").first().click();
  await expect(page.getByTestId("screen-entry")).toBeVisible();
  await shot(page, project, "08-entry");

  await page.goto("/reminders");
  await expect(page.getByTestId("reminder-card")).toHaveCount(1);
  await shot(page, project, "09-reminders");

  await page.goto("/settings");
  await expect(page.getByTestId("screen-settings")).toBeVisible();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await shot(page, project, "10-settings");

  await page.goto("/consent");
  await expect(page.getByTestId("screen-consent")).toBeVisible();
  await shot(page, project, "11-consent-empty");
});

test("layout: tab bar on narrow screens, sidebar on wide ones", async ({ page, request }, info) => {
  const { email } = await createUser(request);
  await signIn(page, email);
  if (info.project.name === "wide") {
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(page.getByRole("tablist")).toHaveCount(0);
  } else {
    await expect(page.getByRole("tablist")).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
  }
});

test("every tappable control is at least 44px", async ({ page, request }) => {
  const { email, token } = await createUser(request);
  await seedData(request, token);
  await signIn(page, email);
  for (const path of ["/", "/targets", "/reminders", "/settings"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const small = await page
      .locator('[role="button"], [role="link"], [role="radio"], [role="switch"], input')
      .evaluateAll((els) =>
        els
          .filter((el) => !el.closest('[aria-hidden="true"]'))
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && r.height > 0 && (r.height < 43.5 || r.width < 43.5))
          .map(
            ({ el, r }) =>
              `${el.getAttribute("aria-label") ?? el.textContent?.slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`,
          ),
      );
    expect(small, path).toEqual([]);
  }
});
