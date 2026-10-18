// Drives the app through its key flows and writes screenshots to docs/screenshots.
// Usage: npm run build && npm start   (in another shell)  then  node scripts/screenshots.mjs [baseUrl]
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = new URL("../docs/screenshots/", import.meta.url).pathname;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && !m.text().includes("fonts.g") && errors.push(`console: ${m.text()}`));

const shot = async (name, opts = {}) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}${name}.png`, ...opts });
  console.log("saved", name);
};
const go = async (path) => {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
};

// 1. Landing
await go("/");
await shot("01-landing-hero");
await shot("02-landing-full", { fullPage: true });

// 2. Portfolio (seeds Moonwilders into localStorage on first visit)
await go("/studio");
await page.getByText("Moonwilders").first().waitFor();
await shot("03-studio-portfolio");

// 3. One-prompt launch
await go("/studio/new?prompt=" + encodeURIComponent("a lighthouse keeper who can talk to storms"));
await page.getByText("Five directions for one idea").waitFor();
await shot("04-launch-discovery");
await page.getByRole("button", { name: /Develop this/ }).first().click();
await page.getByText(/Developing/).waitFor();
await shot("05-launch-developing");
await page.getByRole("button", { name: /Greenlight to canon/ }).waitFor({ timeout: 20000 });
await shot("06-launch-review");
await page.getByRole("button", { name: /Greenlight to canon/ }).click();
await page.waitForURL(/\/studio\/f\//);
await page.getByText("Studio floor").waitFor();
await shot("07-new-franchise-overview");

// 4. Moonwilders workspace
const MW = "/studio/f/fr_moonwilders";
await go(MW);
await shot("08-moonwilders-overview");

await go(`${MW}/characters`);
await shot("09-character-studio");
// Edit Wren -> new canon version, downstream assets flagged.
await page.getByRole("button", { name: "Edit" }).first().click();
await page.locator("textarea").nth(3).fill("Silver-violet moth wings, a patched lantern-gold raincoat instead of the scarf, lantern on her hip.");
await page.getByText(/Committing creates canon/).waitFor();
await shot("10-character-edit-impact");
await page.getByRole("button", { name: "Commit to canon" }).click();
await page.getByText(/downstream asset/).first().waitFor();
await page.evaluate(() => window.scrollTo(0, 0));
await shot("11-character-committed");

await go(`${MW}/approvals`);
await shot("12-approvals-queue");
await go(`${MW}/canon`);
await shot("13-canon-history");
await go(`${MW}/ip-lab`);
await shot("14-ip-lab");
await go(`${MW}/world`);
await shot("15-world-builder");
await go(`${MW}/social`);
await shot("16-social-studio");
await go(`${MW}/vault`);
await page.getByRole("button", { name: /Check/ }).click();
await shot("17-ip-vault");
await go(`${MW}/director`);
await shot("18-studio-director");
await go(`${MW}/games`);
await page.getByRole("button", { name: /Generate/ }).click();
await page.getByText(/delivered a/).first().waitFor();
await shot("19-light-studio-games");
await go(`${MW}/genome`);
await shot("20-ip-genome");
await go(`${MW}/simulator`);
await shot("21-franchise-simulator");
await go(`${MW}/bible`);
await shot("22-ip-bible", { fullPage: true });

await browser.close();
if (errors.length) {
  console.error("Browser errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("No browser errors.");
