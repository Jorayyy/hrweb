import { eq } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempt } from "@/db/schema";

export type FailureState = { failedCount: number; lockedUntil: Date | null };

/**
 * Pure next state of a lockout counter after one failed attempt.
 * A lock that already expired starts a fresh window; the counter otherwise
 * resets on success (row deleted) and locks at `maxAttempts`.
 */
export function nextFailureState(
  row: { failedCount: number; lockedUntil: Date | null } | null | undefined,
  now: number,
  maxAttempts: number,
  lockMinutes: number,
): FailureState {
  const lock = row?.lockedUntil ?? null;
  const expired = lock != null && lock.getTime() <= now;
  const active = lock != null && !expired;
  const failedCount = !row || expired ? 1 : row.failedCount + 1;
  const lockedUntil =
    failedCount >= maxAttempts ? new Date(now + lockMinutes * 60_000) : active ? lock : null;
  return { failedCount, lockedUntil };
}

/** True while a key is locked out. Read-only — safe before any credential check. */
export async function isLocked(key: string): Promise<boolean> {
  const [row] = await db
    .select({ lockedUntil: loginAttempt.lockedUntil })
    .from(loginAttempt)
    .where(eq(loginAttempt.key, key))
    .limit(1);
  return row?.lockedUntil != null && row.lockedUntil.getTime() > Date.now();
}

export async function noteFailure(
  key: string,
  maxAttempts: number,
  lockMinutes: number,
): Promise<void> {
  const [row] = await db
    .select()
    .from(loginAttempt)
    .where(eq(loginAttempt.key, key))
    .limit(1);
  const { failedCount, lockedUntil } = nextFailureState(
    row,
    Date.now(),
    maxAttempts,
    lockMinutes,
  );

  await db
    .insert(loginAttempt)
    .values({ key, failedCount, lockedUntil })
    .onConflictDoUpdate({
      target: loginAttempt.key,
      set: { failedCount, lockedUntil, updatedAt: new Date() },
    });
}

/** Clears the counter after a successful credential check. */
export async function noteSuccess(key: string): Promise<void> {
  await db.delete(loginAttempt).where(eq(loginAttempt.key, key));
}
