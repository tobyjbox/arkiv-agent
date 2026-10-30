import { expect, type Locator, type Page, test } from "@playwright/test";
import { open } from "./open";

const tryAsking = (main: Locator) => main.getByRole("group", { name: "Try asking" });

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

// Results come live from Arkiv, so these tests accept either rows or the designed failure panel;
// the interpretation, query and code never depend on the chain.
test("an example question shows chips, then live results, the query and the code", async ({ page }) => {
  const errors = watchErrors(page);
  await open(page, "/ask");
  const main = page.locator("#main");
  await expect(main.getByRole("heading", { level: 1, name: "Ask Arkiv" })).toBeVisible();
  const example = tryAsking(main).getByRole("button").first();
  await expect(example).toBeVisible();
  await example.click();

  const card = main.getByRole("region", { name: "Interpretation" });
  await expect(card.getByText("Interpreted as")).toBeVisible();
  await expect(card.getByRole("button", { name: /^Edit condition: / }).first()).toBeVisible();
  await expect(main.locator("tbody tr").first().or(main.getByText(/No records match|didn't respond|returned an error|budget is used up/))).toBeVisible({ timeout: 20_000 });

  await main.getByRole("tab", { name: "Query" }).click();
  await expect(main.locator("pre code")).toContainText("= str(");
  await main.getByRole("tab", { name: "TypeScript" }).click();
  await expect(main.locator("pre code")).toContainText("@arkiv-network/sdk/query");
  await expect(main.getByRole("link", { name: /Open in Data Explorer/ })).toHaveAttribute("href", /^https:\/\/data\.arkiv\.network\/\?q=/);
  expect(errors).toEqual([]);
});

test("a question ArkivAgent can't ground says so and offers examples", async ({ page }) => {
  await open(page, "/ask");
  const main = page.locator("#main");
  await main.getByLabel("Ask a question about data on Arkiv").fill("what's the weather in Lisbon today?");
  await main.getByLabel("Ask a question about data on Arkiv").press("Enter");
  await expect(main.getByText("ArkivAgent couldn't turn that into a query.")).toBeVisible();
  await expect(main.getByText("Mention a kind of data or an attribute, for example:").locator("..").getByRole("button").first()).toBeVisible();
});

test("the run API takes validated plans only, never query strings", async ({ request }) => {
  expect((await request.post("/api/ask/run", { data: { query: "anything" } })).status()).toBe(400);
  const bad = await request.post("/api/ask/run", { data: { plan: { datasetId: null, where: { op: "eq", attr: "city", type: "str", value: "x" }, limit: 5, explain: [] } } });
  expect(await bad.json()).toMatchObject({ ok: false, kind: "invalid" });
});

test("the ask APIs refuse cross-site requests (T07 M1)", async ({ request }) => {
  const evil = "https://evil.example";
  // What a web page can send without a CORS preflight: refused before it reaches the model.
  const simple = await request.post("/api/ask", { headers: { "content-type": "text/plain;charset=UTF-8", origin: evil }, data: '{"question":"tankha salaries in noida"}' });
  expect(simple.status()).toBe(415);
  const cross = await request.post("/api/ask", { headers: { origin: evil }, data: { question: "tankha salaries in noida" } });
  expect(cross.status()).toBe(403);
  const run = await request.post("/api/ask/run", { headers: { origin: evil, "sec-fetch-site": "cross-site" }, data: { plan: { datasetId: null, where: null, limit: 1, explain: [] } } });
  expect(run.status()).toBe(403);
});

test("words ArkivAgent can't use are reported, not dropped (T06 F1)", async ({ page }) => {
  await open(page, "/ask");
  const main = page.locator("#main");
  const example = (await tryAsking(main).getByRole("button").first().textContent())!.trim();
  const input = main.getByLabel("Ask a question about data on Arkiv");
  await input.fill(`${example} zebrafish`);
  await input.press("Enter");
  await expect(main.getByRole("region", { name: "Interpretation" }).getByText(/Not used: “zebrafish”/)).toBeVisible();
});

test("a dataset named by its attribute shape runs live without EXISTS (T21 M1)", async ({ page }) => {
  await open(page, "/ask");
  const main = page.locator("#main");
  const input = main.getByLabel("Ask a question about data on Arkiv");
  await input.fill("nazar-in-batch-alerts alerts");
  await input.press("Enter");
  await expect(main.getByRole("region", { name: "Interpretation" }).getByText("Interpreted as")).toBeVisible();
  // Live: rows, or a rate limit or timeout panel, but never the node rejecting the query.
  await expect(main.locator("tbody tr").first().or(main.getByText(/No records match|didn't respond|returned an error|budget is used up/))).toBeVisible({ timeout: 20_000 });
  await expect(main.getByText(/-32002|Query rejected/)).toHaveCount(0);
  await main.getByRole("tab", { name: "Query" }).click();
  await expect(main.locator("pre code")).toContainText("project = str('nazar-in-batch-alerts')");
  await expect(main.locator("pre code")).not.toContainText("EXISTS");
});

test("Try asking offers 4 to 6 examples; each is read back with every word used and finds records live (A03)", async ({ page, request }) => {
  test.setTimeout(120_000);
  await open(page, "/ask");
  const main = page.locator("#main");
  const chips = tryAsking(main).getByRole("button");
  await expect(chips.first()).toBeVisible();
  const questions = await chips.evaluateAll((els) => els.map((e) => e.getAttribute("title")!));
  expect(questions.length).toBeGreaterThanOrEqual(4);
  expect(questions.length).toBeLessThanOrEqual(6);
  await expect(main.getByText(/^Name a kind of data, then narrow it/)).toBeVisible();
  for (const question of questions) {
    const r = await (await request.post("/api/ask", { data: { question } })).json();
    expect(r, question).toMatchObject({ ok: true, plan: { ignored: [] } });
    const run = await (await request.post("/api/ask/run", { data: { plan: r.plan } })).json();
    // Live: when Arkiv answers, the example has records. A timeout or rate limit is not the example's fault.
    if (run.ok) expect(run.rows.length, question).toBeGreaterThan(0);
  }
});

test("an example runs from the keyboard across all datasets, and the examples go once asked (A03)", async ({ page }) => {
  await open(page, "/ask");
  const main = page.locator("#main");
  const scope = main.getByLabel("Scope");
  await scope.selectOption({ index: 1 });
  const chip = tryAsking(main).getByRole("button").nth(1);
  const question = (await chip.getAttribute("title"))!;
  await chip.focus();
  await page.keyboard.press("Enter");
  await expect(main.getByText(`“${question}”`)).toBeVisible();
  await expect(scope).toHaveValue("");
  await expect(main.getByRole("region", { name: "Interpretation" }).getByText("Interpreted as")).toBeVisible();
  await expect(tryAsking(main)).toHaveCount(0);
  await expect(main.getByText(/^Name a kind of data, then narrow it/)).toHaveCount(0);
});

test("Try asking at 375 px: one scrolling row, addresses shortened, nothing wider than the screen (A03)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page, "/ask");
  const main = page.locator("#main");
  const chips = tryAsking(main).getByRole("button");
  await expect(chips.first()).toBeVisible();
  for (const text of await chips.allTextContents()) expect(text).not.toMatch(/0x[0-9a-fA-F]{40}/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await chips.last().scrollIntoViewIfNeeded();
  await chips.last().click();
  await expect(main.getByRole("region", { name: "Interpretation" }).getByText("Interpreted as")).toBeVisible();
});
