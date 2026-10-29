import { expect, test } from "@playwright/test";
import { open, SERVER_RENDER } from "./open";

test("pulse shows totals, retention and activity, with load generators excluded by default", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page, "/insights");
  const main = page.locator("#main");
  await expect(main.getByRole("heading", { level: 1, name: "Insights" })).toBeVisible();
  for (const label of ["Active wallets", "Active projects", "Writes", "New projects"]) await expect(main.locator(".label", { hasText: label })).toBeVisible();
  await expect(main.getByRole("img", { name: "Retention by window" })).toBeVisible();
  await expect(main.getByRole("img", { name: /per day/ })).toBeVisible();
  const toggle = main.getByLabel("Exclude load generators");
  await expect(toggle).toBeChecked();
  // The box follows the URL, so it flips once the page navigates.
  await toggle.click();
  await expect(page).toHaveURL(/load=1/, SERVER_RENDER);
  await expect(toggle).not.toBeChecked();
  await expect(main.getByText(/Load generators included/)).toBeVisible();
  await main.getByRole("link", { name: "7d" }).click();
  await expect(page).toHaveURL(/period=7/, SERVER_RENDER);
  await expect(main.getByRole("link", { name: "7d" })).toHaveAttribute("aria-current", "page");
  expect(errors).toEqual([]);
});

const DAY = 86_400_000;
const SERIES = ["Writes", "Active wallets", "Active projects", "New projects"];

// Every label in the activity chart stays readable: none overlaps another, and none runs past the drawing.
// The "Before Tiramisu" band appears only when the period reaches back before the index's first day.
for (const width of [1280, 375]) {
  test(`activity chart labels never overlap or clip, at ${width} px, for every period and series`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const period of [7, 30, 90]) {
      await open(page, `/insights?period=${period}`);
      const main = page.locator("#main");
      const chart = main.getByRole("img", { name: /per day$/ });
      const firstDay = (await main.getByText(/From the ArkivAgent index of Tiramisu since/).textContent())!.match(/since (\d{4}-\d\d-\d\d)/)![1]!;
      for (const series of SERIES) {
        await main.getByRole("tab", { name: series }).click();
        await expect(chart).toHaveAttribute("aria-label", `${series} per day`);
        const { area, labels } = await chart.evaluate((svg) => {
          const [w, h] = svg.getAttribute("viewBox")!.split(" ").slice(2).map(Number) as [number, number];
          const at = (x: number, y: number) => Object.assign((svg as SVGSVGElement).createSVGPoint(), { x, y }).matrixTransform((svg as SVGSVGElement).getScreenCTM()!);
          const [a, b] = [at(0, 0), at(w, h)];
          return {
            area: { l: a.x, t: a.y, r: b.x, b: b.y },
            labels: [...svg.querySelectorAll("text")].filter((t) => t.textContent!.trim()).map((t) => {
              const r = t.getBoundingClientRect();
              return { text: t.textContent!, l: r.left, t: r.top, r: r.right, b: r.bottom };
            }),
          };
        });
        const where = `${width} px, ${period}d, ${series}`;
        const lastDay = labels.find((l) => l.text.endsWith("(so far)"))!.text.slice(0, 10);
        const hasBand = Date.parse(firstDay) > Date.parse(lastDay) - (period - 1) * DAY;
        expect(labels.some((l) => l.text.startsWith("Before Tiramisu")), where).toBe(hasBand);
        for (const l of labels) expect(l.l >= area.l - 1 && l.r <= area.r + 1 && l.t >= area.t - 1 && l.b <= area.b + 1, `${where}: "${l.text}" inside the chart`).toBe(true);
        for (const [i, a] of labels.entries()) {
          for (const b of labels.slice(i + 1)) expect(a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t, `${where}: "${a.text}" clear of "${b.text}"`).toBe(true);
        }
      }
    }
  });
}
