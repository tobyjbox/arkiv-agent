import { expect, type Page, test } from "@playwright/test";
import { open, SERVER_RENDER } from "./open";

/** Fails the test on any console error (hydration mismatches surface here). */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test("catalogue list renders live data, filters through the URL, and syncs", async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, "/catalogue");
  // Scope to #main: until streaming finishes, React keeps a hidden copy of streamed HTML in <body>.
  const main = page.locator("#main");
  await expect(main.getByRole("heading", { level: 1, name: "Data catalogue" })).toBeVisible();
  await expect(main.locator(".label", { hasText: "Live records" })).toBeVisible();
  const rows = main.locator("tbody tr");
  await expect(rows.first()).toBeVisible();
  // Any age: the index may be a static copy with no watcher running ("Synced 3 min ago").
  await expect(page.getByText(/Synced .+ ago/).filter({ visible: true })).toBeVisible();
  await expect(main.getByText("Hide load generators")).toBeVisible();

  const firstName = (await rows.first().locator("td").first().locator(".font-mono").first().textContent())!.trim();
  await main.getByPlaceholder("Search datasets, attributes, projects…").fill(firstName);
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(firstName).replace(/%20/g, "\\+")}`), SERVER_RENDER);
  await expect(rows.first()).toContainText(firstName);
  expect(errors).toEqual([]);
});

test("dataset detail shows schema, activity, records and a runnable snippet", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/catalogue");
  // Open the first row's link directly: live updates can reorder rows between finding and clicking one.
  const href = await page.locator("#main tbody tr").first().locator("a").first().getAttribute("href");
  await open(page, href!);
  await expect(page).toHaveURL(/\/catalogue\/[0-9a-f]{12}$/);
  const datasetName = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();
  await expect(page).toHaveTitle(`${datasetName} · ArkivAgent`);
  for (const name of ["Schema", "Activity", "Recent records", "Read this dataset"]) {
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  await page.getByRole("tab", { name: "Query string" }).click();
  await expect(page.locator("pre code")).toContainText(/=|EXISTS|STARTSWITH/);
  expect(errors).toEqual([]);
});

test("on a 375 px screen the nav stays on one line and the sync indicator keeps its words", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page, "/catalogue");
  for (const link of await page.getByRole("navigation", { name: "Main" }).getByRole("link").all()) {
    const box = (await link.boundingBox())!;
    expect(box.height).toBeLessThan(48);
  }
  await expect(page.locator("header").getByText(/^(Synced|Retrying ·|Not updating ·) .+ ago$|^Sync paused|blocks behind$/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
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

test("the dataset list scrolls in its own pane: the page stays bounded and the header stays put (A04)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, "/catalogue");
  const pane = page.locator("#main").getByRole("region", { name: "Datasets" });
  const rows = pane.locator("tbody tr");
  await expect(rows.first()).toBeVisible();
  const size = await pane.evaluate((el) => ({ client: el.clientHeight, scroll: el.scrollHeight }));
  expect(size.scroll, "enough datasets to need scrolling").toBeGreaterThan(size.client);
  expect(size.client).toBeLessThanOrEqual(800);
  // Hundreds of rows used to make the page tens of thousands of pixels tall.
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThan(2 * 800);

  // Scrolled down to it, the whole pane fits on screen; scrolling it moves the rows, not the header.
  await pane.evaluate((el) => el.scrollIntoView({ block: "end" }));
  const header = pane.locator("thead th").first();
  await expect(header).toBeInViewport();
  const headerTop = (await header.boundingBox())!.y;
  await pane.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect(rows.last()).toBeInViewport();
  expect((await header.boundingBox())!.y).toBeCloseTo(headerTop, 0);
  await expect(header).toBeInViewport();

  // Keyboard: the pane takes focus and scrolls; a row link inside it still opens the dataset.
  await pane.evaluate((el) => el.scrollTo(0, 0));
  await pane.focus();
  await page.keyboard.press("End");
  await expect.poll(() => pane.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await rows.last().getByRole("link").click();
  await expect(page).toHaveURL(/\/catalogue\/[0-9a-f]+$/, SERVER_RENDER);
});

test("on a 375 px screen the list pane scrolls sideways inside itself, never the page (A04)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page, "/catalogue");
  const pane = page.locator("#main").getByRole("region", { name: "Datasets" });
  await expect(pane.locator("tbody tr").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  const size = await pane.evaluate((el) => ({ client: el.clientHeight, scroll: el.scrollHeight }));
  expect(size.scroll).toBeGreaterThan(size.client);
  await pane.evaluate((el) => el.scrollTo(el.scrollWidth, 0));
  expect(await pane.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
});
