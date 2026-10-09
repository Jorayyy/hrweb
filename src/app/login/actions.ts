import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
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

  const security = await getSecuritySettings();

  let locked = false;
  try {
    locked = email !== "" && (await isLocked(lockKey));
  } catch (cause) {
    const err = cause as Error & { cause?: Error };
    return `DB-DEBUG: ${err.cause?.message ?? err.message}`;
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
      if (email) {
        // Lockout counter is best-effort: a failed write must not hide the login result.
        try {
          await noteFailure(lockKey, security.loginLockoutAttempts, security.loginLockoutMinutes);
        } catch {}
      }
      return "Invalid email or password.";
    }
    throw error;
  }
  return "Something went wrong. Please try again.";
}
