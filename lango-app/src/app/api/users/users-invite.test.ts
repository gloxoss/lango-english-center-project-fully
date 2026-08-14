import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let currentSessionUserId: string | null = null;
vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession: async () => (currentSessionUserId ? { user: { id: currentSessionUserId } } : null),
    },
  },
}));

const { db } = await import('@/libs/DB');
const { tenants, user, accountSetupTokens, smsMessages } = await import('@/models/Schema');
const { POST } = await import('./route');
const { hashSetupToken } = await import('@/libs/setup-token');

const hasDb = Boolean(process.env.DATABASE_URL);

function inviteRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe.skipIf(!hasDb)('POST /api/users — honest invitation semantics', () => {
  const suffix = Date.now();
  const tenantId = crypto.randomUUID();
  const adminId = `INV-ADMIN-${suffix}`;
  let invitedUserId: string | null = null;

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Invite Tenant', slug: `inv-${suffix}` });
    await db.insert(user).values({
      id: adminId, tenantId, name: 'Admin', email: `admin-${suffix}@t.local`,
      role: 'school_admin', userStatus: 'active',
    });
    currentSessionUserId = adminId;
  });

  afterAll(async () => {
    if (invitedUserId) {
      await db.delete(user).where(eq(user.id, invitedUserId));
    }
    await db.delete(user).where(eq(user.id, adminId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('creates a hashed single-use token + a QUEUED SMS (never claims sent) when a phone is provided', async () => {
    const res = await POST(inviteRequest({
      fullName: 'Nouvel Enseignant',
      email: `prof-${suffix}@t.local`,
      phone: '06 12 34 56 78',
      role: 'Enseignant',
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    invitedUserId = body.data?.id;
    expect(body.invitation).toEqual({ tokenCreated: true, deliveryStatus: 'queued' });
    expect(body.message).toContain('file d\'attente');
    expect(body.message).not.toContain('envoyé');

    const [tokenRow] = await db
      .select()
      .from(accountSetupTokens)
      .where(and(eq(accountSetupTokens.userId, invitedUserId!), isNull(accountSetupTokens.usedAt)));
    expect(tokenRow).toBeDefined();
    // Stored value is the SHA-256 digest (64 hex chars), never the raw token.
    expect(tokenRow!.token).toMatch(/^[0-9a-f]{64}$/);

    const [sms] = await db
      .select({ status: smsMessages.status, recipientPhone: smsMessages.recipientPhone, body: smsMessages.body })
      .from(smsMessages)
      .where(and(eq(smsMessages.tenantId, tenantId), eq(smsMessages.createdById, adminId)))
      .orderBy(smsMessages.createdAt);
    expect(sms).toBeDefined();
    expect(sms!.status).toBe('queued');
    expect(sms!.recipientPhone).toBe('+212612345678');
    const rawToken = sms!.body.match(/token=([^ ]+)/)?.[1];
    expect(rawToken).toBeDefined();
    // The raw token travels only in the SMS; the DB stores its SHA-256 digest.
    expect(tokenRow!.token).toBe(hashSetupToken(rawToken!));
  });

  it('creates NO token when no phone is provided and reports it honestly', async () => {
    const res = await POST(inviteRequest({
      fullName: 'Sans Téléphone',
      email: `nophone-${suffix}@t.local`,
      role: 'Comptable',
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invitation).toEqual({ tokenCreated: false, deliveryStatus: 'no_phone' });
    expect(body.message).toContain('aucun numéro de téléphone');

    const [tokenRow] = await db
      .select({ id: accountSetupTokens.id })
      .from(accountSetupTokens)
      .where(and(eq(accountSetupTokens.userId, body.data?.id)));
    expect(tokenRow).toBeUndefined();
  });
});
