import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { proxy } from "@/proxy";

const SECRET = "test-secret-0123456789abcdef0123456789abcdef";
const COOKIE = "authjs.session-token";

process.env.AUTH_SECRET = SECRET;

function req(path: string, cookie?: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie: `${COOKIE}=${cookie}` } : {},
  });
}

describe("proxy", () => {
  it("serves /login when there is no session cookie", async () => {
    const res = await proxy(req("/login"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("serves /login for a stale cookie instead of bouncing to /", async () => {
    const res = await proxy(req("/login", "not-a-real-token"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("bounces a live session on /login to the dashboard", async () => {
    const token = await encode({ token: { sub: "1" }, secret: SECRET, salt: COOKIE });
    const res = await proxy(req("/login", token));
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("sends anonymous visitors to /login with a callbackUrl", async () => {
    const res = await proxy(req("/payroll"));
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/login?callbackUrl=%2Fpayroll",
    );
  });
});
