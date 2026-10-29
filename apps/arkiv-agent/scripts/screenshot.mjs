// Captures README screenshots from a running ArkivAgent (`pnpm --filter arkiv-agent start`, port 3101).
// Usage: pnpm --filter arkiv-agent screenshot [path] [out.png]
import { chromium } from "@playwright/test";

const [path = "/catalogue", out = "../../docs/screenshots/catalogue.png"] = process.argv.slice(2);
const browser = await chromium.launch();
// Reduced motion: numbers render settled, not mid-roll.
const page = await browser.newPage({ viewport: { width: 1344, height: 1372 }, deviceScaleFactor: 2, reducedMotion: "reduce", colorScheme: "dark" });
await page.goto(`http://localhost:${process.env.PORT ?? 3101}${path}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1_500);
await page.screenshot({ path: out });
await browser.close();
console.log(`saved ${out}`);
