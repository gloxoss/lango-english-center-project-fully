// Broadcast consent + suppression enforcement. checkConsent() is evaluated at
// snapshot time AND immediately before dispatch; a revoked consent or any
// suppression (global or channel-specific) must block delivery, while the
// default (school's own students/guardians) is allowed. Proven against a real DB.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { checkConsent } from '@/features/broadcast/services/consent-service';
import { communicationConsents, communicationSuppressions, tenants } from '@/models/Schema';

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('broadcast consent + suppression', () => {
  const suffix = Date.now().toString(36);
  const tenantId = crypto.randomUUID();

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `Consent ${suffix}`, slug: `consent-${suffix}` });
  }, 30_000);

  afterAll(async () => {
    await db.delete(communicationSuppressions).where(eq(communicationSuppressions.tenantId, tenantId));
    await db.delete(communicationConsents).where(eq(communicationConsents.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  }, 30_000);

  it('defaults to allowed when no consent or suppression exists', async () => {
    await expect(checkConsent(tenantId, 'student', `stu-default-${suffix}`, 'sms'))
      .resolves.toMatchObject({ allowed: true, reason: 'ok' });
  });

  it('blocks on an explicit revoked consent', async () => {
    const recipientId = `stu-revoked-${suffix}`;
    await db.insert(communicationConsents).values({ tenantId, recipientKind: 'student', recipientId, channel: 'sms', granted: false });
    await expect(checkConsent(tenantId, 'student', recipientId, 'sms'))
      .resolves.toMatchObject({ allowed: false, reason: 'consent_revoked' });
  });

  it('a global (channel-null) suppression blocks delivery', async () => {
    const recipientId = `stu-global-${suffix}`;
    await db.insert(communicationSuppressions).values({ tenantId, recipientKind: 'student', recipientId, channel: null });
    await expect(checkConsent(tenantId, 'student', recipientId, 'sms'))
      .resolves.toMatchObject({ allowed: false, reason: 'suppressed' });
  });

  it('a channel-specific suppression also blocks delivery', async () => {
    const recipientId = `stu-channel-${suffix}`;
    await db.insert(communicationSuppressions).values({ tenantId, recipientKind: 'student', recipientId, channel: 'sms' });
    await expect(checkConsent(tenantId, 'student', recipientId, 'sms'))
      .resolves.toMatchObject({ allowed: false, reason: 'suppressed' });
  });

  it('an explicit grant (granted=true) remains allowed', async () => {
    const recipientId = `stu-granted-${suffix}`;
    await db.insert(communicationConsents).values({ tenantId, recipientKind: 'student', recipientId, channel: 'sms', granted: true });
    await expect(checkConsent(tenantId, 'student', recipientId, 'sms'))
      .resolves.toMatchObject({ allowed: true, reason: 'ok' });
  });
});
