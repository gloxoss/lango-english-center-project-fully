import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { auditLogs, schoolSettings, tenants } from '@/models/Schema';

/**
 * SCF-03-01 and SCF-03-03.
 *
 * 03-01: the Organisation page kept its own copy of the school year. Only the
 * hub badge read it; everything real reads `session_years`. Saving the page
 * must no longer write it.
 *
 * 03-03: ICE, RC, IF, MEN, stamp and signature end up printed on official
 * documents and had no history at all. A change now records before/after.
 */

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: vi.fn().mockResolvedValue(undefined),
}));

const tenantId = randomUUID();
// Test 3 uses its own tenant: audit writes are fire-and-forget, and under a
// loaded full-suite run a straggler from tests 1-2 could land after the
// beforeEach delete and be read as test 3's own entry. A tenant only test 3
// writes to has no stragglers to inherit.
const tenant3Id = randomUUID();
const context = {
  userId: 'usr-legal-admin',
  tenantId,
  branchId: null,
  role: 'school_admin',
  baseRole: 'school_admin',
  name: 'Directeur',
  email: 'directeur@legal.test',
  sessionId: null,
  impersonated: false,
};

async function postSettings(payload: Record<string, unknown>) {
  const { POST } = await import('@/app/api/settings/route');
  return POST(new Request('http://localhost:3000/api/settings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }));
}

/**
 * recordAudit is fire-and-forget (it must never fail the request it audits),
 * so nothing here can await it. Poll until the row we need exists. The budget
 * is generous because vitest runs these files in parallel and a loaded
 * Postgres can take seconds to land a background insert.
 */
async function waitForAuditOf(
  tenant: string,
  ok: (rows: (typeof auditLogs.$inferSelect)[]) => boolean,
  attempts = 200,
): Promise<(typeof auditLogs.$inferSelect)[]> {
  let rows: (typeof auditLogs.$inferSelect)[] = [];
  for (let attempt = 0; attempt < attempts; attempt++) {
    rows = await db.select().from(auditLogs).where(eq(auditLogs.tenantId, tenant));
    if (ok(rows)) return rows;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return rows;
}

async function waitForAudit(
  ok: (rows: (typeof auditLogs.$inferSelect)[]) => boolean,
  attempts = 200,
): Promise<(typeof auditLogs.$inferSelect)[]> {
  return waitForAuditOf(tenantId, ok, attempts);
}

describe('Settings legal-identity history (SCF-03-03)', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({
      id: tenantId,
      name: 'Legal History Tenant',
      slug: `lh-${tenantId.slice(0, 8)}`,
    });
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValue(context as never);
  });

  afterAll(async () => {
    await db.delete(auditLogs).where(eq(auditLogs.tenantId, tenantId));
    await db.delete(auditLogs).where(eq(auditLogs.tenantId, tenant3Id));
    await db.delete(schoolSettings).where(eq(schoolSettings.tenantId, tenantId));
    await db.delete(schoolSettings).where(eq(schoolSettings.tenantId, tenant3Id));
    await db.delete(tenants).where(inArray(tenants.id, [tenantId, tenant3Id]));
  });

  beforeEach(async () => {
    await db.delete(auditLogs).where(eq(auditLogs.tenantId, tenantId));
  });

  it('1. changing ICE records {changed: {ice: {before, after}}}', async () => {
    const created = await postSettings({ establishmentName: 'École Test', ice: 'ICE-ORIGINAL' });
    expect(created.status).toBe(200);

    const updated = await postSettings({ establishmentName: 'École Test', ice: 'ICE-NOUVEAU' });
    expect(updated.status).toBe(200);

    // Select by content, not by arrival order: the first POST also writes an
    // audit row (the row did not exist, so every field is "new").
    const isTheIceEdit = (e: typeof auditLogs.$inferSelect) => {
      const changed = (e.metadata as { changed?: Record<string, { after?: unknown }> } | null)?.changed;
      return e.entityType === 'school_settings' && changed?.ice?.after === 'ICE-NOUVEAU';
    };
    const entries = await waitForAudit(rows => rows.some(isTheIceEdit));
    const entry = entries.find(isTheIceEdit);
    expect(entry).toBeDefined();

    const metadata = entry!.metadata as { changed: Record<string, { before: unknown; after: unknown }> };
    expect(metadata.changed.ice).toEqual({ before: 'ICE-ORIGINAL', after: 'ICE-NOUVEAU' });
    // Unchanged fields are omitted, not recorded as before === after.
    expect(Object.keys(metadata.changed)).toEqual(['ice']);
  });

  it('2. saving the page never writes the school year', async () => {
    // Put a second, contradictory year on the row the old page used to own.
    await db
      .update(schoolSettings)
      .set({ academicYear: '1999-2000', startDate: '1999-09-01', endDate: '2000-06-30' })
      .where(eq(schoolSettings.tenantId, tenantId));

    const res = await postSettings({
      establishmentName: 'École Test',
      academicYear: '2026-2027',
      startDate: '2026-09-01',
      endDate: '2027-06-30',
    });
    expect(res.status).toBe(200);

    const [row] = await db.select().from(schoolSettings).where(eq(schoolSettings.tenantId, tenantId));
    // The body carried a new year; the row must be untouched. `session_years`
    // is the only place a school year lives now.
    expect(row!.academicYear).toBe('1999-2000');
    expect(row!.startDate).toBe('1999-09-01');
    expect(row!.endDate).toBe('2000-06-30');
  });

  it('3. an unchanged legal field produces no changed entry for it', async () => {
    // Own tenant: fire-and-forget stragglers from tests 1-2 cannot appear here,
    // so the row set below is produced by this test's two saves only.
    await db.insert(tenants).values({
      id: tenant3Id,
      name: 'Legal History Tenant 3',
      slug: `lh3-${tenant3Id.slice(0, 8)}`,
    });
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValue({ ...context, tenantId: tenant3Id } as never);

    // First save creates the row: every legal field is new, so a changed block
    // exists. Second save repeats the same values: it must be audited with NO
    // changed block (an unchanged field must not report as a change, or the
    // history becomes a list of every time a form was opened).
    const created = await postSettings({ establishmentName: 'École Test 3', ice: 'ICE-STABLE', rc: 'RC-1' });
    expect(created.status).toBe(200);
    const unchanged = await postSettings({ establishmentName: 'École Test 3', ice: 'ICE-STABLE', rc: 'RC-1' });
    expect(unchanged.status).toBe(200);

    const hasChanged = (e: typeof auditLogs.$inferSelect) => {
      const changed = (e.metadata as { changed?: Record<string, unknown> } | null)?.changed;
      return Boolean(changed && Object.keys(changed).length > 0);
    };
    const rows = await waitForAuditOf(tenant3Id, r => r.some(hasChanged) && r.some(e => !hasChanged(e)));

    const changedRows = rows.filter(hasChanged);
    const plainRows = rows.filter(e => !hasChanged(e));
    expect(changedRows).toHaveLength(1);
    expect(changedRows[0]!.metadata).toMatchObject({ changed: { ice: { after: 'ICE-STABLE' } } });
    expect(plainRows.length).toBeGreaterThan(0);
    for (const row of plainRows) {
      expect(((row.metadata ?? {}) as { changed?: unknown }).changed).toBeUndefined();
    }

    vi.mocked(requireRequestContext).mockResolvedValue(context as never);
  });
});
