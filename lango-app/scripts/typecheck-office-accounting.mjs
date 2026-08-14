import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const collect = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const target = path.join(directory, entry.name);
  if (entry.isDirectory()) return collect(target);
  return /\.(?:ts|tsx)$/.test(entry.name) ? [target] : [];
});
const roots = [
  ...collect(path.join(root, 'src/features/accounting')),
  ...collect(path.join(root, 'src/app/api/finance/accounting')),
  ...collect(path.join(root, 'src/app/[locale]/(dashboard)/dashboard/finance/accounting')),
  path.join(root, 'src/app/[locale]/(dashboard)/dashboard/finance/expenses/new/page.tsx'),
  ...collect(path.join(root, 'src/app/api/finance/bank-reconciliation')),
  path.join(root, 'src/features/finance/ui/bank-reconciliation-view.tsx'),
  path.join(root, 'scripts/test-office-accounting-posting.ts'),
  path.join(root, 'scripts/test-office-accounting-workflow.ts'),
];
const configFile = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root, { noEmit: true, incremental: false }, 'tsconfig.json');
const program = ts.createProgram({ rootNames: roots, options: config.options });
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: value => value,
    getCurrentDirectory: () => root,
    getNewLine: () => '\n',
  }));
  process.exitCode = 1;
} else {
  console.log(`PASS Office Accounting scoped typecheck (${roots.length} roots)`);
}
