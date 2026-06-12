import { expect, test } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page, email = "marketer@example.com"): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Workspace").fill("xeno");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

test("core pages expose landmarks, headings, labels, and keyboard focus", async ({ page }) => {
  await signIn(page);
  for (const path of ["/", "/customers", "/segments", "/campaigns/new", "/analytics"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    expect(await page.locator("input:not([aria-label]):not([id]), textarea:not([aria-label]):not([id])").count()).toBe(0);
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toBeVisible();
  }
});

test("analyst cannot execute mutating AI or administrative operations", async ({ page }) => {
  await signIn(page, "analyst@example.com");
  expect((await page.request.post("/api/campaigns", { data: {} })).status()).toBe(403);
  expect((await page.request.post("/api/ai/chat", { data: { messages: [] } })).status()).toBe(403);
  expect((await page.request.get("/api/admin/audit")).status()).toBe(403);
});
