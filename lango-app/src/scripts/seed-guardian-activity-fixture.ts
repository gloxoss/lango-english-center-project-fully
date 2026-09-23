import { eq, and, ilike } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { tenants, guardians, guardianStudents, user, auditLogs } from '@/models/Schema';

async function main() {
  console.log('Seeding isolated deterministic activity event for Tariq Benjelloun...');

  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(ilike(tenants.name, '%Atlas%'))
    .limit(1);

  if (!tenant) {
    console.error('Atlas tenant not found.');
    process.exit(1);
  }

  const [admin] = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(eq(user.email, 'y.elamrani@atlas.ma'))
    .limit(1);

  const [guardian] = await db
    .select({ id: guardians.id, firstName: guardians.firstName, lastName: guardians.lastName })
    .from(guardians)
    .where(and(eq(guardians.tenantId, tenant.id), eq(guardians.id, '299bbbe0-f75e-4c82-b117-3e9e89c56e9f')))
    .limit(1);

  if (!guardian) {
    console.error('Tariq Benjelloun not found.');
    process.exit(1);
  }

  const [link] = await db
    .select({
      id: guardianStudents.id,
      studentId: guardianStudents.studentId,
      canPickup: guardianStudents.canPickup,
      studentName: user.name,
    })
    .from(guardianStudents)
    .innerJoin(user, eq(guardianStudents.studentId, user.id))
    .where(and(eq(guardianStudents.guardianId, guardian.id), eq(guardianStudents.tenantId, tenant.id)))
    .limit(1);

  if (!link) {
    console.error('No linked student found for Tariq.');
    process.exit(1);
  }

  console.log(`Found link: ${link.id} for student ${link.studentName}`);

  // Update link canPickup to true
  await db
    .update(guardianStudents)
    .set({ canPickup: true })
    .where(eq(guardianStudents.id, link.id));

  // Insert deterministic audit log entry
  const [createdAudit] = await db
    .insert(auditLogs)
    .values({
      tenantId: tenant.id,
      entityType: 'guardian_student',
      entityId: link.id,
      action: 'update',
      actorId: admin?.id ?? 'usr_admin_atlas',
      metadata: {
        patch: { canPickup: true },
        old: { canPickup: false },
        studentName: link.studentName,
      },
    })
    .returning();

  console.log('Successfully recorded real audit event:', createdAudit?.id);
  console.log('Action: update, Entity: guardian_student, Actor:', admin?.name ?? 'System');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
