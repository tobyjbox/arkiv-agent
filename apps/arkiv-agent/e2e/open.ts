import { expect, type Page } from "@playwright/test";

/** Waits that end on a server re-render (pulse, cost, a filtered list): seconds under parallel test load. */
export const SERVER_RENDER = { timeout: 20_000 };

/**
 * Opens a page and waits until React has hydrated it: the sync indicator leaves "Checking sync" in an
 * effect. Clicks and typing before that land on the server's HTML and are lost.
 */
export async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("header").getByText("Checking sync")).toHaveCount(0, SERVER_RENDER);
}
