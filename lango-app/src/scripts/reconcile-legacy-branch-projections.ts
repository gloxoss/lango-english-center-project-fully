import { db } from '@/libs/DB';
import { classes, classSections, studentPlacements, user } from '@/models/Schema';
import { and, eq } from 'drizzle-orm';

interface DiscrepancyReport {
  nullBranchWithSection: {
    studentId: string;
    studentName: string;
    classSectionId: string;
    resolvedBranchId: string | null;
    isResolvable: boolean;
  }[];
  branchMismatch: {
    studentId: string;
    studentName: string;
    userBranchId: string;
    sectionBranchId: string | null;
    currentPlacementSectionId: string | null;
    isAmbiguous: boolean;
  }[];
  placementSectionMismatch: {
    studentId: string;
    studentName: string;
    userClassSectionId: string | null;
    currentPlacementSectionId: string | null;
  }[];
}

export async function auditAndRemediateProjections(
  tenantId: string,
  options: { apply: boolean } = { apply: false },
) {
  console.log('================================================================');
  console.log(`LEGACY PROJECTION AUDIT & REMEDIATION REPORT`);
  console.log(`Tenant ID: ${tenantId}`);
  console.log(`Mode: ${options.apply ? 'APPLY (Mutations Enabled)' : 'DRY-RUN (Read-Only)'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('================================================================\n');

  // Fetch all active students in tenant
  const students = await db
    .select({
      id: user.id,
      name: user.name,
      matricule: user.matricule,
      branchId: user.branchId,
      classSectionId: user.classSectionId,
    })
    .from(user)
    .where(
      and(
        eq(user.tenantId, tenantId),
        eq(user.role, 'student'),
        eq(user.userStatus, 'active'),
      ),
    );

  // Fetch all class sections with class branch info
  const sectionsWithBranch = await db
    .select({
      sectionId: classSections.id,
      classId: classSections.classId,
      branchId: classes.branchId,
    })
    .from(classSections)
    .innerJoin(classes, eq(classSections.classId, classes.id))
    .where(eq(classSections.tenantId, tenantId));

  const sectionBranchMap = new Map<string, string | null>();
  for (const s of sectionsWithBranch) {
    sectionBranchMap.set(s.sectionId, s.branchId ?? null);
  }

  // Fetch all current placements
  const currentPlacements = await db
    .select({
      id: studentPlacements.id,
      studentId: studentPlacements.studentId,
      classSectionId: studentPlacements.classSectionId,
    })
    .from(studentPlacements)
    .where(
      and(
        eq(studentPlacements.tenantId, tenantId),
        eq(studentPlacements.isCurrent, true),
      ),
    );

  const placementMap = new Map<string, string>();
  for (const p of currentPlacements) {
    placementMap.set(p.studentId, p.classSectionId);
  }

  const report: DiscrepancyReport = {
    nullBranchWithSection: [],
    branchMismatch: [],
    placementSectionMismatch: [],
  };

  for (const s of students) {
    const curPlacementSecId = placementMap.get(s.id) ?? null;

    // Check 1: classSectionId but null branchId
    if (s.classSectionId && !s.branchId) {
      const resolvedBranch = sectionBranchMap.get(s.classSectionId) ?? null;
      report.nullBranchWithSection.push({
        studentId: s.id,
        studentName: s.name,
        classSectionId: s.classSectionId,
        resolvedBranchId: resolvedBranch,
        isResolvable: resolvedBranch !== null,
      });
    }

    // Check 2: user.branchId != section.class.branchId
    if (s.classSectionId && s.branchId) {
      const secBranch = sectionBranchMap.get(s.classSectionId) ?? null;
      if (secBranch && s.branchId !== secBranch) {
        report.branchMismatch.push({
          studentId: s.id,
          studentName: s.name,
          userBranchId: s.branchId,
          sectionBranchId: secBranch,
          currentPlacementSectionId: curPlacementSecId,
          isAmbiguous: true, // Requires explicit decision: does student belong to branch or section?
        });
      }
    }

    // Check 3: user.classSectionId != currentPlacement.classSectionId
    if ((s.classSectionId ?? null) !== curPlacementSecId) {
      report.placementSectionMismatch.push({
        studentId: s.id,
        studentName: s.name,
        userClassSectionId: s.classSectionId,
        currentPlacementSectionId: curPlacementSecId,
      });
    }
  }

  console.log(`[READ-ONLY DISCREPANCY AUDIT]`);
  console.log(`- Students with section but null branchId: ${report.nullBranchWithSection.length}`);
  for (const r of report.nullBranchWithSection) {
    console.log(`  * ${r.studentName} (${r.studentId}): section=${r.classSectionId} -> resolvedBranch=${r.resolvedBranchId} (resolvable: ${r.isResolvable})`);
  }

  console.log(`- Students with branch mismatch (user.branchId != section.branchId): ${report.branchMismatch.length}`);
  for (const r of report.branchMismatch) {
    console.log(`  * ${r.studentName} (${r.studentId}): userBranch=${r.userBranchId} vs sectionBranch=${r.sectionBranchId} (ambiguous: ${r.isAmbiguous})`);
  }

  console.log(`- Students with placement section mismatch (user.classSectionId != placement.classSectionId): ${report.placementSectionMismatch.length}`);
  for (const r of report.placementSectionMismatch) {
    console.log(`  * ${r.studentName} (${r.studentId}): userSection=${r.userClassSectionId} vs placementSection=${r.currentPlacementSectionId}`);
  }

  const rowsDetected = report.nullBranchWithSection.length + report.branchMismatch.length + report.placementSectionMismatch.length;
  let rowsRepaired = 0;
  let ambiguousRows = 0;

  // Remediate only provably resolvable rows
  if (options.apply) {
    console.log('\n[APPLYING IDEMPOTENT REMEDIATIONS]');
    for (const item of report.nullBranchWithSection) {
      if (item.isResolvable && item.resolvedBranchId) {
        await db
          .update(user)
          .set({ branchId: item.resolvedBranchId })
          .where(
            and(
              eq(user.id, item.studentId),
              eq(user.tenantId, tenantId),
              eq(user.classSectionId, item.classSectionId), // Guard against concurrent modification
            ),
          );
        console.log(`  ✅ REPAIRED: ${item.studentName} (${item.studentId}) -> branchId set to ${item.resolvedBranchId}`);
        rowsRepaired++;
      } else {
        console.log(`  ⚠️ SKIPPED (Unresolvable): ${item.studentName} (${item.studentId})`);
        ambiguousRows++;
      }
    }

    // Branch mismatches: leave ambiguous rows untouched as per specification
    for (const item of report.branchMismatch) {
      console.log(`  ⚠️ SKIPPED (Ambiguous branch conflict left untouched): ${item.studentName} (${item.studentId})`);
      ambiguousRows++;
    }
  } else {
    ambiguousRows = report.branchMismatch.length + report.nullBranchWithSection.filter(x => !x.isResolvable).length;
    rowsRepaired = report.nullBranchWithSection.filter(x => x.isResolvable).length;
  }

  console.log('\n================================================================');
  console.log(`REMEDIATION SUMMARY`);
  console.log(`- Total Discrepant Rows Detected: ${rowsDetected}`);
  console.log(`- Provably Resolvable Rows Repaired: ${options.apply ? rowsRepaired : `${rowsRepaired} (pending apply)`}`);
  console.log(`- Ambiguous / Conflicting Rows Untouched: ${ambiguousRows}`);
  console.log('================================================================\n');

  return {
    rowsDetected,
    rowsRepaired: options.apply ? rowsRepaired : 0,
    ambiguousRows,
  };
}

async function main() {
  const tenantId = process.env.TENANT_ID || '06ab27c5-7862-4e07-93af-49ef1935bfe6';
  const apply = process.argv.includes('--apply');
  await auditAndRemediateProjections(tenantId, { apply });
  process.exit(0);
}

if (process.argv[1]?.includes('reconcile-legacy-branch-projections')) {
  main().catch((err) => {
    console.error('Remediation error:', err);
    process.exit(1);
  });
}
