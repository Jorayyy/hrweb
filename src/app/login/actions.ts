"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { clientIp } from "@/lib/bundy";
import { isLocked, noteFailure } from "@/lib/lockout";
import { getSecuritySettings } from "@/lib/settings";

export async function authenticate(
  _prevState: string | null,
  formData: FormData,
): Promise<string | null> {
  const raw = formData.get("callbackUrl");
  const callbackUrl =
    typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  const emailRaw = formData.get("email");
  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  const lockKey = `login:${email}`;
  const ip = clientIp(await headers());
  const ipKey = ip ? `login-ip:${ip}` : null;

  const security = await getSecuritySettings();

  let locked = false;
  try {
    locked =
      (email !== "" && (await isLocked(lockKey))) ||
      (ipKey !== null && (await isLocked(ipKey)));
  } catch {
    return "Can't reach the database right now — try again in a moment.";
  }
  if (locked) {
    return `Too many failed attempts — try again in ${security.loginLockoutMinutes} minutes.`;
  }

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Lockout counters are best-effort: a failed write must not hide the login result.
      if (email) {
        try {
          await noteFailure(lockKey, security.loginLockoutAttempts, security.loginLockoutMinutes);
        } catch {}
      }
      if (ipKey) {
        try {
          await noteFailure(ipKey, security.loginLockoutAttempts, security.loginLockoutMinutes);
        } catch {}
      }
      return "Invalid email or password.";
    }
    throw error;
  }
  return "Something went wrong. Please try again.";
}
