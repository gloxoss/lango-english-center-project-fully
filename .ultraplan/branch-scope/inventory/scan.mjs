import fs from 'node:fs';
import path from 'node:path';

const S = process.env.S;
const out = [];
const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p); else if (e.name === 'route.ts') out.push(p);
});
walk('src/app/api');
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const resolveImp = (spec) => {
  if (!spec.startsWith('@/')) return null;
  const b = `src/${spec.slice(2)}`;
  for (const x of [`${b}.ts`, `${b}/index.ts`, `${b}.tsx`]) if (fs.existsSync(x)) return x;
  return null;
};
const rows = out.map((f) => {
  const src = read(f);
  const imps = [...src.matchAll(/from '(@\/(?:features|libs\/services|addons)[^']+)'/g)].map(m => resolveImp(m[1])).filter(Boolean);
  const all = src + imps.map(read).join('\n');
  const methods = [...src.matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE)/g)].map(m => m[1]);
  const route = `/${path.relative('src/app', path.dirname(f)).split(path.sep).join('/')}`;
  const parts = route.split('/');
  const mod = parts[2] === 'addons' ? parts[3] : parts[2];
  return {
    route, mod, methods: methods.join('|'),
    ctxBranch: /(ctx|context)\.branchId|principal\.branchId/.test(all),
    qBranch: /get\('branchId'\)|branchId:\s*z\./.test(all),
    anyBranch: /branchId|branch_id/.test(all),
    writes: methods.some(m => m !== 'GET'),
  };
});
fs.writeFileSync(`${S}/routes.json`, JSON.stringify(rows, null, 1));
const by = {};
rows.forEach((r) => {
  const m = by[r.mod] ??= { n: 0, ctx: 0, q: 0, other: 0, none: 0 };
  m.n++;
  if (r.ctxBranch) m.ctx++; else if (r.qBranch) m.q++; else if (r.anyBranch) m.other++; else m.none++;
});
console.log('routes', rows.length, '| server-branch', rows.filter(r => r.ctxBranch).length, '| query-branch only', rows.filter(r => !r.ctxBranch && r.qBranch).length, '| no branch at all', rows.filter(r => !r.anyBranch).length);
console.log('module'.padEnd(22), 'n ctx q other none');
Object.entries(by).sort((a, b) => b[1].n - a[1].n).forEach(([k, v]) => console.log(k.padEnd(22), v.n, v.ctx, v.q, v.other, v.none));
