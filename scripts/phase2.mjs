// Phase 2 through the real UI: development cycle -> strategy decision ->
// episode 2 + comic + interactive -> publish -> play/read on WEBSTER WORLD ->
// canon change with downstream review. Requires a running app + worker and
// at least one released franchise (run scripts/slice.mjs first).
// Usage: node scripts/phase2.mjs [baseUrl]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = new URL("../docs/screenshots/", import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "wb_viewer", value: "qa-founder-p2", url: BASE }]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const shot = async (name, opts = {}) => {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}${name}.png`, ...opts });
  console.log("📸", name);
};
const go = (p) => page.goto(BASE + p, { waitUntil: "networkidle" });
const waitFor = async (label, fn, ms = 400_000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await fn()) return;
    await page.waitForTimeout(2500);
  }
  throw new Error(`Timed out: ${label}`);
};
const pendingOf = async (badge) => {
  await go("/os/approvals");
  return page.locator(`a:has(span:text-is('${badge}'))`).count();
};

await go("/os/login");
await page.fill("#email", process.env.WEBSTER_FOUNDER_EMAIL ?? "founder@webster.studio");
await page.fill("#password", process.env.WEBSTER_FOUNDER_PASSWORD ?? "webster-dev");
await page.click("button:has-text('Enter the studio')");
await page.waitForURL(/\/os$/);

// 1. Start a development cycle from a franchise workspace.
await go("/os/universe");
const workspace = await page.locator("a[href^='/os/universe/']").first().getAttribute("href");
if (process.env.START !== "canon") {
await go(workspace);
await page.click("button:has-text('Director & roadmap')");
await page.click("button:has-text('Start development cycle')");
await page.waitForURL(/\/os\/floor/);

// 2. Strategy decision.
await waitFor("strategy approval", async () => (await pendingOf("Strategy")) > 0);
await page.locator("a:has-text('Strategy')").first().click();
await page.waitForLoadState("networkidle");
const boxes = page.locator("input[name=selected]");
for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check();
await shot("30-approval-strategy", { fullPage: true });
await page.click("button[value=approve]");
await waitFor("strategy recorded", async () => (await pendingOf("Strategy")) === 0, 60_000);

// 3. Three productions run in parallel, then pause for publication.
await page.waitForTimeout(6000);
await go("/os/floor");
await shot("31-floor-expansion");
await waitFor("three publish approvals", async () => (await pendingOf("Publication")) >= 3);
await page.locator("a:has-text('Publication')").nth(1).click();
await page.waitForLoadState("networkidle");
await shot("32-approval-publish-format", { fullPage: true });
for (let left = await pendingOf("Publication"); left > 0; left--) {
  await go("/os/approvals");
  await page.locator("a:has-text('Publication')").first().click();
  await page.waitForLoadState("networkidle");
  await page.click("button[value=approve]");
  await waitFor("publication recorded", async () => (await pendingOf("Publication")) < left, 60_000);
}
await waitFor("PLAY title live", async () => {
  await go("/play");
  return (await page.locator("a[href^='/play/']").count()) > 0;
});

// 4. WEBSTER WORLD: play to an ending, read the comic.
await go("/");
await shot("33-world-home-phase2", { fullPage: true });
await go("/play");
await go(await page.locator("a[href^='/play/']").first().getAttribute("href"));
await shot("34-world-play-start");
for (let i = 0; i < 12; i++) {
  if (await page.locator("button:has-text('Play again')").count()) break;
  await page.locator("main button").first().click();
  await page.waitForTimeout(700);
}
await shot("35-world-play-ending");
await go("/read");
const comicHref = await page.locator("a[href^='/read/']").first().getAttribute("href");
await go(comicHref);
await shot("36-world-comic", { fullPage: false });

}
// 5. Canon change: propose -> approve -> dependent assets flagged.
if (process.env.START !== "review") {
await go(workspace);
await page.locator("summary:has-text('Propose canon change')").first().click();
await page.locator("textarea[aria-label=Appearance]").first().fill("A storm-grey oilskin coat with a brass lantern clipped at the collar.");
await page.locator("input[name=reason]").first().fill("Wardrobe refresh for season one");
await page.locator("button:has-text('Submit for approval')").first().click();
await page.waitForURL(/\/os\/approvals/);
await page.locator("a:has-text('Canon change')").first().click();
await page.waitForLoadState("networkidle");
await shot("37-approval-canon-change");
await page.click("button[value=approve]");
await waitFor("canon change applied", async () => (await pendingOf("Canon change")) === 0, 60_000);
}
await go(workspace);
await shot("38-workspace-review-queue");
await page.click("button:has-text('Canon ledger')");
await shot("39-canon-ledger");
await page.click("button:has-text('Director & roadmap')");
await shot("40-growth-opportunities");
await go("/os/commercial");
await shot("41-commercial-pipeline", { fullPage: true });

await browser.close();
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Phase 2 complete.");
