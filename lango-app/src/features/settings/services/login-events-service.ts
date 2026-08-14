import { and, desc, eq, like, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';
import { loginEvents } from '@/features/settings/models/settings-schema';

// ---------------------------------------------------------------------------
// Login events (settings-platform, Phase F). Every email/password sign-in
// attempt - success and failure - is recorded so a tenant can audit who
// logged in when, from where, and which attempts failed. Recording is
// fire-and-forget: a failure to log must never break the sign-in flow.
// ---------------------------------------------------------------------------

const SIGN_IN_EMAIL_PATH = '/sign-in/email';

type SignInHookContext = {
  path: string;
  body?: { email?: string };
  request?: { headers?: { get: (name: string) => string | null } };
  context?: {
    newSession?: { user?: { id?: string; tenantId?: string | null; email?: string } } | null;
  };
};

export async function recordLoginEvent(input: {
  tenantId: string | null;
  userId: string | null;
  email: string | null;
  method: string;
  success: boolean;
  failureReason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    await db.insert(loginEvents).values({
      tenantId: input.tenantId,
      userId: input.userId,
      email: input.email,
      method: input.method,
      success: input.success,
      failureReason: input.failureReason ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    });
  } catch (err) {
    console.error('[login-events] failed to record login event:', err);
  }
}

/**
 * Called from the Better Auth `after` hook for the email/password endpoint.
 * On success the session user carries the tenantId; on failure the account is
 * resolved by email so the failed attempt is attributed to the right tenant.
 */
export async function captureSignInLoginEvent(ctx: SignInHookContext): Promise<void> {
  if (ctx.path !== SIGN_IN_EMAIL_PATH) {
    return;
  }

  const sessionUser = ctx.context?.newSession?.user;
  const success = Boolean(sessionUser?.id);
  const email = ctx.body?.email ?? sessionUser?.email ?? null;

  let userId = sessionUser?.id ?? null;
  let tenantId = sessionUser?.tenantId ?? null;

  if (!success && email) {
    const [found] = await db
      .select({ id: user.id, tenantId: user.tenantId })
      .from(user)
      .where(sql`lower(${user.email}) = ${email.trim().toLowerCase()}`)
      .limit(1);
    if (found) {
      userId = found.id;
      tenantId = found.tenantId;
    }
  }

  const headers = ctx.request?.headers;
  const ip = headers?.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? headers?.get('x-real-ip')
    ?? null;
  const userAgent = headers?.get('user-agent') ?? null;

  await recordLoginEvent({
    tenantId,
    userId,
    email,
    method: 'email',
    success,
    failureReason: success ? null : 'invalid_credentials',
    ip,
    userAgent,
  });
}

export type LoginEventListOptions = {
  page?: number;
  limit?: number;
  success?: boolean;
  email?: string;
};

export async function listLoginEvents(
  tenantId: string,
  options: LoginEventListOptions = {},
): Promise<{
  rows: typeof loginEvents.$inferSelect[];
  total: number;
  summary: { total: number; failed: number; success: number };
  page: number;
  limit: number;
}> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 50));

  const tenantWhere = eq(loginEvents.tenantId, tenantId);
  const conditions = [tenantWhere];
  if (options.success !== undefined) {
    conditions.push(eq(loginEvents.success, options.success));
  }
  if (options.email) {
    conditions.push(like(loginEvents.email, `%${options.email.trim()}%`));
  }
  const where = and(...conditions);

  // `total` is the filtered count (drives pagination); `summary` is always the
  // tenant-wide picture so the KPI cards stay stable while filtering.
  const [totalRow, failedRow, summaryTotalRow, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(loginEvents).where(where),
    db.select({ count: sql<number>`count(*)::int` }).from(loginEvents).where(and(tenantWhere, eq(loginEvents.success, false))),
    db.select({ count: sql<number>`count(*)::int` }).from(loginEvents).where(tenantWhere),
    db
      .select()
      .from(loginEvents)
      .where(where)
      .orderBy(desc(loginEvents.createdAt))
      .offset((page - 1) * limit)
      .limit(limit),
  ]);

  const summaryTotal = summaryTotalRow[0]?.count ?? 0;
  const summaryFailed = failedRow[0]?.count ?? 0;

  return {
    rows,
    total: totalRow[0]?.count ?? 0,
    summary: { total: summaryTotal, failed: summaryFailed, success: summaryTotal - summaryFailed },
    page,
    limit,
  };
}
