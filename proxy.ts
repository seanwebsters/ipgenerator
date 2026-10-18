import { NextResponse, type NextRequest } from "next/server";

/**
 * - WEBSTER OS: requests without a session cookie go to /os/login
 *   (the session itself is validated server-side on every page/action),
 *   except on the temporary built-in database, which needs no sign-in.
 * - WEBSTER WORLD: every visitor gets an anonymous viewer id cookie.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // No sign-in on the temporary built-in database (see currentUser).
  if (process.env.DATABASE_URL && pathname.startsWith("/os") && pathname !== "/os/login" && !req.cookies.get("wb_session")) {
    return NextResponse.redirect(new URL("/os/login", req.url));
  }
  const res = NextResponse.next();
  if (!req.cookies.get("wb_viewer")) {
    res.cookies.set("wb_viewer", crypto.randomUUID(), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api/media).*)"] };
