import { expect, type Page, test } from "@playwright/test";
import { open } from "./open";

/**
 * The decode bar (design/07) reads `undecodedLive` from the change feed every 5 s. These tests answer
 * the feed themselves, so each state is fixed: a synced index (or one synced `ageS` ago) with a given
 * waiting count. Unchanged feeds bump nothing else on the page.
 */
async function feed(page: Page, state: { waiting: () => number; total?: number; ageS?: number }) {
  await page.route("**/api/changes**", async (route) => {
    try {
      const real = await (await route.fetch()).json();
      await route.fulfill({
        json: {
          ...real, changes: [], reset: false, isBehind: false, lagBlocks: "0",
          syncedAt: new Date(Date.now() - (state.ageS ?? 0) * 1_000).toISOString(),
          liveCount: state.total ?? 37_000, undecodedLive: state.waiting(),
        },
      });
    } catch {
      // the test ended while this poll was in flight
    }
  });
}

/** A change reaches the bar on the next feed poll: up to 5 s, plus the request. */
const NEXT_POLL = { timeout: 15_000 };

const bar = (page: Page) => page.locator("#main section[data-phase]");

test.describe("decode progress bar, full motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("shows decoded / total with progressbar values, and its motion runs", async ({ page }) => {
    await feed(page, { waiting: () => 800 });
    await open(page, "/catalogue");
    await expect(bar(page)).toHaveAttribute("data-phase", "decoding");
    const progress = bar(page).getByRole("progressbar", { name: "Decoding records" });
    await expect(progress).toHaveAttribute("aria-valuenow", "36200");
    await expect(progress).toHaveAttribute("aria-valuemax", "37000");
    await expect(progress).toHaveAttribute("aria-valuetext", "36,200 of 37,000 records decoded, 97.8%");
    await expect(bar(page).getByText("97.8%")).toBeVisible();
    await expect(bar(page).getByLabel("800", { exact: true })).toBeVisible(); // the rolling waiting count
    expect(await bar(page).locator(".decode-spin").evaluate((el) => getComputedStyle(el).animationName)).toBe("decode-spin");
    expect(await bar(page).locator(".decode-sheen").evaluate((el) => getComputedStyle(el).animationName)).toBe("decode-sheen");
  });
});

test("reduced motion: no spin, no sheen, instant fill", async ({ page }) => {
  await feed(page, { waiting: () => 800 });
  await open(page, "/catalogue");
  await expect(bar(page)).toHaveAttribute("data-phase", "decoding");
  expect(await bar(page).locator(".decode-spin").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  await expect(bar(page).locator(".decode-sheen")).toBeHidden();
  expect(await bar(page).locator(".decode-move").first().evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
});

test("first run, paused, and caught up (announced, then removed)", async ({ page }) => {
  let waiting = 37_000;
  let ageS = 0;
  await feed(page, { waiting: () => waiting, get ageS() { return ageS; } });
  await open(page, "/catalogue");
  await expect(bar(page)).toHaveAttribute("data-phase", "first-run");
  await expect(bar(page).getByText("Starting to decode · datasets will appear here")).toBeVisible();
  const progress = bar(page).getByRole("progressbar");
  await expect(progress).not.toHaveAttribute("aria-valuenow");
  await expect(progress).toHaveAttribute("aria-valuetext", "Starting to decode 37,000 records");

  waiting = 20_000;
  ageS = 600; // the indexer stopped 10 min ago
  await expect(bar(page)).toHaveAttribute("data-phase", "stale", NEXT_POLL);
  await expect(bar(page).getByText(/Paused while the indexer isn't running · as of \d\d:\d\d/)).toBeVisible();

  waiting = 0;
  ageS = 0;
  await expect(bar(page).getByText("All records decoded", { exact: true })).toBeVisible(NEXT_POLL);
  await expect(page.locator("#main [aria-live=polite]")).toHaveText("All records decoded.");
  await expect(bar(page)).toHaveCount(0, NEXT_POLL); // 3 s hold, then the collapse
});

test("at 375 px: short label and percent, then decoded / total", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await feed(page, { waiting: () => 800 });
  await open(page, "/catalogue");
  await expect(bar(page)).toHaveAttribute("data-phase", "decoding");
  await expect(bar(page).getByText("Decoding", { exact: true })).toBeVisible();
  await expect(bar(page).getByText("36,200 / 37,000", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
