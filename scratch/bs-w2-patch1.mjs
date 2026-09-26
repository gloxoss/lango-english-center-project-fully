// One-shot W2 patcher (fee-allocations[id], structure versions, receipts[id]).
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
const IMP_STUDENT = `${IMP}\nimport { assertStudentBranchScope } from '@/libs/api/portal-scope';`;
const IMP_SCOPE = `${IMP}\nimport { assertBranchScope } from '@/libs/api/portal-scope';`;

patch('src/app/api/finance/fee-allocations/[id]/route.ts', [
  [IMP, IMP_SCOPE],
  [`    if (!run) {\n      throw new ApiError(404, 'ALLOCATION_RUN_NOT_FOUND', 'Lancement d\\'allocation introuvable.');\n    }`,
   `    if (!run) {\n      throw new ApiError(404, 'ALLOCATION_RUN_NOT_FOUND', 'Lancement d\\'allocation introuvable.');\n    }\n    assertBranchScope(context, run.branchId);`],
]);

patch('src/app/api/finance/fee-structures/[id]/versions/route.ts', [
  [IMP, IMP_SCOPE],
  [`    const [structure] = await db
      .select({ id: feeStructures.id, name: feeStructures.name })
      .from(feeStructures)
      .where(and(eq(feeStructures.id, id), eq(feeStructures.tenantId, tenantId)))
      .limit(1);
    if (!structure) {
      return NextResponse.json({ success: false, message: 'Structure tarifaire introuvable.' }, { status: 404 });
    }`,
   `    const [structure] = await db
      .select({ id: feeStructures.id, name: feeStructures.name, branchId: feeStructures.branchId })
      .from(feeStructures)
      .where(and(eq(feeStructures.id, id), eq(feeStructures.tenantId, tenantId)))
      .limit(1);
    if (!structure) {
      return NextResponse.json({ success: false, message: 'Structure tarifaire introuvable.' }, { status: 404 });
    }
    assertBranchScope(context, structure.branchId);`],
]);

patch('src/app/api/finance/receipts/[id]/route.ts', [
  [IMP, IMP_SCOPE],
  [`        studentName: user.name,
        studentEmail: user.email,`,
   `        studentName: user.name,
        studentEmail: user.email,
        studentBranchId: user.branchId,`],
]);
