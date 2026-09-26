import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { auditLogs, semesters, sessionYears, tenants } from '@/models/Schema';

/**
 * SCF-10-01. Updating or deleting a school year / semester used to write
 * "session_year updated" with no metadata, so the audit could not say which
 * date moved. Both routes now write `{ changed: { field: { before, after } } }`
 * with only the fields that actually changed.
 *
 * recordAudit is fire-and-forget, so the assertions poll for the row.
 */

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: vi.fn().mockResolvedValue(undefined),
}));

const dbReachable = Boolean(process.env.DATABASE_URL);
const suffix = randomUUID().slice(0, 8);
const tenantId = randomUUID();
const yearId = randomUUID();
const yearToDeleteId = randomUUID();
const semesterId = randomUUID();
const semesterToDeleteId = randomUUID();

const context = {
  userId: `USR-AUDIT-${suffix}`,
  tenantId,
  branchId: null,
  role: 'school_admin',
  baseRole: 'school_admin',
  name: 'Directeur',
  email: 'directeur@audit-meta.test',
  sessionId: null,
  impersonated: false,
};

async function asAdmin() {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue(context as never);
}

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function waitForAudit(entityType: string, entityId: string) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const [row] = await db
      .select()
      .from(auditLogs)
      .where(and(
        eq(auditLogs.tenantId, tenantId),
        eq(auditLogs.entityType, entityType),
        eq(auditLogs.entityId, entityId),
      ))
      .limit(1);
    if (row) return row;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`audit row for ${entityType}:${entityId} never landed`);
}

describe.skipIf(!dbReachable)('Before/after audit metadata (SCF-10-01)', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `Audit Meta ${suffix}`, slug: `am-${suffix}` });
    await db.insert(sessionYears).values([
      { id: yearId, tenantId, name: '2026-2027', startDate: '2026-09-01', endDate: '2027-06-30', isDefault: true },
      { id: yearToDeleteId, tenantId, name: '2028-2029', startDate: '2028-09-01', endDate: '2029-06-30', isDefault: false },
    ]);
    await db.insert(semesters).values([
      { id: semesterId, tenantId, name: 'Semestre 1', startMonth: 9, endMonth: 12 },
      { id: semesterToDeleteId, tenantId, name: 'Semestre 3', startMonth: 4, endMonth: 6 },
    ]);
    await asAdmin();
  });

  afterAll(async () => {
    await db.delete(auditLogs).where(eq(auditLogs.tenantId, tenantId));
    await db.delete(semesters).where(eq(semesters.tenantId, tenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('1. session-year update records only the fields that changed', async () => {
    const { PUT } = await import('@/app/api/academics/session-years/route');
    const res = await PUT(jsonRequest('http://localhost:3000/api/academics/session-years', 'PUT', {
      id: yearId,
      name: '2026-2027 B',
      endDate: '2027-07-15',
    }));
    expect(res.status).toBe(200);

    const row = await waitForAudit('session_year', yearId);
    expect(row.action).toBe('update');
    expect(row.metadata).toEqual({
      changed: {
        name: { before: '2026-2027', after: '2026-2027 B' },
        endDate: { before: '2027-06-30', after: '2027-07-15' },
      },
    });
  });

  it('2. session-year delete records the removed row as before -> null', async () => {
    const { DELETE } = await import('@/app/api/academics/session-years/route');
    const res = await DELETE(new Request(`http://localhost:3000/api/academics/session-years?id=${yearToDeleteId}`, { method: 'DELETE' }));
    expect(res.status).toBe(200);

    const row = await waitForAudit('session_year', yearToDeleteId);
    expect(row.action).toBe('delete');
    expect(row.metadata).toEqual({
      changed: {
        name: { before: '2028-2029', after: null },
        startDate: { before: '2028-09-01', after: null },
        endDate: { before: '2029-06-30', after: null },
        isDefault: { before: false, after: null },
      },
    });
  });

  it('3. semester update records only the fields that changed', async () => {
    const { PUT } = await import('@/app/api/academics/semesters/route');
    const res = await PUT(jsonRequest('http://localhost:3000/api/academics/semesters', 'PUT', {
      id: semesterId,
      name: 'Semestre 1 B',
    }));
    expect(res.status).toBe(200);

    const row = await waitForAudit('semester', semesterId);
    expect(row.action).toBe('update');
    expect(row.metadata).toEqual({
      changed: {
        name: { before: 'Semestre 1', after: 'Semestre 1 B' },
      },
    });
  });

  it('4. semester delete records the removed row as before -> null', async () => {
    const { DELETE } = await import('@/app/api/academics/semesters/route');
    const res = await DELETE(new Request(`http://localhost:3000/api/academics/semesters?id=${semesterToDeleteId}`, { method: 'DELETE' }));
    expect(res.status).toBe(200);

    const row = await waitForAudit('semester', semesterToDeleteId);
    expect(row.action).toBe('delete');
    expect(row.metadata).toEqual({
      changed: {
        name: { before: 'Semestre 3', after: null },
        startMonth: { before: 4, after: null },
        endMonth: { before: 6, after: null },
      },
    });
  });
});
