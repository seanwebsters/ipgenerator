import { NextResponse, type NextRequest } from "next/server";

/**
 * - WEBSTER OS: requests without a session cookie go to /os/login
 *   (the session itself is validated server-side on every page/action).
 * - WEBSTER WORLD: every visitor gets an anonymous viewer id cookie.
 * - Before a database is connected, every page shows setup instructions.
 */
export function proxy(req: NextRequest) {
  if (!process.env.DATABASE_URL) return setupPage();
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/os") && pathname !== "/os/login" && !req.cookies.get("wb_session")) {
    return NextResponse.redirect(new URL("/os/login", req.url));
  }
  const res = NextResponse.next();
  if (!req.cookies.get("wb_viewer")) {
    res.cookies.set("wb_viewer", crypto.randomUUID(), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api/media|preview/).*)"] };

const SHOTS: [string, string][] = [
  ["33-world-home-phase2", "WEBSTER WORLD: home"],
  ["10-world-watch", "Watching an episode"],
  ["11-world-franchise", "A franchise page"],
  ["34-world-play-start", "An interactive story"],
  ["36-world-comic", "A comic"],
  ["13-world-mobile", "On a phone"],
  ["15-os-home", "WEBSTER OS: founder home"],
  ["05-studio-floor-running", "Studio floor: agents at work"],
  ["04-approval-greenlight", "Approval inbox: greenlight concepts"],
  ["17-franchise-workspace", "Franchise workspace"],
  ["19-agents", "The agent workforce"],
  ["14-intelligence", "Intelligence: findings and experiments"],
];

/** Until a database is connected: a screenshot preview of the app, plus the setup steps. */
function setupPage() {
  const gallery = SHOTS.map(([f, label]) => `<figure><a href="/preview/${f}.png"><img src="/preview/${f}.png" alt="${label}" loading="lazy"></a><figcaption>${label}</figcaption></figure>`).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>WEBSTER preview</title>
<style>body{margin:0;background:#0c0a09;color:#f4ede4;font:16px/1.6 system-ui,sans-serif}main{max-width:1100px;margin:0 auto;padding:32px 16px 64px}h1{font-size:28px;margin:0 0 4px}.note{color:#b8a998;margin:0 0 28px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px}figure{margin:0}img{width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top;border-radius:10px;border:1px solid #2a231d;display:block}figcaption{font-size:14px;color:#b8a998;margin-top:6px}section{margin-top:48px;border-top:1px solid #2a231d;padding-top:24px;max-width:640px}h2{font-size:18px}code{background:#1f1a16;padding:2px 6px;border-radius:4px}li{margin:6px 0}</style></head>
<body><main><h1>WEBSTER: preview</h1><p class="note">Screenshots of the app from a local run, with DEMO content. This deployment has no database yet, so the live app isn't running.</p>
<div class="grid">${gallery}</div>
<section><h2>To run it live</h2><ol>
<li>In this Vercel project, open <b>Storage</b> and create a <b>Prisma Postgres</b> database, connected to this project. It sets <code>DATABASE_URL</code>.</li>
<li>In <b>Settings → Environment Variables</b>, add <code>WEBSTER_FOUNDER_EMAIL</code>, <code>WEBSTER_FOUNDER_PASSWORD</code> and <code>WEBSTER_SECRET_KEY</code> (<code>openssl rand -base64 32</code>).</li>
<li>Open <b>Deployments</b> and <b>Redeploy</b>. The database is set up during the build.</li>
</ol></section></main></body></html>`;
  return new NextResponse(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}
