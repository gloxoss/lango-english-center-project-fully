import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { eq, inArray, like, or } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { db } from '../src/libs/DB';
import {
  account,
  branches,
  guardians,
  guardianStudents,
  session,
  user,
  userPermissionOverrides,
} from '../src/models/Schema';
import {
  guardGates,
  guardPickupAuthorizations,
} from '../src/features/guard/models/guard-schema';
import {
  receptionAppointments,
  receptionHandoffs,
  receptionIdentityVerifications,
} from '../src/features/reception/models/reception-schema';

// Receptionist Portal verification fixtures. Idempotent: clears its own REC- rows
// first, then creates users/relations covering the authz matrix the security sweep
// exercises (default-deny pickup release, user-level override positive path,
// wrong-role 403, two-tenant and wrong-branch isolation).
const ATLAS = 'ca40c88e-339c-4fea-b5c4-51d5c9cc0239';
const LANGO = 'f62f31eb-1fc8-4102-9145-a5ce0bca989b';
const PASS = 'RecepVerify123!';
const now = Date.now();

async function cleanup() {
  // Reception rows reference REC-* users (host_id is NOT NULL with SET NULL on
  // user delete), so remove them first; status history cascades from the parent.
  await db.delete(receptionAppointments).where(or(
    like(receptionAppointments.createdById, 'REC-%'),
    like(receptionAppointments.hostId, 'REC-%'),
  ));
  await db.delete(receptionHandoffs).where(or(
    like(receptionHandoffs.createdById, 'REC-%'),
    like(receptionHandoffs.assignedToId, 'REC-%'),
  ));
  await db.delete(receptionIdentityVerifications).where(like(receptionIdentityVerifications.verifierId, 'REC-%'));

  await db.delete(userPermissionOverrides).where(eq(userPermissionOverrides.userId, 'REC-PICKUP-USER'));
  await db.delete(guardPickupAuthorizations).where(eq(guardPickupAuthorizations.createdById, 'REC-USER'));
  // Guardians get a server-generated UUID id — locate them by their fixture
  // email, then delete links and rows by explicit ids (LIKE is invalid on uuid).
  const seededGuardians = await db
    .select({ id: guardians.id })
    .from(guardians)
    .where(like(guardians.email, 'rec-guard-%'));
  const guardIds = seededGuardians.map((g) => g.id);
  if (guardIds.length > 0) {
    await db.delete(guardianStudents).where(inArray(guardianStudents.guardianId, guardIds));
    await db.delete(guardians).where(inArray(guardians.id, guardIds));
  }
  await db.delete(guardGates).where(eq(guardGates.gateCode, 'REC-GATE'));
  await db.delete(session).where(like(session.userId, 'REC-%'));
  await db.delete(account).where(like(account.userId, 'REC-%'));
  await db.delete(user).where(like(user.id, 'REC-%'));
  await db.delete(branches).where(eq(branches.code, 'REC-BR-A')).catch(() => undefined);
  await db.delete(branches).where(eq(branches.code, 'REC-BR-B')).catch(() => undefined);
}

async function makeUser(id: string, tenantId: string, role: string, name: string, opts: {
  branchId?: string | null;
  phone?: string | null;
  matricule?: string | null;
  className?: string | null;
} = {}) {
  const nowTs = new Date();
  await db.insert(user).values({
    id,
    tenantId,
    role: role as any,
    name,
    email: `${id.toLowerCase()}@placeholder.local`,
    userStatus: 'active',
    branchId: opts.branchId ?? null,
    phone: opts.phone ?? null,
    matricule: opts.matricule ?? null,
    className: opts.className ?? null,
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

async function main() {
  await cleanup();

  // Branches (Atlas) for the wrong-branch isolation probe.
  const [brA] = await db
    .insert(branches)
    .values({ tenantId: ATLAS, name: 'Reception Branch A', code: 'REC-BR-A', city: 'Casa', isDefault: true, isActive: true })
    .returning({ id: branches.id });
  const [brB] = await db
    .insert(branches)
    .values({ tenantId: ATLAS, name: 'Reception Branch B', code: 'REC-BR-B', city: 'Rabat', isDefault: false, isActive: true })
    .returning({ id: branches.id });
  const branchA = brA!.id;
  const branchB = brB!.id;

  // Host (staff) used as appointment host / visitor host / handoff assignee.
  await makeUser('REC-HOST', ATLAS, 'teacher', 'Recep Host', { branchId: branchA, phone: '+212610000001' });

  // Default receptionist (no pickup.release) in branch A.
  await makeUser('REC-USER', ATLAS, 'receptionist', 'Recep Desk', { branchId: branchA, phone: '+212610000002' });
  // Same role, but explicit user-level override grants reception.pickup.release.
  await makeUser('REC-PICKUP-USER', ATLAS, 'receptionist', 'Recep Pickup Ops', { branchId: branchA, phone: '+212610000003' });
  await db.insert(userPermissionOverrides).values({
    id: randomUUID(),
    tenantId: ATLAS,
    userId: 'REC-PICKUP-USER',
    permissionId: 'reception.pickup.release',
    granted: true,
  });
  // Second default receptionist in branch B (wrong-branch probe).
  await makeUser('REC-USER-B', ATLAS, 'receptionist', 'Recep Desk B', { branchId: branchB, phone: '+212610000004' });
  // Wrong-role probe: teacher hitting reception routes → 403.
  await makeUser('REC-TEACHER', ATLAS, 'teacher', 'Recep Probe Teacher', { branchId: branchA });
  // Cross-tenant receptionist (Lango) → must never see Atlas rows.
  await makeUser('REC-LANGO-USER', LANGO, 'receptionist', 'Recep Lango Desk', { phone: '+212610000005' });

  // Student with a linked guardian + an active pickup authorization.
  await makeUser('REC-STU-A', ATLAS, 'student', 'Reception Child A', { branchId: branchA, matricule: 'REC-001', className: 'CE1', phone: '+212610000010' });
  await makeUser('REC-STU-LANGO', LANGO, 'student', 'Reception Lango Child', { matricule: 'REC-LANGO-01', className: 'CE1' });

  const [guard] = await db
    .insert(guardians)
    .values({ tenantId: ATLAS, userId: null, firstName: 'Recep', lastName: 'Guardian', email: 'rec-guard@placeholder.local', phone: '+212610000006' })
    .returning({ id: guardians.id });
  const guardId = guard!.id;
  await db.insert(guardianStudents).values({
    tenantId: ATLAS,
    guardianId: guardId,
    studentId: 'REC-STU-A',
    relationshipType: 'Mère',
    isPrimaryContact: true,
    isEmergencyContact: true,
    canPickup: true,
    hasPickupAuthority: true,
    status: 'active',
  });

  // A second, unlinked guardian — create-authorization against it must 422.
  const [unlinked] = await db
    .insert(guardians)
    .values({ tenantId: ATLAS, userId: null, firstName: 'Recep', lastName: 'Unlinked', email: 'rec-guard-unlinked@placeholder.local', phone: '+212610000007' })
    .returning({ id: guardians.id });
  const unlinkedId = unlinked!.id;

  // Gate used for visitor check-in/out and release.
  const [gate] = await db
    .insert(guardGates)
    .values({ tenantId: ATLAS, branchId: branchA, gateCode: 'REC-GATE', gateName: 'Reception Gate', direction: 'both', isActive: true })
    .returning({ id: guardGates.id });
  const gateId = gate!.id;

  // One active pickup authorization (valid window around now).
  const [auth] = await db
    .insert(guardPickupAuthorizations)
    .values({
      tenantId: ATLAS,
      studentId: 'REC-STU-A',
      pickupPersonId: guardId,
      relationshipType: 'Mère',
      authorizedFrom: new Date(now - 3600_000).toISOString(),
      authorizedUntil: new Date(now + 24 * 3600_000).toISOString(),
      reason: 'Fixture reception verify',
      status: 'active',
      createdById: 'REC-USER',
    })
    .returning({ id: guardPickupAuthorizations.id });
  const authId = auth!.id;

  console.log('Reception fixtures seeded:', {
    branchA,
    branchB,
    host: 'REC-HOST',
    desk: 'REC-USER',
    pickupOps: 'REC-PICKUP-USER',
    deskB: 'REC-USER-B',
    teacher: 'REC-TEACHER',
    lango: 'REC-LANGO-USER',
    student: 'REC-STU-A',
    langoStudent: 'REC-STU-LANGO',
    guardian: guardId,
    unlinkedGuardian: unlinkedId,
    gate: gateId,
    authorization: authId,
    password: PASS,
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error('SEED ERROR:'); console.error(e); process.exit(1); });
