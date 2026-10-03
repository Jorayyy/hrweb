const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.TEST_EMAIL ?? "admin@hrweb.local";
const PASSWORD = process.env.TEST_PASSWORD;

const jar = new Map();

function store(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}

async function req(path, opts = {}) {
  const headers = { ...(opts.headers ?? {}) };
  if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(BASE + path, { ...opts, redirect: "manual", headers });
  store(res);
  return res;
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`ok: ${msg}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(BASE + "/login", { redirect: "manual" });
      if (res.status === 200) return;
    } catch {}
    await sleep(500);
  }
  throw new Error("server did not start");
}

async function main() {
  if (!PASSWORD) throw new Error("TEST_PASSWORD is required");
  await waitForServer();

  const anon = await req("/");
  assert(anon.status >= 300 && anon.status < 400, `anonymous / redirects (${anon.status})`);
  assert((anon.headers.get("location") ?? "").includes("/login"), "redirect target is /login");

  const login = await req("/login");
  assert(login.status === 200, "GET /login renders");
  const html = await login.text();
  assert(html.includes("Sign in"), "login form present");

  const csrf = await req("/api/auth/csrf");
  const { csrfToken } = await csrf.json();
  assert(typeof csrfToken === "string" && csrfToken.length > 10, "csrf token issued");

  const post = (fields) =>
    req("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken, redirectTo: "/", callbackUrl: "/", ...fields }).toString(),
    });

  await post({ email: EMAIL, password: "definitely-wrong-password" });
  const stillAnon = await req("/");
  assert(stillAnon.status >= 300 && stillAnon.status < 400, "bad password grants no session");

  const good = await post({ email: EMAIL, password: PASSWORD });
  assert(good.status >= 300 && good.status < 400, `credentials post responded (${good.status})`);
  const loc = good.headers.get("location") ?? "";
  const locHost = loc ? new URL(loc, BASE).host : new URL(BASE).host;
  assert(locHost === new URL(BASE).host, `login redirect stays on this host (${loc || "relative"})`);
  const hasSession = [...jar.keys()].some((k) => k.includes("session-token"));
  assert(hasSession, "correct password sets session cookie");

  const home = await req("/");
  assert(home.status === 200, `authenticated / renders (${home.status})`);
  const homeHtml = await home.text();
  assert(homeHtml.includes("Active headcount"), "dashboard renders for signed-in user");
  assert(homeHtml.includes("Signed in as ADMIN"), "signed-in role shown in header");
  assert(homeHtml.includes('href="/payroll"'), "sidebar renders role-gated nav");

  const emp = await req("/employees");
  assert(emp.status === 200, `ADMIN can open /employees (${emp.status})`);

  for (const path of ["/setup", "/employees/new", "/employees?q=mark"]) {
    const res = await req(path);
    assert(res.status === 200, `GET ${path} renders (${res.status})`);
  }

  console.log("\nAll auth checks passed.");
}

main().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
