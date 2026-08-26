// Payroll maker/checker separation: approveRun() must reject an approver who
// is the same actor that calculated the run (PAYROLL_SELF_APPROVAL), and
// accept a different approver. Seeds a `calculated` run directly (bypassing
// the full Morocco calculation engine, which needs a published regulation
// version and real employee inputs - out of scope for this boundary test;
// the existing payroll-runs.test.ts already covers the pure state machine).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { approveRun } from '@/features/workforce/services/payroll-runs';
import { payrollPeriods, tenants, user } from '@/models/Schema';

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('payroll maker/checker separation', () => {
  const suffix = randomUUID().slice(0, 8);
  const tenantId = crypto.randomUUID();
  const calculatorId = `PAY-CALC-${suffix}`;
  const approverId = `PAY-APPR-${suffix}`;
  let runId = '';

  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `Payroll MC ${suffix}`, slug: `pay-mc-${suffix}` });
    await db.insert(user).values([
      { id: calculatorId, tenantId, name: 'Calculator', email: `pay-calc-${suffix}@test.local`, role: 'accountant', userStatus: 'active' },
      { id: approverId, tenantId, name: 'Approver', email: `pay-appr-${suffix}@test.local`, role: 'school_admin', userStatus: 'active' },
    ]);

    const [run] = await db.insert(payrollPeriods).values({
      tenantId, year: 2026, month: 9, status: 'calculated', calculatedById: calculatorId, calculatedAt: new Date().toISOString(),
    }).returning({ id: payrollPeriods.id });
    runId = run!.id;
  }, 30_000);

  afterAll(async () => {
    await db.delete(payrollPeriods).where(eq(payrollPeriods.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  }, 30_000);

  it('rejects the calculator approving their own run', async () => {
    await expect(approveRun(runId, { tenantId, actorId: calculatorId })).rejects.toMatchObject({ code: 'PAYROLL_SELF_APPROVAL' });

    const [row] = await db.select({ status: payrollPeriods.status }).from(payrollPeriods).where(eq(payrollPeriods.id, runId));
    expect(row!.status).toBe('calculated');
  });

  it('allows a different actor to approve the run', async () => {
    const row = await approveRun(runId, { tenantId, actorId: approverId });
    expect(row.status).toBe('approved');
    expect(row.approverId).toBe(approverId);
  });
});
