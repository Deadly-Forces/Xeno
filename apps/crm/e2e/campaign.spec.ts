import { expect, test } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Workspace").fill("xeno");
  await page.getByLabel("Email").fill("marketer@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: 15_000 });
}

test("creates a segment with AI and launches a campaign", async ({ page }) => {
  await signIn(page);
  await page.goto("/segments");
  await page.getByPlaceholder("Ask for a segment or message...").fill("Create a segment named E2E High Spenders for customers who spent more than $500.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Segment created", { exact: false })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("E2E High Spenders", { exact: true }).last()).toBeVisible();
  await page.goto("/campaigns/new");
  await page.getByText("E2E High Spenders", { exact: true }).last().click();
  await expect(page.getByText("Sample customers")).toBeVisible();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: "Launch now" }).last().click();
  await expect(page).toHaveURL(/\/campaigns\/(?!new$)[^/]+$/, { timeout: 15_000 });
  await expect(page.getByText("Messages", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => Number(await page.locator("article").filter({ hasText: "Messages" }).locator("strong").textContent()), { timeout: 30_000 }).toBeGreaterThan(0);
});

test("preserves explicit promotional details in an AI message draft", async ({ page }) => {
  await signIn(page);
  await page.goto("/campaigns/new");
  await page.getByPlaceholder("Ask for a segment or message...").fill("Create a WhatsApp message for all customers saying there is 30% off all products if they shop within 30 minutes.");
  await page.getByRole("button", { name: "Send" }).click();

  const draft = page.getByTestId("message-draft-card").locator("p");
  await expect(draft).toContainText("30%", { timeout: 60_000 });
  await expect(draft).toContainText(/all products|everything in the store/i);
  await expect(draft).toContainText(/30 minutes/i);
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
