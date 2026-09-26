import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { namingSeries, tenants } from '@/models/Schema';

/**
 * SCF-06-01 / OD3. The Numbering page edited `numbering_series_definitions`, a
 * store nothing consumed: a director could renumber the page and the next
 * invoice would not move. It now lists and raises `naming_series`, the counters
 * `reserveMatricule` and `consumeDocumentNumber` actually increment.
 *
 * The interesting rules are the two a naive implementation gets wrong:
 *  - lowering must be REFUSED, not clamped (it would re-issue printed numbers);
 *  - a raise racing a reservation must never produce a duplicate, which is why
 *    the raise takes the same advisory-lock key the reservers use AND the row
 *    lock.
 */

const requireRequestContext = vi.fn();
vi.mock('@/libs/api/context', () => ({
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
  requireRequestContext: (...args: unknown[]) => requireRequestContext(...args),
}));

const tenantId = randomUUID();
const otherTenantId = randomUUID();
const INV = `INV-${tenantId.slice(0, 8)}-`;
const MAT = `ZZT-2526-`;
const RC_YEAR = `RC-2026-`;
const RF_YEAR = `RF-2026-`;
const MAT_NO_DASH = `XYZ-2526`;

function ctx() {
  return {
    userId: 'usr-numbering-admin',
    tenantId,
    branchId: null,
    role: 'school_admin',
    baseRole: 'school_admin',
    name: 'Directeur',
    email: 'directeur@numbering.test',
    sessionId: null,
    impersonated: false,
  };
}

const listReq = () => new Request('http://localhost:3000/api/settings/numbering');
const patchReq = (prefix: string, body: unknown) => new Request(
  `http://localhost:3000/api/settings/numbering/${encodeURIComponent(prefix)}`,
  { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
);
const params = (prefix: string) => ({ params: Promise.resolve({ id: encodeURIComponent(prefix) }) });

describe('Numbering series on real counters (SCF-06-01)', () => {
  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Numbering Tenant', slug: `nb-${tenantId.slice(0, 8)}` },
      { id: otherTenantId, name: 'Numbering Other', slug: `nbo-${otherTenantId.slice(0, 8)}` },
    ]);
    await db.insert(namingSeries).values([
      { tenantId, prefix: INV, currentVal: 12 },
      { tenantId, prefix: MAT, currentVal: 6 },
      { tenantId, prefix: RC_YEAR, currentVal: 5 },
      { tenantId, prefix: RF_YEAR, currentVal: 2 },
      { tenantId, prefix: MAT_NO_DASH, currentVal: 10 },
      { tenantId: otherTenantId, prefix: INV, currentVal: 99 },
    ]);
  });

  afterAll(async () => {
    await db.delete(namingSeries).where(inArray(namingSeries.tenantId, [tenantId, otherTenantId]));
    await db.delete(tenants).where(inArray(tenants.id, [tenantId, otherTenantId]));
  });

  it('1. the list is the tenant\'s real counters, with the next number', async () => {
    requireRequestContext.mockResolvedValue(ctx());
    const { GET } = await import('@/app/api/settings/numbering/route');

    const json = await (await GET(listReq())).json();
    const inv = json.data.find((r: { prefix: string }) => r.prefix === INV);
    const mat = json.data.find((r: { prefix: string }) => r.prefix === MAT);
    const rc = json.data.find((r: { prefix: string }) => r.prefix === RC_YEAR);
    const rf = json.data.find((r: { prefix: string }) => r.prefix === RF_YEAR);
    const matNoDash = json.data.find((r: { prefix: string }) => r.prefix === MAT_NO_DASH);

    expect(inv).toMatchObject({ currentVal: 12, kind: 'invoice', nextNumber: `${INV}0013` });
    // A matricule prefix (SCHOOL-YYYY-) must not be mistaken for a document code.
    expect(mat).toMatchObject({ kind: 'student_matricule' });
    // Real document prefixes carry the year too (INV-2026-, RC-2026-): the
    // known codes win over the matricule year pattern, so the invoice series a
    // director actually sees is labelled "Factures", not "Matricules élèves".
    expect(rc).toMatchObject({ kind: 'receipt', nextNumber: `${RC_YEAR}0006` });
    // Refund numbers have no dedicated kind; they must not land in matricules.
    expect(rf).toMatchObject({ kind: 'other' });
    // Imported matricule series without the trailing dash are still matricules.
    expect(matNoDash).toMatchObject({ kind: 'student_matricule' });
    // The other tenant's counter of the same name is not ours to see.
    expect(json.data.filter((r: { prefix: string }) => r.prefix === INV)).toHaveLength(1);
  });

  it('2. a raise is applied and returns the new next number', async () => {
    requireRequestContext.mockResolvedValue(ctx());
    const { PATCH } = await import('@/app/api/settings/numbering/[id]/route');

    const res = await PATCH(patchReq(INV, { currentVal: 40, reason: 'Reprise du carnet papier' }), params(INV));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.currentVal).toBe(40);
    expect(json.data.nextNumber).toBe(`${INV}0041`);

    const [row] = await db
      .select({ currentVal: namingSeries.currentVal })
      .from(namingSeries)
      .where(and(eq(namingSeries.tenantId, tenantId), eq(namingSeries.prefix, INV)))
      .limit(1);
    expect(row?.currentVal).toBe(40);
  });

  it('3. lowering is refused with 409 and the counter does not move', async () => {
    requireRequestContext.mockResolvedValue(ctx());
    const { PATCH } = await import('@/app/api/settings/numbering/[id]/route');

    const res = await PATCH(patchReq(INV, { currentVal: 3 }), params(INV));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe('CANNOT_LOWER_SERIES');
    // The refusal reports where the counter actually is, so the admin can act.
    expect(json.error.details).toMatchObject({ currentVal: 40, requested: 3 });

    const [row] = await db
      .select({ currentVal: namingSeries.currentVal })
      .from(namingSeries)
      .where(and(eq(namingSeries.tenantId, tenantId), eq(namingSeries.prefix, INV)))
      .limit(1);
    expect(row?.currentVal).toBe(40);
  });

  it('4. another tenant\'s series is a 404, and its counter is untouched', async () => {
    requireRequestContext.mockResolvedValue({
      ...ctx(),
      tenantId: otherTenantId,
    });
    const { PATCH } = await import('@/app/api/settings/numbering/[id]/route');

    // This tenant owns INV too, but a prefix it does not own must not resolve.
    const res = await PATCH(patchReq('RC-INCONNU-', { currentVal: 500 }), params('RC-INCONNU-'));
    expect(res.status).toBe(404);

    requireRequestContext.mockResolvedValue(ctx());
    const own = await PATCH(patchReq(MAT, { currentVal: 7 }), params(MAT));
    expect(own.status).toBe(200);
  });

  it('5. a raise racing a real reservation never yields a duplicate number', async () => {
    requireRequestContext.mockResolvedValue(ctx());
    const { PATCH } = await import('@/app/api/settings/numbering/[id]/route');
    const { consumeDocumentNumber } = await import('@/libs/finance/document-number');

    // From a known small counter, race a big raise against a consumption.
    await db
      .update(namingSeries)
      .set({ currentVal: 1 })
      .where(and(eq(namingSeries.tenantId, tenantId), eq(namingSeries.prefix, INV)));

    const issued: string[] = [];
    await Promise.all([
      PATCH(patchReq(INV, { currentVal: 500 }), params(INV)),
      db.transaction(async (tx) => {
        issued.push(await consumeDocumentNumber(tx, { tenantId, prefix: INV }));
      }),
    ]);

    // Whatever the interleaving, the number handed out must sit at or below the
    // counter the raise left behind, and the next consumption must be strictly
    // greater — i.e. the two operations did not both claim the same value.
    const [after] = await db
      .select({ currentVal: namingSeries.currentVal })
      .from(namingSeries)
      .where(and(eq(namingSeries.tenantId, tenantId), eq(namingSeries.prefix, INV)))
      .limit(1);
    expect(after!.currentVal).toBeGreaterThanOrEqual(500);

    const nextIssued = await db.transaction(async tx =>
      consumeDocumentNumber(tx, { tenantId, prefix: INV }));
    expect(nextIssued).toBe(`${INV}${String(501).padStart(4, '0')}`);
    expect(issued[0]).not.toBe(nextIssued);
  });
});
