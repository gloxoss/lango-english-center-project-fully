import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { casablancaTodayIso } from '@/libs/finance/today';
import { attendance, guardianStudents, guardians, tenants, user } from '@/models/Schema';
import { GET, POST } from '@/app/api/communication/reminder-audience/route';

const authState = vi.hoisted(() => ({ tenantId: '' }));
vi.mock('@/libs/api/context', () => ({
  requireRequestContext: async () => ({ tenantId: authState.tenantId, role: 'school_admin', branchId: null }),
  requireTenant: (ctx: { tenantId: string }) => ctx.tenantId,
}));
vi.mock('@/libs/api/permissions', () => ({ requireCapability: async () => undefined }));
const sendState = vi.hoisted(() => ({ send: vi.fn(async () => ({ id: 'test-message', delivery: 'sent', provider: 'test' })) }));
vi.mock('@/features/broadcast/services/sms-delivery', () => ({ sendSmsMessage: sendState.send }));
vi.mock('@/libs/api/audit', () => ({ recordAudit: vi.fn() }));

const available = await db.execute(sql`select 1`).then(() => true, () => false);

describe.skipIf(!available)('reminder audience uses full risk and consent truth', () => {
  const tenantId = randomUUID();
  const firstId = `REMINDER-RISK-${tenantId}`;
  const secondId = `REMINDER-CLEAR-${tenantId}`;
  const today = casablancaTodayIso();
  const yesterday = new Date(`${today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const priorDay = yesterday.toISOString().slice(0, 10);
  let linkId: string;

  async function audience(mode: 'atRisk' | 'all' = 'atRisk') {
    const response = await GET(new Request(`http://localhost/api/communication/reminder-audience?mode=${mode}`));
    expect(response.status).toBe(200);
    return response.json();
  }

  async function sendReminder(phone = '0612345678') {
    return POST(new Request('http://localhost/api/communication/reminder-audience', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: firstId, recipientPhone: phone, body: 'Rappel', channel: 'sms' }),
    }));
  }

  beforeAll(async () => {
    authState.tenantId = tenantId;
    await db.insert(tenants).values({ id: tenantId, name: 'Reminder Test', slug: `reminder-${tenantId}` });
    await db.insert(user).values([
      { id: firstId, tenantId, name: 'Risk Student', email: `${firstId}@example.test`, role: 'student' },
      { id: secondId, tenantId, name: 'Clear Student', email: `${secondId}@example.test`, role: 'student' },
    ]);
    const [guardian] = await db.insert(guardians).values({ tenantId, firstName: 'Parent', lastName: 'One', phone: '0612345678' }).returning({ id: guardians.id });
    const [link] = await db.insert(guardianStudents).values({ tenantId, guardianId: guardian!.id, studentId: firstId, relationshipType: 'parent', canAccessCommunication: true }).returning({ id: guardianStudents.id });
    linkId = link!.id;
    await db.insert(attendance).values([
      { tenantId, studentId: firstId, date: today, status: 'absent' },
      { tenantId, studentId: firstId, date: priorDay, status: 'absent' },
      { tenantId, studentId: secondId, date: today, status: 'absent' },
    ]);
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('lists the two-day risk once and removes the contact after access is revoked', async () => {
    const before = await audience();
    expect(before).toMatchObject({ total: 1, eligibleCount: 1 });
    expect(before.data[0]).toMatchObject({ studentId: firstId, phone: '0612345678', riskLevel: 'Absences répétées' });

    expect((await sendReminder()).status).toBe(200);
    expect(sendState.send).toHaveBeenCalledTimes(1);
    expect((await sendReminder('0611111111')).status).toBe(409);
    expect(sendState.send).toHaveBeenCalledTimes(1);

    await db.update(guardianStudents).set({ canAccessCommunication: false }).where(eq(guardianStudents.id, linkId));
    expect((await sendReminder()).status).toBe(409);
    expect(sendState.send).toHaveBeenCalledTimes(1);
    const after = await audience();
    expect(after).toMatchObject({ total: 0, eligibleCount: 1, data: [] });
    const all = await audience('all');
    expect(all).toMatchObject({ total: 0, eligibleCount: 2 });
  });
});
