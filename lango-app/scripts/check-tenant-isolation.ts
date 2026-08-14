import fs from 'fs';
import path from 'path';

const API_DIR = path.join(process.cwd(), 'src', 'app', 'api');

const ALLOWLIST = [
  'super-admin',
  'auth',
];

// Routes whose handler only delegates to a service that derives the tenant
// from the authenticated session (`requireTenantId(context)`) — no client id,
// no inline `tenantId` reference, so the static scanner cannot see the scope.
const SELF_SCOPED = [
  'guard/kiosk-sessions/[id]/close',
  'guard/kiosk-sessions/[id]/lock',
  'guard/me/gate',
  'guard/me/shift',
  'leadership/me/home',
];

function isAllowlisted(filePath: string): boolean {
  const rel = path.relative(API_DIR, filePath).replace(/\\/g, '/');
  return ALLOWLIST.some(prefix => rel.startsWith(prefix))
    || SELF_SCOPED.some(prefix => rel.startsWith(prefix));
}

function findTsFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findTsFiles(full));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      results.push(full);
    }
  }
  return results;
}

function analyzeFile(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  const errors: string[] = [];

  // If the file doesn't reference tenantId at all (and isn't allowlisted), flag it immediately
  if (!content.includes('tenantId') && !content.includes('requireTenant') && !content.includes('requireSuperAdmin')) {
    errors.push(`${relPath} - File lacks any reference to tenantId or requireTenant`);
    return errors;
  }

  const lines = content.split('\n');
  let inQuery = false;
  let currentQuery = '';
  let queryStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    if (/\b(db|tx)\.(select|update|delete)\b/.test(line)) {
      inQuery = true;
      currentQuery = line;
      queryStartLine = i + 1;
    } else if (inQuery) {
      currentQuery += ' ' + line;
    }

    if (inQuery && (line.includes(';') || line.trim() === '}' || i === lines.length - 1)) {
      inQuery = false;

      if (/\.(select|update|delete|from|where)\b/.test(currentQuery)) {
        // Look back 50 lines for `where` or `tenantId` definition if .where(where) is used
        let snippetContext = currentQuery;
        if (currentQuery.includes('where(')) {
          const startLookback = Math.max(0, queryStartLine - 50);
          snippetContext = lines.slice(startLookback, i + 1).join(' ');
        }

        const mentionsTenant = /\btenantId\b/.test(snippetContext) || /\btenants\b/.test(snippetContext);
        if (!mentionsTenant) {
          errors.push(`${relPath}:${queryStartLine} - Query may lack tenantId filter: "${currentQuery.trim().slice(0, 100)}..."`);
        }
      }
      currentQuery = '';
    }
  }

  return errors;
}

function runCheck() {
  const files = findTsFiles(API_DIR);
  const allErrors: string[] = [];

  for (const file of files) {
    if (isAllowlisted(file) || file.endsWith('.test.ts')) {
      continue;
    }
    const errs = analyzeFile(file);
    allErrors.push(...errs);
  }

  if (allErrors.length > 0) {
    console.error('❌ Tenant isolation check failed! Found queries without tenantId reference:');
    allErrors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('✅ Tenant isolation static analysis passed. All API queries reference tenantId.');
  }
}

runCheck();
