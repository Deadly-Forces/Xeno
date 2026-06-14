import { expect, test } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page, email = "admin@example.com"): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Workspace").fill("xeno");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: 15_000 });
}

test("admin can successfully import customers via JSON", async ({ page }) => {
  await signIn(page, "admin@example.com");
  await page.goto("/customers");
  await page.getByRole("button", { name: "Import" }).click();
  
  const uniqueSuffix = Date.now().toString();
  const uniqueName = `Imported User ${uniqueSuffix}`;
  const uniqueId = `CUST-IMPORT-${uniqueSuffix}`;
  const uniquePhone = `+1555${Math.floor(Math.random() * 10000000).toString().padStart(7, "0")}`;
  
  const importData = [
    {
      externalId: uniqueId,
      name: uniqueName,
      email: `imported-${uniqueSuffix}@example.com`,
      phone: uniquePhone,
      tags: ["imported-test"],
      city: "Test City",
      ageGroup: "26-40",
      gender: "non-binary",
      channelPreference: "EMAIL",
      orders: []
    }
  ];

  await page.getByLabel("Customer JSON").fill(JSON.stringify(importData));
  await page.getByRole("button", { name: "Import customers" }).click();
  
  await expect(page.getByText("1 customers imported")).toBeVisible();
  
  // Verify customer appears in the list
  await page.getByText("Close", { exact: true }).click();
  await page.getByLabel("Search customers").fill(uniqueName);
  await expect(page.getByText(uniqueName)).toBeVisible();
});

test("marketer is blocked from bulk importing customers", async ({ page }) => {
  await signIn(page, "marketer@example.com");
  await page.goto("/customers");
  await page.getByRole("button", { name: "Import" }).click();
  
  const importData = [
    {
      externalId: "SHOULD-FAIL",
      name: "Should Fail",
      email: "fail@example.com",
      phone: "+15550000000",
      tags: ["fail"],
      city: "Fail City",
      ageGroup: "26-40",
      gender: "male",
      channelPreference: "EMAIL",
      orders: []
    }
  ];

  await page.getByLabel("Customer JSON").fill(JSON.stringify(importData));
  await page.getByRole("button", { name: "Import customers" }).click();
  
  await expect(page.getByText("Forbidden")).toBeVisible();
});
