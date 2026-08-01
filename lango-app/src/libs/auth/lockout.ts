import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';

// ponytail: fixed policy, not configurable. 5 strikes, 15-minute lock.
// Move to schoolSettings if a school ever asks for different numbers.
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;

export function lockoutRemainingMinutes(lockedUntil: string | null): number {
  if (!lockedUntil) {
    return 0;
  }
  const ms = new Date(lockedUntil).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 60_000) : 0;
}

/** Returns minutes remaining if the account is currently locked, else 0. */
export async function checkLockout(email: string): Promise<number> {
  const [row] = await db
    .select({ lockedUntil: user.lockedUntil })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  return lockoutRemainingMinutes(row?.lockedUntil ?? null);
}

export async function recordFailedLogin(email: string): Promise<void> {
  const [row] = await db
    .update(user)
    .set({ failedLoginCount: sql`${user.failedLoginCount} + 1` })
    .where(eq(user.email, email))
    .returning({ id: user.id, count: user.failedLoginCount });

  if (row && row.count >= MAX_FAILED_LOGINS) {
    await db
      .update(user)
      .set({ lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() })
      .where(and(eq(user.id, row.id), sql`${user.lockedUntil} IS NULL OR ${user.lockedUntil} < now()`));
  }
}

export async function clearFailedLogins(userId: string): Promise<void> {
  await db
    .update(user)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLogin: new Date().toISOString() })
    .where(eq(user.id, userId));
}
