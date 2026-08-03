import { eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { employeeSalaryAssignments, payrollPeriods, payrollRunLines, salaryTemplates, tenants, user } from '@/models/Schema';
import { POST } from './route';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(async () => ({
    userId: 'usr_admin_test',
    tenantId: undefined,
    role: 'school_admin',
  })),
  requireTenant: vi.fn((ctx: { tenantId?: string }) => ctx.tenantId),
}));

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: vi.fn(async () => Promise.resolve()),
}));

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('POST /api/hr/payroll/periods/[id]/calculate - recalculation', () => {
  const tenantId = crypto.randomUUID();
  const templateId = crypto.randomUUID();
  const employeeId = `PAYROLL-${crypto.randomUUID()}`;
  const periodId = crypto.randomUUID();

  beforeAll(async () => {
    const { requireRequestContext } = await import('@/libs/api/context');
    (requireRequestContext as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
      userId: 'usr_admin_test',
      tenantId,
      role: 'school_admin',
    }));

    await db.insert(tenants).values({ id: tenantId, name: 'Payroll Test', slug: `payroll-${tenantId}` });
    await db.insert(user).values({ id: employeeId, tenantId, name: 'Payroll Employee', email: `${employeeId}@test.local`, role: 'teacher', userStatus: 'active' });
    await db.insert(salaryTemplates).values({ id: templateId, tenantId, name: 'Standard' });
    await db.insert(payrollPeriods).values({ id: periodId, tenantId, year: 2026, month: 1, status: 'draft' });
    await db.insert(employeeSalaryAssignments).values({ tenantId, userId: employeeId, templateId, baseSalary: '8000.00', effectiveDate: '2026-01-01' });
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('updates the stored line on a second run after the salary assignment changes', async () => {
    const req = () => new NextRequest(`http://localhost:3000/api/hr/payroll/periods/${periodId}/calculate`, { method: 'POST' });

    await POST(req(), { params: Promise.resolve({ id: periodId }) });
    const [firstLine] = await db.select().from(payrollRunLines).where(eq(payrollRunLines.periodId, periodId));
    expect(Number(firstLine?.grossSalary)).toBe(8000);

    await db.insert(employeeSalaryAssignments).values({ tenantId, userId: employeeId, templateId, baseSalary: '12000.00', effectiveDate: '2026-02-01' });

    await POST(req(), { params: Promise.resolve({ id: periodId }) });
    const [secondLine] = await db.select().from(payrollRunLines).where(eq(payrollRunLines.periodId, periodId));

    expect(Number(secondLine?.grossSalary)).toBe(12000);
    expect(secondLine?.id).toBe(firstLine?.id);
  });
});
