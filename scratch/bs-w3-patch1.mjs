// One-shot W3 patcher batch: question-id route + homework family.
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
const CAMPUS_SNIPPET = (idExpr) => [
  `  // Campus lock: campus of the class behind the exam's subject.`,
  `  const [campus] = await db`,
  `    .select({ branchId: classes.branchId })`,
  `    .from(classSubjects)`,
  `    .innerJoin(classes, eq(classSubjects.classId, classes.id))`,
  `    .where(eq(classSubjects.id, ${idExpr}))`,
  `    .limit(1);`,
  `  assertBranchScope(ctx, campus?.branchId ?? null);`,
].join('\n');

// 1. questions/[questionId]: gate in resolveQuestion.
patch('src/app/api/academics/online-exams/[examId]/questions/[questionId]/route.ts', [
  [IMP, `${IMP}\nimport { assertBranchScope } from '@/libs/api/portal-scope';\nimport { classes, classSubjects } from '@/models/Schema';`],
  [`    .select({ id: onlineExams.id, createdById: onlineExams.createdById })`,
   `    .select({ id: onlineExams.id, createdById: onlineExams.createdById, classSubjectId: onlineExams.classSubjectId })`],
  [`  if (!exam) {
    throw new ApiError(404, 'EXAM_NOT_FOUND', 'Examen introuvable.');
  }`,
   `  if (!exam) {
    throw new ApiError(404, 'EXAM_NOT_FOUND', 'Examen introuvable.');
  }
${CAMPUS_SNIPPET('exam.classSubjectId')}`],
]);

// 2. homework/[id]: staff GET/PUT/DELETE gate via the definition's class.
patch('src/app/api/academics/homework/[id]/route.ts', [
  [IMP, `${IMP}\nimport { assertBranchScope } from '@/libs/api/portal-scope';\nimport { assessmentDefinitions, classes, classSubjects } from '@/features/assessment/models/assessment-schema';\nimport { eq } from 'drizzle-orm';\nimport { and } from 'drizzle-orm';\nimport { db } from '@/libs/DB';`],
  [`    const homework = await HomeworkService.getHomeworkById(tenantId, id);`,
   `    await assertHomeworkCampus(context, tenantId, id);
    const homework = await HomeworkService.getHomeworkById(tenantId, id);`],
]);

// 3. homework/[id]/attempts + /grade: same gate before the service call.
for (const [file, marker] of [
  ['src/app/api/academics/homework/[id]/attempts/route.ts', 'listHomeworkAttempts'],
  ['src/app/api/academics/homework/[id]/grade/route.ts', 'gradeHomeworkAttempt'],
]) {
  patch(file, [
    [IMP, `${IMP}\nimport { assertBranchScope } from '@/libs/api/portal-scope';\nimport { assessmentDefinitions, classes, classSubjects } from '@/features/assessment/models/assessment-schema';\nimport { eq } from 'drizzle-orm';\nimport { and } from 'drizzle-orm';\nimport { db } from '@/libs/DB';`],
    [`    const attempts = await HomeworkService.listHomeworkAttempts(tenantId, id);`,
     `    await assertHomeworkCampus(context, tenantId, id);\n    const attempts = await HomeworkService.listHomeworkAttempts(tenantId, id);`],
    [`    const graded = await HomeworkService.gradeHomeworkAttempt({`,
     `    await assertHomeworkCampus(context, tenantId, id);\n    const graded = await HomeworkService.gradeHomeworkAttempt({`],
  ]);
}

// Shared gate helper appended to each route file (kept local so test mocks of
// the service module keep working).
function appendGate(file) {
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes('async function assertHomeworkCampus')) return;
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  const gate = [
    '',
    `/** Campus lock: homework lives on the campus of the class behind its subject. */`,
    `async function assertHomeworkCampus(context: RequestContext, tenantId: string, homeworkId: string) {`,
    `  const [campus] = await db`,
    `    .select({ branchId: classes.branchId })`,
    `    .from(assessmentDefinitions)`,
    `    .leftJoin(classSubjects, eq(assessmentDefinitions.classSubjectId, classSubjects.id))`,
    `    .leftJoin(classes, eq(classSubjects.classId, classes.id))`,
    `    .where(and(eq(assessmentDefinitions.id, homeworkId), eq(assessmentDefinitions.tenantId, tenantId)))`,
    `    .limit(1);`,
    `  assertBranchScope(context, campus?.branchId ?? null);`,
    `}`,
    '',
  ].join(nl);
  s = s.replace(/\nexport /, `${gate}\nexport `);
  if (!s.includes('async function assertHomeworkCampus')) { console.error(`GATE-NOT-ADDED ${file}`); return; }
  if (!/type RequestContext|RequestContext\s*\}/.test(s)) {
    s = s.replace(`} from '@/libs/api/context';`, `, type RequestContext } from '@/libs/api/context';`);
  }
  fs.writeFileSync(file, s);
  console.log(`gate ${file}`);
}
for (const f of [
  'src/app/api/academics/homework/[id]/route.ts',
  'src/app/api/academics/homework/[id]/attempts/route.ts',
  'src/app/api/academics/homework/[id]/grade/route.ts',
]) appendGate(f);
