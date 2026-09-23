import { eq, and, sql, ilike, inArray } from 'drizzle-orm';
import { db } from '@/libs/DB';
import {
  tenants,
  guardians,
  guardianStudents,
  user,
} from '@/models/Schema';

async function main() {
  console.log('==================================================');
  console.log('FINAL RECONCILIATION DUMP');
  console.log('==================================================\n');

  // 1. Locate Atlas fixture tenant
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(ilike(tenants.name, '%Atlas%'))
    .limit(1);

  if (!tenant) {
    console.error('Atlas tenant not found.');
    process.exit(1);
  }

  const tenantId = tenant.id;

  // 2. Select Tariq Benjelloun or first guardian with relationships
  let [selectedGuardian] = await db
    .select({
      id: guardians.id,
      firstName: guardians.firstName,
      lastName: guardians.lastName,
      phone: guardians.phone,
      email: guardians.email,
    })
    .from(guardians)
    .where(and(eq(guardians.tenantId, tenantId), eq(guardians.id, '299bbbe0-f75e-4c82-b117-3e9e89c56e9f')))
    .limit(1);

  if (!selectedGuardian) {
    [selectedGuardian] = await db
      .select({
        id: guardians.id,
        firstName: guardians.firstName,
        lastName: guardians.lastName,
        phone: guardians.phone,
        email: guardians.email,
      })
      .from(guardians)
      .innerJoin(guardianStudents, eq(guardians.id, guardianStudents.guardianId))
      .where(eq(guardians.tenantId, tenantId))
      .limit(1);
  }

  const guardianId = selectedGuardian!.id;

  // 3. Query all linked students
  const links = await db
    .select({
      linkId: guardianStudents.id,
      studentId: guardianStudents.studentId,
      studentName: user.name,
      studentMatricule: user.matricule,
      relationship: guardianStudents.relationshipType,
      primary: guardianStudents.isPrimaryContact,
      financial: guardianStudents.isFinanciallyResponsible,
      emergency: guardianStudents.isEmergencyContact,
      priority: guardianStudents.emergencyPriority,
      pickup: guardianStudents.canPickup,
      status: guardianStudents.status,
      effectiveFrom: guardianStudents.effectiveFrom,
      effectiveTo: guardianStudents.effectiveTo,
    })
    .from(guardianStudents)
    .innerJoin(user, eq(guardianStudents.studentId, user.id))
    .where(and(eq(guardianStudents.tenantId, tenantId), eq(guardianStudents.guardianId, guardianId)));

  const now = Date.now();
  const isEffective = (status: string, from: string | null, to: string | null) => {
    if (status !== 'active') return false;
    if (from && new Date(from).getTime() > now) return false;
    if (to && new Date(to).getTime() <= now) return false;
    return true;
  };

  const activeLinkedStudents = links.filter(l => l.status === 'active');
  const financialRelationships = links.filter(l => l.financial && isEffective(l.status, l.effectiveFrom, l.effectiveTo));
  const primaryRelationships = links.filter(l => l.primary && isEffective(l.status, l.effectiveFrom, l.effectiveTo));
  const pickupRelationships = links.filter(l => l.pickup && isEffective(l.status, l.effectiveFrom, l.effectiveTo));
  const emergencyRelationships = links.filter(l => l.emergency && isEffective(l.status, l.effectiveFrom, l.effectiveTo));

  // Finance endpoint logic simulation
  const financeEndpointStudentIds = Array.from(new Set(financialRelationships.map(l => l.studentId)));
  const financeSummaryStudentCount = financeEndpointStudentIds.length;

  console.log(`GUARDIAN: ${selectedGuardian!.firstName} ${selectedGuardian!.lastName} (${guardianId})`);
  console.log(`ACTIVE LINKED STUDENTS: ${activeLinkedStudents.length}`);
  console.log(`FINANCIAL RELATIONSHIPS: ${financialRelationships.length}`);
  console.log(`PRIMARY CONTACT RELATIONSHIPS: ${primaryRelationships.length}`);
  console.log(`PICKUP AUTHORIZED RELATIONSHIPS: ${pickupRelationships.length}`);
  console.log(`EMERGENCY CONTACT RELATIONSHIPS: ${emergencyRelationships.length}`);
  console.log(``);
  console.log(`FINANCE ENDPOINT STUDENT IDS: [ ${financeEndpointStudentIds.join(', ')} ]`);
  console.log(`FINANCE SUMMARY STUDENT COUNT: ${financeSummaryStudentCount}`);
  console.log(``);

  // Assertion
  const financialRelationshipCount = financialRelationships.length;
  console.log(`Assert: financialRelationshipCount == financeEndpointStudentCount`);
  if (financialRelationshipCount === financeSummaryStudentCount) {
    console.log(`ASSERTION PASSED: ${financialRelationshipCount} == ${financeSummaryStudentCount}`);
  } else {
    console.error(`ASSERTION FAILED: ${financialRelationshipCount} != ${financeSummaryStudentCount}`);
    process.exit(1);
  }

  console.log(`\n==================================================`);
  console.log(`STUDENT RELATIONSHIPS DETAIL:`);
  console.log(`==================================================`);

  for (const s of links) {
    console.log(`----------------------------------------`);
    console.log(`student: ${s.studentName} (${s.studentMatricule ?? s.studentId})`);
    console.log(`relationship: ${s.relationship}`);
    console.log(`primary: ${s.primary ? 'true' : 'false'}`);
    console.log(`financial: ${s.financial ? 'true' : 'false'}`);
    console.log(`pickup: ${s.pickup ? 'true' : 'false'}`);
    console.log(`emergency: ${s.emergency ? 'true' : 'false'}`);
    console.log(`priority: ${s.priority ?? 'null'}`);
    console.log(`status: ${s.status}`);
    console.log(`effectiveFrom: ${s.effectiveFrom ?? 'null'}`);
    console.log(`effectiveTo: ${s.effectiveTo ?? 'null'}`);
  }

  console.log(`----------------------------------------\n`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
