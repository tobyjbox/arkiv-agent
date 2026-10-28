import { expect, type Page, test } from "@playwright/test";

/** Fails the test on any console error (hydration mismatches surface here). */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test("catalogue list renders live data, filters through the URL, and syncs", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/catalogue");
  // Scope to #main: until streaming finishes, React keeps a hidden copy of streamed HTML in <body>.
  const main = page.locator("#main");
  await expect(main.getByRole("heading", { level: 1, name: "Data catalogue" })).toBeVisible();
  await expect(main.locator(".label", { hasText: "Live records" })).toBeVisible();
  const rows = main.locator("tbody tr");
  await expect(rows.first()).toBeVisible();
  await expect(page.getByText(/Synced \d+ s ago/)).toBeVisible();
  await expect(main.getByText("Hide load generators")).toBeVisible();

  const firstName = (await rows.first().locator("td").first().locator(".font-mono").first().textContent())!.trim();
  await main.getByPlaceholder("Search datasets, attributes, projects…").fill(firstName);
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(firstName).replace(/%20/g, "\\+")}`));
  await expect(rows.first()).toContainText(firstName);
  expect(errors).toEqual([]);
});

test("dataset detail shows schema, activity, records and a runnable snippet", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/catalogue");
  await page.locator("#main tbody tr").first().locator("a").first().click();
  await expect(page).toHaveURL(/\/catalogue\/[0-9a-f]{12}$/);
  for (const name of ["Schema", "Activity", "Recent records", "Read this dataset"]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  await page.getByRole("tab", { name: "Query string" }).click();
  await expect(page.locator("pre code")).toContainText(/=|EXISTS|STARTSWITH/);
  expect(errors).toEqual([]);
});

test("unknown dataset shows the not-found panel", async ({ page }) => {
  await page.goto("/catalogue/000000000000");
  await expect(page.getByText("This dataset isn't in the catalogue")).toBeVisible();
});

test("change feed hands out a cursor and accepts it back", async ({ request }) => {
  const first = await (await request.get("/api/changes")).json();
  expect(first).toMatchObject({ reset: true });
  const next = await (await request.get(`/api/changes?since=${first.cursor}`)).json();
  expect(next.reset).toBe(false);
  expect(Number(next.indexedBlock)).toBeGreaterThan(0);
});
