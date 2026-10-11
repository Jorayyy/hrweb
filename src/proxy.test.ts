import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const COOKIE = "authjs.session-token";

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

  // The login page itself bounces valid sessions so revoked cookies can reach the form.
  it("serves /login even with a live session cookie", async () => {
    const res = await proxy(req("/login", "any-token"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("sends anonymous visitors to /login with a callbackUrl", async () => {
    const res = await proxy(req("/payroll"));
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/login?callbackUrl=%2Fpayroll",
    );
  });
});
