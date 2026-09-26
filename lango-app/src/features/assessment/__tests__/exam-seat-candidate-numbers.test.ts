import { randomUUID } from 'node:crypto';
import { and, eq, inArray, like } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ExamMasterService } from '@/features/assessment/services/exam-master-service';
import { db } from '@/libs/DB';
import { examHalls, examSeats, examTerms, namingSeries, tenants } from '@/models/Schema';

/**
 * SCF-06-02. Candidate numbers used to be built as `CAND-{year}-{index}` from
 * the position in the current plan, so two allocation runs in the same year
 * restarted at 0001 and two different students could share a candidate number.
 * They now come from `consumeDocumentNumber`, the same locked counter every
 * other numbering consumer uses.
 */

const tenantId = randomUUID();
const termId = randomUUID();
const hallIds = [randomUUID(), randomUUID()];
const CAND_PREFIX = `CAND-${new Date().getFullYear()}-`;

describe('Candidate numbers come from the CAND- sequence (SCF-06-02)', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'CAND Tenant', slug: `cand-${tenantId.slice(0, 8)}` });
    await db.insert(examTerms).values({
      id: termId,
      tenantId,
      name: 'Terme CAND',
      code: `CAND-${termId.slice(0, 6)}`,
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    });
    await db.insert(examHalls).values([
      { id: hallIds[0]!, tenantId, name: 'Salle A', code: 'SA', capacity: 2 },
      { id: hallIds[1]!, tenantId, name: 'Salle B', code: 'SB', capacity: 2 },
    ]);
  });

  afterAll(async () => {
    await db.delete(examSeats).where(and(eq(examSeats.tenantId, tenantId)));
    await db.delete(examHalls).where(and(eq(examHalls.tenantId, tenantId)));
    await db.delete(examTerms).where(eq(examTerms.id, termId));
    await db.delete(namingSeries).where(and(eq(namingSeries.tenantId, tenantId), like(namingSeries.prefix, 'CAND-%')));
    await db.delete(tenants).where(inArray(tenants.id, [tenantId]));
  });

  it('two allocation runs in the same year never reuse a candidate number', async () => {
    const run = () => ExamMasterService.generateSeatAllocations({
      tenantId,
      examTermId: termId,
      studentIds: ['S-1', 'S-2', 'S-3'],
      examHallIds: hallIds,
    });

    const first = await run();
    const firstNumbers = first.seats.map(s => s.candidateNumber);

    // Rebuilding the plan (the same action, run again) must continue the
    // sequence, not restart it.
    const second = await run();
    const secondNumbers = second.seats.map(s => s.candidateNumber);

    for (const number of [...firstNumbers, ...secondNumbers]) {
      expect(number).toMatch(/^CAND-\d{4}-\d{4}$/);
    }

    const overlap = firstNumbers.filter(n => secondNumbers.includes(n));
    expect(overlap).toEqual([]);

    // And the DB agrees: no two seats share a candidate number.
    const all = await db
      .select({ candidateNumber: examSeats.candidateNumber })
      .from(examSeats)
      .where(and(eq(examSeats.tenantId, tenantId), eq(examSeats.examTermId, termId)));
    expect(new Set(all.map(r => r.candidateNumber)).size).toBe(all.length);

    // The counter kept moving across runs.
    const [inv] = await db
      .select({ currentVal: namingSeries.currentVal })
      .from(namingSeries)
      .where(and(eq(namingSeries.tenantId, tenantId), eq(namingSeries.prefix, CAND_PREFIX)))
      .limit(1);
    expect(inv?.currentVal).toBeGreaterThanOrEqual(6);
  });
});
