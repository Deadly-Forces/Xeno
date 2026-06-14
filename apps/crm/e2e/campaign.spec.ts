import { expect, test } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Workspace").fill("xeno");
  await page.getByLabel("Email").fill("marketer@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: 15_000 });
}

test("builds, approves, and launches an autopilot campaign", async ({ page }) => {
  await signIn(page);
  await page.goto("/campaigns/new");
  await page.getByLabel("Campaign objective and constraints").fill("Win back high-value shoppers who have not ordered in 60 days without exceeding $100.");
  await page.getByRole("button", { name: "Build plan" }).click();
  await expect(page.getByText("Eligible reach", { exact: true })).toBeVisible();
  await expect(page.getByText("Within budget", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Decision trace" }).click();
  await expect(page.getByText("Intent parsed", { exact: true })).toBeVisible();
  await expect(page.getByText("Policy engine", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Exclusions" }).click();
  await expect(page.getByText("Excluded customers and reasons", { exact: true })).toBeVisible();
  await page.getByLabel("Approve campaign plan").check();
  await page.getByRole("button", { name: /Approve and launch/ }).click();
  await expect(page).toHaveURL(/\/campaigns\/(?!new$)[^/]+$/, { timeout: 15_000 });
  await expect(page.getByText("Messages", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("AI post-campaign analyst", { exact: true })).toBeVisible();
  await expect(page.getByText("No-send holdout", { exact: true })).toBeVisible();
  await expect(page.getByText("Adaptive guardrails", { exact: true })).toBeVisible();
});

test("autopilot preflight extracts marketer constraints", async ({ page }) => {
  await signIn(page);
  const response = await page.request.post("/api/campaigns/autopilot/plan", { data: { intent: "Win back high-value shoppers who have not ordered in 90 days without exceeding $75." } });
  expect(response.ok()).toBe(true);
  const body = await response.json() as { estimates: { budget: number; cost: number }; trace: Array<{ detail: string }>; segment: { description: string } };
  expect(body.estimates.budget).toBe(75);
  expect(body.estimates.cost).toBeLessThanOrEqual(75);
  expect(body.segment.description).toContain("90 days");
  expect(body.trace[0]?.detail).toContain("$75");
});

test("regenerate replaces both copy variants with the explicit offer", async ({ page }) => {
  await signIn(page);
  await page.goto("/campaigns/new");
  await page
    .getByLabel("Campaign objective and constraints")
    .fill("high vaue customer can win back $100");
  await page.getByRole("button", { name: /Build plan|Regenerate/ }).click();

  await expect(page.getByLabel("Control message")).toHaveValue(/win back \$100/);
  await expect(page.getByLabel("AI treatment")).toHaveValue(/win back \$100/);
});

test("generates validated segment DSL through the dedicated AI endpoint", async ({ page }) => {
  await signIn(page);
  const response = await page.request.post("/api/segments/ai", { data: { description: "Customers who spent more than $500" } });
  expect(response.ok()).toBe(true);
  const body = await response.json() as { rules: { operator: string; rules: Array<{ field?: string; operator?: string; value?: unknown }> }; explanation: string };

  expect(body.rules.operator).toBe("AND");
  expect(body.rules.rules).toEqual(expect.arrayContaining([expect.objectContaining({ field: "totalOrderValue", operator: "gt", value: 500 })]));
  expect(body.explanation.length).toBeGreaterThan(0);
});
