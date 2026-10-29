import { expect, test } from "@playwright/test";

test("cost: calculator shows an estimate with its range, keeps inputs in the URL, and the model is explained", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/cost");
  const main = page.locator("#main");
  await expect(main.getByRole("heading", { level: 1, name: "Cost" })).toBeVisible();
  await expect(main.getByText(/^range .+ GLM · .+ GLM per write$/)).toBeVisible();
  await main.getByLabel("Writes per day", { exact: true }).fill("5000");
  await expect(page).toHaveURL(/writes=5000/);
  // USD needs a live price source; without one the page must say it shows GLM only.
  await expect(main.getByText(/USD amounts use the mainnet GLM price|amounts are shown in GLM only/)).toBeVisible();
  await expect(main.getByRole("img", { name: /Gas used against calldata/ })).toBeVisible();
  await expect(main.getByText(/held-out creates/)).toBeVisible();
  expect(errors).toEqual([]);
});
