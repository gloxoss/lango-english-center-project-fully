// One-shot W2 patcher batch 3 (fee-allocation, fee-allocations lists).
import fs from 'node:fs';
function patch(file, edits) {
  let s = fs.readFileSync(file, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  for (const [o, n] of edits) {
    const oN = o.split('\n').join(nl); const nN = n.split('\n').join(nl);
    if (!s.includes(oN)) { console.error(`MISS ${file}: ${String(o).slice(0, 55)}`); return; }
    s = s.split(oN).join(nN);
  }
  fs.writeFileSync(file, s);
  console.log(`ok ${file}`);
}
const IMP = `import { requireRequestContext, requireTenant } from '@/libs/api/context';`;

// fee-allocations run list: run rows carry branchId (own mode).
patch('src/app/api/finance/fee-allocations/route.ts', [
  [IMP, `${IMP}\nimport { branchWhere } from '@/libs/api/portal-scope';`],
  [`      .leftJoin(user, eq(feeAllocationRuns.runById, user.id))
      .where(eq(feeAllocationRuns.tenantId, tenantId))
      .orderBy(desc(feeAllocationRuns.createdAt));`,
   `      .leftJoin(user, eq(feeAllocationRuns.runById, user.id))
      .where(and(eq(feeAllocationRuns.tenantId, tenantId), branchWhere(context, feeAllocationRuns.branchId)))
      .orderBy(desc(feeAllocationRuns.createdAt));`],
]);

// fee-allocation (per-class assignment preview): assignment joins
// feeStructures (branch carrier) — assert via the loaded assignment.
patch('src/app/api/finance/fee-allocation/route.ts', [
  [IMP, `${IMP}\nimport { branchWhere } from '@/libs/api/portal-scope';`],
  [`      .select({ feeStructureId: feeStructureAssignments.feeStructureId, feeStructureName: feeStructures.name, baseAmount: feeStructures.amount })
      .from(feeStructureAssignments)
      .innerJoin(feeStructures, eq(feeStructureAssignments.feeStructureId, feeStructures.id))
      .where(and(eq(feeStructureAssignments.tenantId, tenantId), eq(feeStructureAssignments.classId, classId)))
      .limit(1);`,
   `      .select({ feeStructureId: feeStructureAssignments.feeStructureId, feeStructureName: feeStructures.name, baseAmount: feeStructures.amount, classBranchId: classes.branchId })
      .from(feeStructureAssignments)
      .innerJoin(feeStructures, eq(feeStructureAssignments.feeStructureId, feeStructures.id))
      .innerJoin(classes, eq(feeStructureAssignments.classId, classes.id))
      .where(and(eq(feeStructureAssignments.tenantId, tenantId), eq(feeStructureAssignments.classId, classId), branchWhere(ctx, classes.branchId)))
      .limit(1);`],
]);
