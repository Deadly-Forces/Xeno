import { expect, test } from "@playwright/test";

test("AI Campaign Autopilot walkthrough", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Workspace").fill("xeno");
  await page.getByLabel("Email").fill("marketer@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/campaigns/new");
  await page.waitForTimeout(1_500);
  await page.getByLabel("Campaign objective and constraints").fill("Win back high-value shoppers who have not ordered in 60 days without exceeding $100.");
  await page.getByRole("button", { name: "Build plan" }).click();
  await expect(page.getByText("Eligible reach", { exact: true })).toBeVisible();
  await page.waitForTimeout(2_000);
  for (const tab of ["Audience", "Exclusions", "Decision trace", "Approval"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await page.waitForTimeout(1_500);
  }
  await page.getByLabel("Enable chaos mode").check();
  await page.waitForTimeout(1_000);
  await page.getByLabel("Approve campaign plan").check();
  await page.waitForTimeout(1_000);
  await page.getByRole("button", { name: /Approve and launch/ }).click();
  await expect(page).toHaveURL(/\/campaigns\/(?!new$)[^/]+$/, { timeout: 20_000 });
  await expect(page.getByText("AI post-campaign analyst", { exact: true })).toBeVisible();
  await page.waitForTimeout(4_000);
});
