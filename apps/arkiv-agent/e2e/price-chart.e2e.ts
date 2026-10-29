import { expect, type Page, test } from "@playwright/test";
import { open, SERVER_RENDER } from "./open";

const DAY = 86_400_000;
const history = (days: 7 | 30, now = Date.UTC(2026, 9, 29)) => {
  const [interval, count, step] = days === 7 ? ["4h", 42, DAY / 6] : ["1d", 30, DAY];
  return { days, interval, source: "Binance GLM/USDT", at: new Date(now).toISOString(), candles: Array.from({ length: count as number }, (_, i) => ({ t: now - ((count as number) - 1 - i) * (step as number), close: 0.1 + (i % 5) / 1000 })) };
};

/** Answers /api/glm-history from fixtures (no price API calls); `hold` keeps the first answer back until released. */
async function stubHistory(page: Page, opts: { fail?: boolean } = {}) {
  let release = () => {};
  const held = new Promise<void>((r) => { release = r; });
  const asked: string[] = [];
  await page.route("**/api/glm-history**", async (route) => {
    const days = Number(new URL(route.request().url()).searchParams.get("days")) as 7 | 30;
    asked.push(String(days));
    if (asked.length === 1) await held;
    try {
      await route.fulfill(opts.fail ? { status: 503, json: { error: "No GLM price history is available right now." } } : { json: history(days) });
    } catch {
      // the test ended first
    }
  });
  return { release, asked };
}

const card = (page: Page) => page.locator("#main section[aria-labelledby=glm-usd]");

test("the price chart loads after the page, holding its size, then reads and switches ranges", async ({ page }) => {
  const stub = await stubHistory(page);
  await open(page, "/financials");
  const skeleton = card(page).getByRole("img", { name: "Loading the GLM price history" });
  await expect(skeleton).toBeVisible();
  expect((await skeleton.boundingBox())!.height).toBe(140);
  // The rest of the page works while the history loads.
  await page.locator("#main").getByLabel("Writes per day", { exact: true }).fill("4000");
  await expect(page).toHaveURL(/writes=4000/, SERVER_RENDER);

  stub.release();
  const chart = card(page).getByRole("img", { name: /^GLM in USD, last 30 days: \$0\.1000 to \$0\.1040/ });
  await expect(chart).toBeVisible();
  expect((await chart.boundingBox())!.height).toBe(140);
  await expect(card(page).getByText("Binance GLM/USDT, daily closes", { exact: false })).toBeVisible();

  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(chart.getByText(/^\$0\.10\d\d$/)).toBeVisible(); // the tooltip: price, then date
  await expect(chart.getByText(/^\d{1,2} (Sept|Oct)$/)).toBeVisible();

  await card(page).getByRole("button", { name: "7d" }).click();
  await expect(card(page).getByRole("img", { name: /last 7 days/ })).toBeVisible();
  expect(stub.asked).toEqual(["30", "7"]);
});

test("reduced motion: the loading sweep doesn't move", async ({ page }) => {
  await stubHistory(page);
  await open(page, "/financials");
  const skeleton = card(page).getByRole("img", { name: "Loading the GLM price history" });
  await expect(skeleton).toBeVisible();
  expect(await skeleton.evaluate((el) => getComputedStyle(el, "::after").animationName)).toBe("none");
});

test("no price history: the chart is hidden with a one-line note", async ({ page }) => {
  const stub = await stubHistory(page, { fail: true });
  await open(page, "/financials");
  stub.release();
  await expect(page.locator("#main").getByText("No GLM price history is available right now, so the price chart is hidden.")).toBeVisible();
  await expect(card(page)).toHaveCount(0);
});

test("at 375 px the chart fits", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const stub = await stubHistory(page);
  await open(page, "/financials");
  stub.release();
  await expect(card(page).getByRole("img", { name: /last 30 days/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
