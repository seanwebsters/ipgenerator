// End-to-end vertical slice through the real UI, with screenshots.
// Requires: web (`npm start`) and worker (`npm run worker`) running.
// Viewer sessions created here use "qa-" viewer ids, which WEBSTER tags as
// internal QA traffic everywhere metrics are shown.
// Usage: node scripts/slice.mjs [baseUrl]
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = new URL("../docs/screenshots/", import.meta.url).pathname;
await mkdir(OUT, { recursive: true });
const EMAIL = process.env.WEBSTER_FOUNDER_EMAIL ?? "founder@webster.studio";
const PASSWORD = process.env.WEBSTER_FOUNDER_PASSWORD ?? "webster-dev";

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: "wb_viewer", value: "qa-founder", url: BASE }]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const shot = async (name, opts = {}) => {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}${name}.png`, ...opts });
  console.log("📸", name);
};
const go = (p) => page.goto(BASE + p, { waitUntil: "networkidle" });
const waitFor = async (label, fn, timeoutMs = 240_000) => {
  const t = Date.now();
  while (Date.now() - t < timeoutMs) {
    if (await fn()) return;
    await page.waitForTimeout(2000);
  }
  throw new Error(`Timed out waiting for ${label}`);
};
const pendingKinds = async () => {
  await go("/os/approvals");
  return page.locator("text=Pending (").first().innerText();
};

const START = process.env.START ?? "begin"; // begin | publish
if (START === "begin") {
// 0. Empty consumer destination.
await go("/");
await shot("01-world-empty");

// 1. Founder signs in.
await go("/os");
await page.fill("#email", EMAIL);
await page.fill("#password", PASSWORD);
await page.click("button:has-text('Enter the studio')");
await page.waitForURL(/\/os$/);
await shot("02-os-home-empty");

}
if (START !== "begin") {
  await go("/os/login");
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click("button:has-text('Enter the studio')");
  await page.waitForURL(/\/os$/);
}
if (START === "begin") {
// 2. Creative brief via the Founder Copilot.
await go("/os/copilot");
await page.fill("textarea[name=command]", "Develop five original fantasy franchises for young adults and prototype the two strongest concepts.");
await page.keyboard.press("Enter");
await page.getByText("Follow it on the Studio Floor").waitFor({ timeout: 60_000 });
await shot("03-copilot");

// 3. Discovery runs, then pauses for the NEW_IP greenlight.
await waitFor("greenlight approval", async () => (await pendingKinds()).includes("(1)"));
await page.locator("a:has-text('New IP')").first().click();
await page.waitForLoadState("networkidle");
await shot("04-approval-greenlight", { fullPage: true });
const boxes = page.locator("input[name=selected]");
await boxes.nth(0).check();
await boxes.nth(1).check();
await page.click("button[value=approve]");
await page.waitForURL(/\/os\/approvals/);

// 4. Two pilot productions run in parallel; watch the floor.
await go("/os/floor");
await page.waitForTimeout(8000);
await go("/os/floor");
await shot("05-studio-floor-running");

// 5. Each pilot pauses for publication approval (Assisted mode).
await waitFor("publish approvals", async () => (await pendingKinds()).includes("(2)"), 400_000);
}
await go("/os/approvals");
if (START === "begin") {
await page.locator("a:has-text('Publication')").first().click();
await page.waitForLoadState("networkidle");
await shot("06-approval-publish", { fullPage: true });
}
for (let left = await page.locator("a:has-text('Publication')").count(); left > 0; left--) {
  await go("/os/approvals");
  await page.locator("a:has-text('Publication')").first().click();
  await page.waitForLoadState("networkidle");
  await page.click("button[value=approve]");
  await waitFor("approval recorded", async () => {
    await go("/os/approvals");
    return (await page.locator("a:has-text('Publication')").count()) < left;
  }, 60_000);
}
await waitFor("releases", async () => {
  await go("/os/calendar");
  return (await page.locator("text=published").count()) >= 2;
});
await shot("07-calendar");

// 6. Consumer side: WEBSTER WORLD now has real releases.
await go("/");
await shot("08-world-home");
await shot("09-world-home-full", { fullPage: true });
const watchHref = await page.locator("a[href^='/watch/']").first().getAttribute("href");
await go(watchHref);
const canPlay = await page.evaluate(() => document.createElement("video").canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"'));
console.log("browser H.264 support:", canPlay || "none");
await page.evaluate(async () => {
  const v = document.querySelector("video");
  v.muted = true;
  await v.play().catch(() => {});
});
await page.waitForTimeout(6000);
await shot("10-world-watch");
const franchiseHref = await page.locator("a[href^='/f/']").first().getAttribute("href");
await go(franchiseHref);
await shot("11-world-franchise", { fullPage: true });
await go("/read");
const readHref = await page.locator("a[href^='/read/']").first().getAttribute("href");
await go(readHref);
await shot("12-world-read");

// 7. A handful of QA viewer sessions generate real, tagged events.
for (let i = 0; i < 8; i++) {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  await c.addCookies([{ name: "wb_viewer", value: `qa-session-${i}`, url: BASE }]);
  const p = await c.newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  for (let y = 0; y < 6; y++) {
    await p.mouse.wheel(0, 300);
    await p.waitForTimeout(350);
  }
  await p.waitForTimeout(1800);
  if (i % 2 === 0) {
    await p.goto(BASE + watchHref, { waitUntil: "networkidle" });
    await p.evaluate(async () => {
      const v = document.querySelector("video");
      v.muted = true;
      await v.play().catch(() => {});
    });
    await p.waitForTimeout(6500);
  }
  if (i === 0) await p.screenshot({ path: `${OUT}13-world-mobile.png` });
  await p.close();
  await c.close();
}

// 8. Ingest + learning review from the OS.
await go("/os/intelligence");
await page.click("button:has-text('Ingest now')");
await page.waitForTimeout(4000);
await go("/os/intelligence");
await page.locator("button:has-text('Review now')").first().click();
await waitFor("experiment proposal", async () => {
  await go("/os/intelligence");
  return (await page.locator("text=Arm B").count()) > 0;
}, 120_000);
await shot("14-intelligence", { fullPage: true });

// 9. Founder sees everything in one place.
await go("/os");
await shot("15-os-home");
await go("/os/universe");
await shot("16-ip-universe");
await page.locator("a[href^='/os/universe/']").first().click();
await page.waitForLoadState("networkidle");
await shot("17-franchise-workspace");
await page.click("button:has-text('Productions & assets')");
await shot("18-franchise-assets");
await go("/os/agents");
await shot("19-agents", { fullPage: true });
await go("/os/commercial");
await shot("20-commercial");
await go("/os/settings");
await shot("21-settings", { fullPage: true });
await go("/os/approvals");
await shot("22-approvals-experiment");
await go("/os/floor");
await shot("23-floor-complete");

await browser.close();
if (errors.length) {
  console.error("Page errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("Vertical slice complete.");
