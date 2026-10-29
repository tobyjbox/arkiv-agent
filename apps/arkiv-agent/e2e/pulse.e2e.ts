import { expect, test } from "@playwright/test";

test("pulse shows totals, retention and activity, with load generators excluded by default", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/pulse");
  const main = page.locator("#main");
  await expect(main.getByRole("heading", { level: 1, name: "Ecosystem pulse" })).toBeVisible();
  for (const label of ["Active wallets", "Active projects", "Writes", "New projects"]) await expect(main.locator(".label", { hasText: label })).toBeVisible();
  await expect(main.getByRole("img", { name: "Retention by window" })).toBeVisible();
  await expect(main.getByRole("img", { name: /per day/ })).toBeVisible();
  const toggle = main.getByLabel("Exclude load generators");
  await expect(toggle).toBeChecked();
  // The box follows the URL, so it flips once the page navigates.
  await toggle.click();
  await expect(page).toHaveURL(/load=1/);
  await expect(toggle).not.toBeChecked();
  await expect(main.getByText(/Load generators included/)).toBeVisible();
  await main.getByRole("link", { name: "7d" }).click();
  await expect(page).toHaveURL(/period=7/);
  expect(errors).toEqual([]);
});
