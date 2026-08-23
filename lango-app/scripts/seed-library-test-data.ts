import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { desc, eq, like } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { db } from '../src/libs/DB';
import {
  account,
  addonEntitlements,
  branches,
  session,
  tenants,
  user,
} from '../src/models/Schema';
import {
  libraryBibliographicRecords,
  libraryCharges,
  libraryCopies,
  libraryEditions,
  libraryMembers,
} from '../src/features/library/models/library-schema';

// Library Management adversarial-verifier fixtures. Idempotent: clears its own
// LIB-*/LIBVER rows first, then provisions two tenants worth of accounts the
// HTTP harness (scripts/verify-library-adversarial.mjs) exercises:
//   - Atlas librarian + teacher (wrong-role 403, capability matrix)
//   - a tenant-scoped super_admin (platform super_admin has tenantId null and is
//     rejected by requireTenant, so the matrix's "super_admin passes" needs this)
//   - a second tenant (B) with a library member/copy/charge for cross-tenant 404
//     and positive waive probes.
// The Atlas tenant keeps an existing branch for branchId; a fallback branch is
// created only when Atlas has none. Atlas is resolved by slug so the fixture
// works across environments (the tenant UUID differs per local seed).
const TENANT_B = '7a4b1c2d-3333-4333-8333-333333333333';
const PASS = 'LibrVerify123!';
let ATLAS = '';

async function cleanup() {
  // Atlas users: sessions/accounts first, then the users themselves.
  await db.delete(session).where(like(session.userId, 'LIB-%'));
  await db.delete(account).where(like(account.userId, 'LIB-%'));
  // Charges before members: a waived fixture charge references LIB-B-SUPER.
  await db.delete(libraryCharges).where(eq(libraryCharges.tenantId, TENANT_B));
  await db.delete(libraryMembers).where(eq(libraryMembers.tenantId, TENANT_B));
  await db.delete(libraryCopies).where(eq(libraryCopies.tenantId, TENANT_B));
  await db.delete(libraryEditions).where(eq(libraryEditions.tenantId, TENANT_B));
  await db.delete(libraryBibliographicRecords).where(eq(libraryBibliographicRecords.tenantId, TENANT_B));
  await db.delete(user).where(like(user.id, 'LIB-%'));
  await db.delete(branches).where(eq(branches.tenantId, TENANT_B));
  await db.delete(tenants).where(eq(tenants.id, TENANT_B));
  await db.delete(branches).where(eq(branches.code, 'LIB-ATL')).catch(() => undefined);
}

async function makeUser(id: string, tenantId: string, role: string, name: string, opts: { branchId?: string | null } = {}) {
  const nowTs = new Date();
  await db.insert(user).values({
    id,
    tenantId,
    role: role as never,
    name,
    email: `${id.toLowerCase()}@placeholder.local`,
    userStatus: 'active',
    branchId: opts.branchId ?? null,
  });
  await db.insert(account).values({
    id: `credential-${id.toLowerCase()}`,
    accountId: id,
    providerId: 'credential',
    userId: id,
    password: await hashPassword(PASS),
    createdAt: nowTs,
    updatedAt: nowTs,
  });
}

async function upsertAddon(tenantId: string) {
  await db.insert(addonEntitlements).values({ tenantId, addonId: 'library', isEnabled: true })
    .onConflictDoUpdate({ target: [addonEntitlements.tenantId, addonEntitlements.addonId], set: { isEnabled: true, updatedAt: new Date().toISOString() } });
}

async function main() {
  await cleanup();

  const [atlasTenant] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, 'atlas')).limit(1);
  if (!atlasTenant) throw new Error('Atlas tenant not found (slug=atlas). Run the base seed (src/scripts/seed.ts) first.');
  ATLAS = atlasTenant.id;

  // Atlas default branch (fallback only when none exists).
  let [atlasBranch] = await db.select({ id: branches.id }).from(branches)
    .where(eq(branches.tenantId, ATLAS)).orderBy(desc(branches.isDefault)).limit(1);
  if (!atlasBranch) {
    const [created] = await db.insert(branches)
      .values({ tenantId: ATLAS, name: 'Library Verify Branch', code: 'LIB-ATL', city: 'Casa', isDefault: false, isActive: true })
      .returning({ id: branches.id });
    atlasBranch = created!;
  }

  await upsertAddon(ATLAS);
  await makeUser('LIB-LIBRARIAN', ATLAS, 'librarian', 'Lib Verify Librarian', { branchId: atlasBranch.id });
  await makeUser('LIB-TEACHER', ATLAS, 'teacher', 'Lib Verify Teacher', { branchId: atlasBranch.id });
  // Atlas member (the teacher): gives the harness a real Atlas memberId for the
  // reverse cross-tenant 404 probe.
  await db.insert(libraryMembers).values({ tenantId: ATLAS, userId: 'LIB-TEACHER', memberNumber: 'LIB-ATL-0001', branchId: atlasBranch.id }).returning({ id: libraryMembers.id });
  const [atlasMember] = await db.select({ id: libraryMembers.id }).from(libraryMembers).where(eq(libraryMembers.userId, 'LIB-TEACHER')).limit(1);

  // Tenant B with a library branch + data for cross-tenant / positive probes.
  await db.insert(tenants).values({ id: TENANT_B, name: 'Library Verify Tenant B', slug: 'lib-verify-b' }).returning({ id: tenants.id });
  const [bBranch] = await db.insert(branches)
    .values({ tenantId: TENANT_B, name: 'Library Verify Branch B', code: 'LIB-B', city: 'Rabat', isDefault: true, isActive: true })
    .returning({ id: branches.id });
  const branchB = bBranch!.id;
  await upsertAddon(TENANT_B);
  await makeUser('LIB-B-SUPER', TENANT_B, 'super_admin', 'Lib B Super Admin', { branchId: branchB });
  await makeUser('LIB-B-LIBRARIAN', TENANT_B, 'librarian', 'Lib B Librarian', { branchId: branchB });
  await makeUser('LIB-B-STUDENT', TENANT_B, 'student', 'Lib B Student', { branchId: branchB });

  const [rec] = await db.insert(libraryBibliographicRecords)
    .values({ tenantId: TENANT_B, title: 'Library Verify Manual', language: 'fr', publicationYear: 2024 })
    .returning({ id: libraryBibliographicRecords.id });
  const [edition] = await db.insert(libraryEditions)
    .values({ tenantId: TENANT_B, recordId: rec!.id, isbn13: '9780000000001', format: 'paperback' })
    .returning({ id: libraryEditions.id });
  const [copy] = await db.insert(libraryCopies)
    .values({ tenantId: TENANT_B, editionId: edition!.id, branchId: branchB, accessionNumber: 'LIBVER-0001', barcode: 'LV-0001', condition: 'good' })
    .returning({ id: libraryCopies.id });
  const [member] = await db.insert(libraryMembers)
    .values({ tenantId: TENANT_B, userId: 'LIB-B-STUDENT', memberNumber: 'LIBVER-0001', branchId: branchB })
    .returning({ id: libraryMembers.id });
  const [charge] = await db.insert(libraryCharges)
    .values({ tenantId: TENANT_B, memberId: member!.id, amount: '12.50', reason: 'damage', dedupeKey: 'lib-verify-charge' })
    .returning({ id: libraryCharges.id });

  console.log('Library verify fixtures seeded:', {
    atlasBranch: atlasBranch.id,
    atlasMember: atlasMember!.id,
    librarian: 'LIB-LIBRARIAN',
    teacher: 'LIB-TEACHER',
    tenantB: TENANT_B,
    branchB,
    superAdmin: 'LIB-B-SUPER',
    bLibrarian: 'LIB-B-LIBRARIAN',
    student: 'LIB-B-STUDENT',
    member: member!.id,
    copy: copy!.id,
    charge: charge!.id,
    password: PASS,
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error('SEED ERROR:'); console.error(e); process.exit(1); });
