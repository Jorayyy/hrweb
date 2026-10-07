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
  if (email && (await isLocked(lockKey))) {
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
        await noteFailure(lockKey, security.loginLockoutAttempts, security.loginLockoutMinutes);
      }
      return "Invalid email or password.";
    }
    throw error;
  }
  return "Something went wrong. Please try again.";
}
