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

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api/media).*)"] };

function setupPage() {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>WEBSTER: connect a database</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0c0a09;color:#f4ede4;font:16px/1.6 system-ui,sans-serif;padding:16px}main{max-width:560px}h1{font-size:22px}code{background:#1f1a16;padding:2px 6px;border-radius:4px}li{margin:6px 0}</style></head>
<body><main><h1>WEBSTER is deployed, but has no database yet</h1><ol>
<li>In this Vercel project, open <b>Storage</b> and create a <b>Prisma Postgres</b> database, connected to this project. It sets <code>DATABASE_URL</code>.</li>
<li>In <b>Settings → Environment Variables</b>, add <code>WEBSTER_FOUNDER_EMAIL</code>, <code>WEBSTER_FOUNDER_PASSWORD</code> and <code>WEBSTER_SECRET_KEY</code> (<code>openssl rand -base64 32</code>).</li>
<li>Open <b>Deployments</b> and <b>Redeploy</b>. The database is set up during the build.</li>
</ol></main></body></html>`;
  return new NextResponse(html, { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
}
