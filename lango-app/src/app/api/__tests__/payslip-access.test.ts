import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/hr/payslips/[id]/route';
import { db } from '@/libs/DB';
import { payrollPeriods, payrollRunLines, payslips, tenants, user } from '@/models/Schema';
import type { RequestContext } from '@/libs/api/context';

// hr route-level coverage was 0 of 31, and this is the most sensitive route in
// the module: GET /api/hr/payslips/[id] returns gross salary, net salary, CNSS,
// AMO, IR tax and total employer cost for a payslip identified by a
// client-supplied id.
//
// The route is correctly written — it scopes the lookup by tenant and then
// rejects with 403 when row.userId is not the caller, unless the caller is
// school_admin/accountant. Nothing tested that, so nothing would notice if the
// ownership branch were dropped. Salary data is exactly what Law 09-08 treats
// as personal data.
//
// Note: the ownership check here uses a hardcoded role list rather than a
// capability (the D-1 drift pattern the audit flagged as a defect *generator*).
// That is recorded, not fixed here — changing the authorization model is out of
// scope for a test.

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

const dbReachable = Boolean(process.env.DATABASE_URL);
const tenantId = crypto.randomUUID();
const EMP_A = `USR-EA-${crypto.randomUUID()}`;
const EMP_B = `USR-EB-${crypto.randomUUID()}`;
const ADMIN = `USR-AD-${crypto.randomUUID()}`;

let payslipB = ''; // belongs to employee B

async function asRole(userId: string, role: string) {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({ userId, tenantId, role } as RequestContext);
}

function getPayslip(id: string): Promise<Response> {
  return GET(new Request(`http://localhost/api/hr/payslips/${id}`), {
    params: Promise.resolve({ id }),
  });
}

describe.skipIf(!dbReachable)('GET /api/hr/payslips/[id] — salary data access', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Payslip Test', slug: `ps-${tenantId}` });
    await db.insert(user).values([
      { id: EMP_A, tenantId, name: 'Employe A', email: `ea-${tenantId}@t.local`, role: 'teacher' },
      { id: EMP_B, tenantId, name: 'Employe B', email: `eb-${tenantId}@t.local`, role: 'teacher' },
      { id: ADMIN, tenantId, name: 'Admin', email: `ad-${tenantId}@t.local`, role: 'school_admin' },
    ]);

    const [period] = await db.insert(payrollPeriods)
      .values({ tenantId, year: 2026, month: 8 }).returning();
    const [line] = await db.insert(payrollRunLines).values({
      tenantId,
      periodId: period!.id,
      userId: EMP_B,
      grossSalary: '12000.00',
      cnssEmployee: '500.00',
      amoEmployee: '200.00',
      irTax: '1500.00',
      netSalary: '9800.00',
      cnssEmployer: '900.00',
      amoEmployer: '300.00',
      totalEmployerCost: '13200.00',
    }).returning();
    const [slip] = await db.insert(payslips).values({
      tenantId, periodId: period!.id, runLineId: line!.id, userId: EMP_B,
    }).returning();
    payslipB = slip!.id;
  });

  afterAll(async () => {
    await db.delete(payslips).where(eq(payslips.tenantId, tenantId));
    await db.delete(payrollRunLines).where(eq(payrollRunLines.tenantId, tenantId));
    await db.delete(payrollPeriods).where(eq(payrollPeriods.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('refuses a colleague’s payslip and leaks no salary figure', async () => {
    await asRole(EMP_A, 'teacher');
    const res = await getPayslip(payslipB);

    expect(res.status).toBe(403);
    // The body must not carry the numbers even in an error shape.
    const body = await res.text();
    expect(body).not.toContain('9800');
    expect(body).not.toContain('12000');
  });

  it('returns the employee’s own payslip', async () => {
    await asRole(EMP_B, 'teacher');
    const res = await getPayslip(payslipB);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.netSalary).toBe('9800.00');
    expect(json.data.userId).toBe(EMP_B);
  });

  it('lets an HR admin read any employee’s payslip in their tenant', async () => {
    await asRole(ADMIN, 'school_admin');
    const res = await getPayslip(payslipB);
    expect(res.status).toBe(200);
  });

  it('hides a payslip belonging to another tenant', async () => {
    // Same admin role, but the context carries a different tenant, so the
    // tenant-scoped lookup must miss entirely — 404, not a 403 on real data.
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValue({
      userId: ADMIN, tenantId: crypto.randomUUID(), role: 'school_admin',
    } as RequestContext);

    const res = await getPayslip(payslipB);
    expect(res.status).toBe(404);
  });
});
