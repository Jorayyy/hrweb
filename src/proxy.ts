import { NextResponse, type NextRequest } from "next/server";
import { decode } from "next-auth/jwt";

const SESSION_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];

/**
 * Cookie presence alone cannot decide /login: a stale or rotated JWT would
 * bounce /login -> / -> /login forever. Decode it so only a live session leaves.
 * Fails closed to the login page.
 */
async function hasLiveSession(request: NextRequest): Promise<boolean> {
  const entry = SESSION_COOKIES.map(
    (name) => [name, request.cookies.get(name)?.value] as const,
  ).find(([, value]) => value);
  if (!entry) return false;
  const [name, token] = entry;
  try {
    return (await decode({ token, secret: process.env.AUTH_SECRET!, salt: name })) !== null;
  } catch {
    return false;
  }
}

/**
 * Optimistic gate only — the cookie is not checked on protected paths; the
 * authoritative check is `auth()` in `(app)/layout.tsx` and in every server action.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));

  if (pathname === "/login") {
    return (await hasLiveSession(request))
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }

  if (pathname === "/bundy") {
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
