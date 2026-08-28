import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertRelationshipAccess, requireRelationship } from '../relationship-resolver';
import { db } from '@/libs/DB';
import { guardianStudents, guardians, tenants, user } from '@/models/Schema';

// The parent portal's IDOR boundary.
//
// 19 of 20 /api/guardian/** routes are keyed by a client-supplied
// [relationshipId] — attendance, finance, results, documents, homework,
// meetings, medical excuses. Every one of them delegates the authorization
// decision to assertRelationshipAccess, then queries by the auth.studentId it
// returns. So this single function is what stands between a parent and another
// family's child.
//
// Coverage before this file: relationship-resolver.test.ts tested only the two
// PURE helpers (isRelationshipEffective, requireRights). The DB-backed function
// that actually enforces "this relationship belongs to THIS guardian" had no
// test at all, and guardian route-level coverage was 0 of 20.
//
// D-13 was exactly this shape: a parent could read and forge another family's
// attendance-excuse records because no relationship check existed.

const dbReachable = Boolean(process.env.DATABASE_URL);

const tenantA = crypto.randomUUID();
const tenantB = crypto.randomUUID();

const PARENT_A = `USR-PA-${crypto.randomUUID()}`;
const PARENT_B = `USR-PB-${crypto.randomUUID()}`;
const CHILD_A = `USR-CA-${crypto.randomUUID()}`;
const CHILD_B = `USR-CB-${crypto.randomUUID()}`;
const CHILD_INACTIVE = `USR-CI-${crypto.randomUUID()}`;
const PARENT_C = `USR-PC-${crypto.randomUUID()}`; // second guardian in tenant A
const CHILD_C = `USR-CC-${crypto.randomUUID()}`;

let guardianA = '';
let guardianB = '';
let relA = ''; // parent A -> child A, active, all rights
let relB = ''; // parent B -> child B, active  (the foreign relationship)
let relExpired = ''; // parent A -> child A, ended yesterday
let relNoFinance = ''; // parent A -> child A, finance right revoked
let relInactiveChild = ''; // parent A -> inactive child
let guardianC = '';
let relC = ''; // parent C -> child C, SAME tenant as A (the real IDOR case)

describe.skipIf(!dbReachable)('parent portal relationship access (IDOR boundary)', () => {
  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantA, name: 'Tenant A', slug: `ta-${tenantA}` },
      { id: tenantB, name: 'Tenant B', slug: `tb-${tenantB}` },
    ]);

    await db.insert(user).values([
      { id: PARENT_A, tenantId: tenantA, name: 'Parent A', email: `pa-${tenantA}@t.local`, role: 'parent' },
      { id: CHILD_A, tenantId: tenantA, name: 'Child A', email: `ca-${tenantA}@t.local`, role: 'student' },
      { id: CHILD_INACTIVE, tenantId: tenantA, name: 'Child Inactive', email: `ci-${tenantA}@t.local`, role: 'student', userStatus: 'inactive' },
      { id: PARENT_C, tenantId: tenantA, name: 'Parent C', email: `pc-${tenantA}@t.local`, role: 'parent' },
      { id: CHILD_C, tenantId: tenantA, name: 'Child C', email: `cc-${tenantA}@t.local`, role: 'student' },
      { id: PARENT_B, tenantId: tenantB, name: 'Parent B', email: `pb-${tenantB}@t.local`, role: 'parent' },
      { id: CHILD_B, tenantId: tenantB, name: 'Child B', email: `cb-${tenantB}@t.local`, role: 'student' },
    ]);

    const [gA] = await db.insert(guardians).values({
      tenantId: tenantA, userId: PARENT_A, firstName: 'Parent', lastName: 'A',
    }).returning();
    const [gB] = await db.insert(guardians).values({
      tenantId: tenantB, userId: PARENT_B, firstName: 'Parent', lastName: 'B',
    }).returning();
    const [gC] = await db.insert(guardians).values({
      tenantId: tenantA, userId: PARENT_C, firstName: 'Parent', lastName: 'C',
    }).returning();
    guardianA = gA!.id;
    guardianB = gB!.id;
    guardianC = gC!.id;

    const yesterday = new Date(Date.now() - 86_400_000).toISOString();

    const rows = await db.insert(guardianStudents).values([
      { tenantId: tenantA, guardianId: guardianA, studentId: CHILD_A, relationshipType: 'father' },
      { tenantId: tenantB, guardianId: guardianB, studentId: CHILD_B, relationshipType: 'mother' },
      { tenantId: tenantA, guardianId: guardianA, studentId: CHILD_A, relationshipType: 'father', effectiveTo: yesterday },
      { tenantId: tenantA, guardianId: guardianA, studentId: CHILD_A, relationshipType: 'father', canAccessFinance: false },
      { tenantId: tenantA, guardianId: guardianA, studentId: CHILD_INACTIVE, relationshipType: 'father' },
      { tenantId: tenantA, guardianId: guardianC, studentId: CHILD_C, relationshipType: 'mother' },
    ]).returning();

    relA = rows[0]!.id;
    relB = rows[1]!.id;
    relExpired = rows[2]!.id;
    relNoFinance = rows[3]!.id;
    relInactiveChild = rows[4]!.id;
    relC = rows[5]!.id;
  });

  afterAll(async () => {
    for (const t of [tenantA, tenantB]) {
      await db.delete(guardianStudents).where(eq(guardianStudents.tenantId, t));
      await db.delete(guardians).where(eq(guardians.tenantId, t));
      await db.delete(user).where(eq(user.tenantId, t));
      await db.delete(tenants).where(eq(tenants.id, t));
    }
  });

  it('resolves the guardian’s own effective relationship', async () => {
    const auth = await assertRelationshipAccess(tenantA, PARENT_A, relA);
    expect(auth.studentId).toBe(CHILD_A);
    expect(auth.guardianId).toBe(guardianA);
    expect(auth.rights.finance).toBe(true);
  });

  it('refuses another family’s relationship id WITHIN THE SAME TENANT', async () => {
    // This is the real IDOR: parent A and parent C are both in tenant A, so the
    // tenant filter cannot help. Only the guardianId filter can reject this.
    //
    // The first version of this test used parent B's id (tenant B) and passed
    // even with the ownership filter deleted, because the tenant filter alone
    // rejected it — a false green that the inject-and-revert caught.
    await expect(assertRelationshipAccess(tenantA, PARENT_A, relC)).rejects.toMatchObject({ status: 404 });
  });

  it('refuses a cross-tenant relationship id', async () => {
    await expect(assertRelationshipAccess(tenantA, PARENT_A, relB)).rejects.toMatchObject({ status: 404 });
  });

  it('refuses a relationship from another tenant even for its real owner', async () => {
    await expect(assertRelationshipAccess(tenantA, PARENT_B, relB)).rejects.toMatchObject({ status: 404 });
  });

  it('answers 404 rather than 403 so existence cannot be probed', async () => {
    // A 403 on a real-but-foreign id and 404 on a random one would let a caller
    // enumerate which relationship ids exist. Both must look identical.
    const foreign = assertRelationshipAccess(tenantA, PARENT_A, relC);
    const random = assertRelationshipAccess(tenantA, PARENT_A, crypto.randomUUID());
    await expect(foreign).rejects.toMatchObject({ status: 404 });
    await expect(random).rejects.toMatchObject({ status: 404 });
  });

  it('refuses an expired relationship', async () => {
    await expect(assertRelationshipAccess(tenantA, PARENT_A, relExpired)).rejects.toMatchObject({ status: 404 });
  });

  it('refuses access when the child account is inactive', async () => {
    await expect(assertRelationshipAccess(tenantA, PARENT_A, relInactiveChild)).rejects.toMatchObject({ status: 404 });
  });

  it('refuses a non-guardian account', async () => {
    await expect(assertRelationshipAccess(tenantA, CHILD_A, relA)).rejects.toMatchObject({ status: 404 });
  });

  it('403s a granted relationship missing the demanded right', async () => {
    // Distinct from 404: the child IS theirs, the finance right is not.
    await expect(
      requireRelationship({ tenantId: tenantA, userId: PARENT_A }, relNoFinance, { finance: true }),
    ).rejects.toMatchObject({ status: 403 });

    // ...and the same relationship still resolves for a right it does hold.
    const auth = await requireRelationship({ tenantId: tenantA, userId: PARENT_A }, relNoFinance, { attendance: true });
    expect(auth.studentId).toBe(CHILD_A);
  });

  it('refuses a tenantless context', async () => {
    await expect(
      requireRelationship({ tenantId: null, userId: PARENT_A }, relA),
    ).rejects.toMatchObject({ status: 404 });
  });
});
