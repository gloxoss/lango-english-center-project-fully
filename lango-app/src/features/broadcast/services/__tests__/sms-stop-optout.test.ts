// Audit 3 P1-K: every direct SMS send honours STOP / opt-out, and an inbound
// STOP reply creates the suppression. Proven against a real DB.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { handleInboundStop, isStopKeyword } from '@/features/broadcast/services/inbound-stop';
import { findSendBlock, sendSmsMessage } from '@/features/broadcast/services/sms-delivery';
import { communicationConsents, communicationSuppressions, smsMessages, tenants, user } from '@/models/Schema';

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe('isStopKeyword', () => {
  it('recognises FR / EN / AR opt-out words as the first word', () => {
    for (const t of ['STOP', 'stop please', 'Arrêt', 'ARRET.', 'unsubscribe', 'توقف']) {
      expect(isStopKeyword(t)).toBe(true);
    }
  });

  it('ignores ordinary replies', () => {
    for (const t of ['merci', 'please stop by tomorrow', 'ok', '']) {
      expect(isStopKeyword(t)).toBe(false);
    }
  });
});

describe.skipIf(!dbReachable)('direct SMS STOP enforcement', () => {
  const suffix = Date.now().toString(36);
  const tenantId = crypto.randomUUID();
  const otherTenantId = crypto.randomUUID();
  const phone = `+2126${String(Date.now()).slice(-8)}`;
  const studentId = `stu-stop-${suffix}`;

  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: `Stop ${suffix}`, slug: `stop-${suffix}` },
      { id: otherTenantId, name: `Stop other ${suffix}`, slug: `stop-other-${suffix}` },
    ]);
    await db.insert(user).values({ id: studentId, tenantId: otherTenantId, name: 'Élève Stop', email: `${studentId}@t.local`, role: 'student' });
  }, 30_000);

  afterAll(async () => {
    for (const id of [tenantId, otherTenantId]) {
      await db.delete(smsMessages).where(eq(smsMessages.tenantId, id));
      await db.delete(communicationSuppressions).where(eq(communicationSuppressions.tenantId, id));
      await db.delete(communicationConsents).where(eq(communicationConsents.tenantId, id));
      await db.delete(user).where(eq(user.tenantId, id));
      await db.delete(tenants).where(eq(tenants.id, id));
    }
  }, 30_000);

  it('sends normally when the number is not suppressed', async () => {
    const res = await sendSmsMessage(tenantId, { to: phone, body: 'Rappel' });
    expect(res.failureReason).toBeNull();
    expect(res.delivery).not.toBe('failed');
  });

  it('an inbound STOP suppresses the number only in tenants that messaged it', async () => {
    const count = await handleInboundStop(phone, 'test');
    expect(count).toBe(1);
    expect(await findSendBlock(tenantId, phone, null, 'sms')).toBe('suppressed');
    expect(await findSendBlock(otherTenantId, phone, null, 'sms')).toBeNull();
  });

  it('a suppressed number is blocked and the attempt is recorded as failed', async () => {
    const res = await sendSmsMessage(tenantId, { to: phone, body: 'Absence' });
    expect(res.delivery).toBe('failed');
    expect(res.failureReason).toBe('suppressed');
    const [row] = await db.select({ status: smsMessages.status }).from(smsMessages).where(eq(smsMessages.id, res.id));
    expect(row?.status).toBe('failed');
  });

  it('a revoked consent for the student blocks messages about that student', async () => {
    await db.insert(communicationConsents).values({ tenantId: otherTenantId, recipientKind: 'student', recipientId: studentId, channel: 'sms', granted: false });
    const res = await sendSmsMessage(otherTenantId, { to: '+212611111111', body: 'Info', studentId });
    expect(res.failureReason).toBe('consent_revoked');
  });

  it('a repeated STOP does not create duplicate suppressions', async () => {
    await handleInboundStop(phone, 'test');
    const rows = await db.select().from(communicationSuppressions).where(eq(communicationSuppressions.tenantId, tenantId));
    expect(rows).toHaveLength(1);
  });
});
