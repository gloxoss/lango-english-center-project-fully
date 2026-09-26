// One-shot W3 patcher batch 2: issued-document detail routes + issue writes.
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

// Certificates family: the loaded row carries recipientId -> user branch.
for (const [file, varName, loadLine] of [
  ['src/app/api/certificates/issued/[id]/route.ts', 'certificate', null],
  ['src/app/api/certificates/issued/[id]/pdf/route.ts', 'certificate', null],
  ['src/app/api/certificates/issued/[id]/revoke/route.ts', 'certificate', null],
  ['src/app/api/certificates/issued/[id]/replace/route.ts', 'original', null],
]) {
  const s0 = fs.readFileSync(file, 'utf8');
  const nl = s0.includes('\r\n') ? '\r\n' : '\n';
  const edits = [
    [IMP, `${IMP}\nimport { assertBranchScope } from '@/libs/api/portal-scope';\nimport { user } from '@/models/Schema';`],
  ];
  const notFound404 = `    if (!${varName}) {\n      throw new ApiError(404,`;
  if (s0.includes(notFound404)) {
    edits.push([
      notFound404,
      `    assertCertificateCampus(context, ${varName}?.recipientId ?? null);\n    if (!${varName}) {\n      throw new ApiError(404,`,
    ]);
  } else {
    // replace route: loads with a one-line where; insert after its limit line
    const anchor = `eq(issuedCertificates.id, id))).limit(1);`;
    if (!s0.includes(anchor)) { console.error(`MISS(anchor) ${file}`); continue; }
    edits.push([
      anchor,
      `${anchor}\n    assertCertificateCampus(context, ${varName}?.recipientId ?? null);`,
    ]);
  }
  edits.push([`export async function`, `${gate(nl)}\nexport async function`]);
  patch(file, edits);
}

function gate(nl) {
  return [
    `/** Campus lock: an issued certificate follows its recipient's campus. */`,
    `async function assertCertificateCampus(context: RequestContext, recipientId: string | null) {`,
    `  if (!recipientId) return;`,
    `  const [recipient] = await db`,
    `    .select({ branchId: user.branchId })`,
    `    .from(user)`,
    `    .where(eq(user.id, recipientId))`,
    `    .limit(1);`,
    `  assertBranchScope(context, recipient?.branchId ?? null);`,
    `}`,
  ].join(nl);
}
