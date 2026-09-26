// BRANCH-SCOPE waves helper: convert the two exact inline-scoping shapes to
// the branchWhere helper. Narrow by design; anything else is left for manual
// conversion. Usage:
//   node ../scratch/bs-codemod.mjs <file...>          (apply)
//   node ../scratch/bs-codemod.mjs --dry <file...>    (show planned edits)
import fs from 'node:fs';

const args = process.argv.slice(2);
const dry = args[0] === '--dry';
const files = dry ? args.slice(1) : args;

// Shape A: if (context.branchId) { list.push(eq(col, context.branchId)); }
const SHAPE_A = /(\s*)if \((ctx|context)\.branchId\) \{\n\s*([\w.]+)\.push\(eq\(([^,()]+?), \2\.branchId\)\);\n\s*\}/g;
// Shape B: const x = context.branchId ? eq(col, context.branchId) : undefined;
const SHAPE_B = /const (\w+) = (ctx|context)\.branchId \? eq\(([^,()]+?), \2\.branchId\) : undefined;/g;

// Shape C: the exact-null-tolerant detail guard -> assertBranchScope.
//   if (context.branchId && row.branchId && row.branchId !== context.branchId) {
//     throw new ApiError(403, ...);
//   }
const SHAPE_C = /(\s*)if \((ctx|context)\.branchId && (\w+)\.branchId && \3\.branchId !== \2\.branchId\) \{\n\s*throw new ApiError\(403[^;]*\);\n\s*\}/g;

for (const f of files) {
  let src = fs.readFileSync(f, 'utf8');
  const before = src;
  const replacements = [];

  src = src.replace(SHAPE_A, (m, ifIndent, ctxVar, list, col) => {
    replacements.push(`A: ${list}.push(eq(${col}, ${ctxVar}.branchId))`);
    return `${ifIndent}const branchCondition = branchWhere(${ctxVar}, ${col});\n${ifIndent}if (branchCondition) ${list}.push(branchCondition);`;
  });
  src = src.replace(SHAPE_C, (m, ifIndent, ctxVar, row) => {
    replacements.push(`C: assertBranchScope(${ctxVar}, ${row}.branchId)`);
    return `${ifIndent}assertBranchScope(${ctxVar}, ${row}.branchId);`;
  });
  src = src.replace(SHAPE_B, (m, varName, ctxVar, col) => {
    replacements.push(`B: const ${varName} = branchWhere(${ctxVar}, ${col})`);
    return `const ${varName} = branchWhere(${ctxVar}, ${col});`;
  });

  if (src === before) continue;

  if (!/from '@\/libs\/api\/portal-scope'/.test(src)) {
    const need = [];
    if (/branchWhere/.test(src) && src !== before) need.push('branchWhere');
    if (/assertBranchScope\(/.test(src)) need.push('assertBranchScope');
    if (/assertWritableBranch\(/.test(src)) need.push('assertWritableBranch');
    const imp = `import { ${[...new Set(need)].join(', ')} } from '@/libs/api/portal-scope';\n`;
    const contextImp = src.match(/^import .*from '@\/libs\/api\/context';\n/m);
    if (contextImp) {
      src = src.replace(contextImp[0], `${contextImp[0]}${imp}`);
    } else {
      src = src.replace(/^(import [^\n]+\n)/m, `$1${imp}`);
    }
  } else if (src !== before) {
    // Extend the existing portal-scope import with any missing helper names.
    src = src.replace(/import \{([^}]*)\} from '@\/libs\/api\/portal-scope';/, (m, names) => {
      const have = new Set(names.split(',').map(s => s.trim()).filter(Boolean));
      for (const h of ['branchWhere', 'assertBranchScope', 'assertWritableBranch']) {
        if (new RegExp(`\\b${h}\\b`).test(src.replace(m, '')) && !have.has(h)) have.add(h);
      }
      return `import { ${[...have].join(', ')} } from '@/libs/api/portal-scope';`;
    });
  }

  if (dry) {
    console.log(`${f}: ${replacements.join('; ')}`);
  } else {
    fs.writeFileSync(f, src);
    console.log(`${f}: ${replacements.length} replacement(s)`);
  }
}
