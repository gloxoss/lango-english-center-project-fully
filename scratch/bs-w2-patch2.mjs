// One-shot W2 patcher batch 2.
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

// 1. fee-allocations/preview: body.branchId must never widen a lock (DB4/DB6).
patch('src/app/api/finance/fee-allocations/preview/route.ts', [
  [IMP, `${IMP}\nimport { assertWritableBranch, branchWhere } from '@/libs/api/portal-scope';`],
  [`    const branchId = body.branchId ?? null;`,
   `    let branchId = body.branchId ?? null;
    if (branchId != null) {
      // A locked caller may only target their own campus; "Tous les sites"
      // must pick a valid active campus of the tenant.
      await assertWritableBranch(context, branchId);
    } else if (context.branchId) {
      branchId = context.branchId;
    }`],
  [`      const rows = await db.select({ id: user.id }).from(user).where(and(...conditions));`,
   `      conditions.push(branchWhere(context, user.branchId));
      const rows = await db.select({ id: user.id }).from(user).where(and(...conditions));`],
]);

// 2. approve/cancel/run: the run row is fully selected — assert right after 404.
for (const [file, marker] of [
  ['src/app/api/finance/fee-allocations/[id]/approve/route.ts', 'APPROVABLE'],
  ['src/app/api/finance/fee-allocations/[id]/cancel/route.ts', null],
  ['src/app/api/finance/fee-allocations/[id]/run/route.ts', null],
]) {
  const s0 = fs.readFileSync(file, 'utf8');
  const nl = s0.includes('\r\n') ? '\r\n' : '\n';
  const edits = [[IMP, `${IMP}\nimport { assertBranchScope } from '@/libs/api/portal-scope';`]];
  const notFound = `    if (!run) {`;
  if (!s0.includes(notFound)) { console.error(`MISS(notFound) ${file}`); continue; }
  edits.push([
    notFound,
    `${notFound}\n      assertBranchScope(context, run.branchId);`,
  ]);
  patch(file, edits);
}

// 3. payments/[id]/reverse: gate on the payment's student before the service.
patch('src/app/api/finance/payments/[id]/reverse/route.ts', [
  [IMP, `${IMP}\nimport { assertStudentBranchScope } from '@/libs/api/portal-scope';\nimport { db } from '@/libs/DB';\nimport { payments } from '@/models/Schema';\nimport { eq } from 'drizzle-orm';\nimport { and } from 'drizzle-orm';`],
  [`    const { id } = await params;
    const body = await parseJson(request, reverseSchema);`,
   `    const { id } = await params;
    const body = await parseJson(request, reverseSchema);

    const [payment] = await db
      .select({ studentId: payments.studentId })
      .from(payments)
      .where(and(eq(payments.id, id), eq(payments.tenantId, tenantId)))
      .limit(1);
    if (!payment || !(await assertStudentBranchScope(context, payment.studentId, tenantId)).exists) {
      throw new ApiError(404, 'NOT_FOUND', 'Paiement introuvable.');
    }`],
]);

// 4. cashier-sessions/[id]/close + reconcile: the session's cashier campus.
for (const file of [
  'src/app/api/finance/cashier-sessions/[id]/close/route.ts',
  'src/app/api/finance/cashier-sessions/[id]/reconcile/route.ts',
]) {
  patch(file, [
    [IMP, `${IMP}\nimport { assertBranchScope } from '@/libs/api/portal-scope';\nimport { db } from '@/libs/DB';\nimport { cashierSessions, user } from '@/models/Schema';\nimport { and, eq } from 'drizzle-orm';`],
    [`    const { id } = await params;`,
     `    const { id } = await params;

    const [sess] = await db
      .select({ branchId: user.branchId })
      .from(cashierSessions)
      .innerJoin(user, eq(cashierSessions.cashierId, user.id))
      .where(and(eq(cashierSessions.id, id), eq(cashierSessions.tenantId, tenantId)))
      .limit(1);
    if (sess) {
      // Shift data follows the cashier's campus (employee mode).
      assertBranchScope(context, sess.branchId);
    }`],
  ]);
}
