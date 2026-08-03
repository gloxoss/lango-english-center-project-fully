import { APIError } from 'better-auth/api';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';

// ponytail: fixed policy, not configurable. 5 strikes, 15-minute lock.
// Move to schoolSettings if a school ever asks for different numbers.
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;
export const SIGN_IN_EMAIL_PATH = '/sign-in/email';

type LockoutHookContext = {
  path: string;
  body?: { email?: string };
  context: {
    newSession?: { user?: { id?: string } } | null;
  };
};

type BeforeHookServices = {
  checkLockout: (email: string) => Promise<number>;
};

type AfterHookServices = {
  clearFailedLogins: (userId: string) => Promise<void>;
  recordFailedLogin: (email: string) => Promise<void>;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function lockoutRemainingMinutes(lockedUntil: string | null): number {
  if (!lockedUntil) {
    return 0;
  }
  // Migration 0020 intentionally uses `timestamp without time zone`. node-pg
  // returns that value without an offset, while PostgreSQL in Docker operates
  // in UTC. Parse offset-less database values as UTC so application/server
  // locale (for example Africa/Casablanca) cannot shorten or extend a lock.
  const hasOffset = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(lockedUntil);
  const normalized = lockedUntil.includes('T') ? lockedUntil : lockedUntil.replace(' ', 'T');
  const ms = new Date(hasOffset ? normalized : `${normalized}Z`).getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 60_000) : 0;
}

/** Returns minutes remaining if the account is currently locked, else 0. */
export async function checkLockout(email: string): Promise<number> {
  const [row] = await db
    .select({ lockedUntil: user.lockedUntil })
    .from(user)
    .where(sql`lower(${user.email}) = ${normalizeEmail(email)}`)
    .limit(1);

  return lockoutRemainingMinutes(row?.lockedUntil ?? null);
}

export async function recordFailedLogin(email: string): Promise<void> {
  // Both the strike and lock timestamp are updated atomically. PostgreSQL SET
  // expressions read the pre-update row, so concurrent failures cannot lose a
  // strike. An expired lock starts a fresh five-attempt window at strike one.
  await db.execute(sql`
    UPDATE ${user}
    SET
      failed_login_count = CASE
        WHEN locked_until IS NOT NULL AND locked_until <= now() THEN 1
        ELSE failed_login_count + 1
      END,
      locked_until = CASE
        WHEN locked_until IS NOT NULL AND locked_until <= now() THEN NULL
        WHEN failed_login_count + 1 >= ${MAX_FAILED_LOGINS}
          THEN COALESCE(locked_until, now() + (${LOCKOUT_MINUTES} * interval '1 minute'))
        ELSE locked_until
      END
    WHERE lower(email) = ${normalizeEmail(email)}
  `);
}

export async function clearFailedLogins(userId: string): Promise<void> {
  await db
    .update(user)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLogin: new Date().toISOString() })
    .where(eq(user.id, userId));
}

export async function enforceEmailPasswordLockout(
  ctx: LockoutHookContext,
  services: BeforeHookServices = { checkLockout },
): Promise<void> {
  if (ctx.path !== SIGN_IN_EMAIL_PATH || !ctx.body?.email) {
    return;
  }

  const minutes = await services.checkLockout(ctx.body.email);
  if (minutes > 0) {
    throw new APIError('TOO_MANY_REQUESTS', {
      code: 'ACCOUNT_LOCKED',
      message: `Compte verrouillé après trop de tentatives. Réessayez dans ${minutes} minute(s).`,
    });
  }
}

export async function trackEmailPasswordResult(
  ctx: LockoutHookContext,
  services: AfterHookServices = { clearFailedLogins, recordFailedLogin },
): Promise<void> {
  if (ctx.path !== SIGN_IN_EMAIL_PATH) {
    return;
  }

  const userId = ctx.context.newSession?.user?.id;
  if (userId) {
    await services.clearFailedLogins(userId);
    return;
  }

  if (ctx.body?.email) {
    await services.recordFailedLogin(ctx.body.email);
  }
}
