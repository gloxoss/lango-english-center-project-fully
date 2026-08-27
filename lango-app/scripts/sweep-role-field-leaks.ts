import fs from 'node:fs';
import path from 'node:path';

const API_DIR = path.join(process.cwd(), 'src', 'app', 'api');

function findRouteFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findRouteFiles(full));
    } else if (entry.name === 'route.ts') {
      results.push(full);
    }
  }
  return results;
}

const routes = findRouteFiles(API_DIR);

type RouteReport = {
  rel: string;
  hasNoAllowlist: boolean;
  allowedRoles: string[];
  mentionsPii: string[];
  mentionsFinance: string[];
  mentionsHr: string[];
  hasRoleCondition: boolean;
  content: string;
};

const reports: RouteReport[] = [];

for (const file of routes) {
  const content = fs.readFileSync(file, 'utf-8');
  const rel = path.relative(API_DIR, file).replace(/\\/g, '/');

  // Match requireRequestContext
  const match = content.match(/requireRequestContext\s*\(\s*(?:request|req)(?:\s*,\s*\[([^\]]*)\])?/);
  if (!match) continue;

  const rawRoles = match[1];
  const hasNoAllowlist = !rawRoles;
  const allowedRoles = rawRoles
    ? rawRoles
        .split(',')
        .map(r => r.trim().replace(/['"]/g, ''))
        .filter(Boolean)
    : [];

  const isMultiRole = hasNoAllowlist || allowedRoles.length > 1;
  if (!isMultiRole) continue;

  const mentionsPii: string[] = [];
  if (/\b(?:nationalId|bloodGroup|renderDataSnapshot|publicTokenHash|verificationTokenHash|medicalNotes)\b/.test(content)) {
    mentionsPii.push('PII/Token');
  }

  const mentionsFinance: string[] = [];
  if (/\b(?:balanceDue|payments|invoices|netAmount|totalPaid|amountDue|feeAllocations|salaryAmount|netSalary)\b/.test(content)) {
    mentionsFinance.push('Finance');
  }

  const mentionsHr: string[] = [];
  if (/\b(?:basicSalary|bankAccountNumber|hourlyRate|grossSalary)\b/.test(content)) {
    mentionsHr.push('HR/Payroll');
  }

  const hasRoleCondition = /\b(?:context\.role|role\s*===|role\s*!==|effectiveRole)\b/.test(content);

  reports.push({
    rel,
    hasNoAllowlist,
    allowedRoles,
    mentionsPii,
    mentionsFinance,
    mentionsHr,
    hasRoleCondition,
    content,
  });
}

console.log(`Found ${reports.length} multi-role or open routes.`);
const highRisk = reports.filter(r => (r.mentionsPii.length > 0 || r.mentionsFinance.length > 0 || r.mentionsHr.length > 0));
console.log(`High-risk sensitive routes: ${highRisk.length}`);

for (const r of highRisk) {
  console.log(`\nROUTE: ${r.rel}`);
  console.log(`  Roles: ${r.hasNoAllowlist ? 'NONE (Open to all auth users)' : r.allowedRoles.join(', ')}`);
  console.log(`  Sensitivities: ${[...r.mentionsPii, ...r.mentionsFinance, ...r.mentionsHr].join(', ')}`);
  console.log(`  Has role-based trimming/condition: ${r.hasRoleCondition ? 'YES' : 'NO'}`);
}
