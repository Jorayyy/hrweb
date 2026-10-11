import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic gate only — the cookie is not checked on protected paths; the
 * authoritative check is `sessionUser()` via `requireRole` in `(app)/layout.tsx`
 * and in every server action. /login and /bundy are passed through: the login
 * page itself bounces already-signed-in users, so a revoked (undecodable-but-
 * stale or tokenVersion-mismatched) cookie can always reach the form again.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = ["__Secure-authjs.session-token", "authjs.session-token"].some((name) =>
    request.cookies.has(name),
  );

  if (pathname === "/login" || pathname === "/bundy") {
    return NextResponse.next();
  }

  if (!hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
