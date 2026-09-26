// Page -> guard -> APIs -> tables map for settings/core-config pages.
import fs from 'node:fs';
import path from 'node:path';

const D = 'src/app/[locale]/(dashboard)/dashboard';
const extra = ['academics/calendar', 'academics/semesters', 'academics/grading/policies', 'students/matricules'];
const pages = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p); else if (e.name === 'page.tsx') pages.push(p);
});
walk(path.join(D, 'settings'));
extra.forEach(x => pages.push(path.join(D, x, 'page.tsx')));

const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const resolve = (from, spec) => {
  let b;
  if (spec.startsWith('@/')) b = `src/${spec.slice(2)}`;
  else if (spec.startsWith('.')) b = path.join(path.dirname(from), spec);
  else return null;
  for (const x of [`${b}.tsx`, `${b}.ts`, `${b}/index.tsx`, `${b}/index.ts`]) if (fs.existsSync(x)) return x;
  return null;
};
// follow local imports (features/components/libs) up to depth 3 to collect fetch URLs
function collect(file, seen = new Set(), depth = 0) {
  if (!file || seen.has(file) || depth > 3) return seen;
  seen.add(file);
  const src = read(file);
  for (const m of src.matchAll(/from '([^']+)'/g)) {
    const r = resolve(file, m[1]);
    if (r && /src\/(features|app|components\/settings)/.test(r.split(path.sep).join('/'))) collect(r, seen, depth + 1);
  }
  return seen;
}
const sidebar = read('src/components/shared/sidebar.tsx');
const hub = read('src/features/settings/data/settings-hub-config.ts');
const schema = read('src/models/Schema.ts') + [...fs.readdirSync('src/features', { recursive: true })].filter(f => String(f).endsWith('schema.ts')).map(f => read(path.join('src/features', String(f)))).join('\n');
const tableOf = {};
for (const m of schema.matchAll(/export const (\w+) = pgTable\(\s*'([a-z0-9_]+)'/g)) tableOf[m[1]] = m[2];

const apiTables = (apiPath) => {
  const f = path.join('src/app', apiPath, 'route.ts');
  const files = [...collect(f)];
  const src = files.map(read).join('\n');
  const t = new Set();
  for (const m of src.matchAll(/\.(?:from|update|insert|delete|innerJoin|leftJoin)\((\w+)/g)) if (tableOf[m[1]]) t.add(tableOf[m[1]]);
  for (const m of src.matchAll(/(?:getEffectiveValue|setValue|upsertSetting)\([^,]+,[^,]+,\s*'([\w.]+)'/g)) t.add(`setting:${m[1]}`);
  return { exists: fs.existsSync(f), tables: [...t] };
};

const rows = pages.map((p) => {
  const route = '/dashboard/' + path.relative(D, path.dirname(p)).split(path.sep).join('/');
  const src = read(p);
  const guard = (src.match(/requireServerPage\([^)]*\{([^}]*)\}/) || [, ''])[1].replace(/\s+/g, ' ').trim()
    || (src.match(/redirect\(([^)]+)\)/) || [, ''])[1];
  const files = [...collect(p)];
  const all = files.map(read).join('\n');
  const apis = [...new Set([...all.matchAll(/['"`](\/api\/[a-zA-Z0-9\-/[\]$.{}]+)/g)].map(m => m[1].replace(/\$\{[^}]+\}/g, '[x]').replace(/[?].*$/, '')))];
  const comingSoon = /ComingSoon|comingSoon|Fonctionnalité à venir|coming-soon/.test(all);
  const sb = sidebar.includes(`dashboard${route.slice('/dashboard'.length)}\``) || sidebar.includes(`${route}\``) ? 'yes' : 'no';
  const inHub = hub.includes(`"${route}"`) ? 'yes' : 'no';
  return { route, guard, sidebar: sb, hub: inHub, comingSoon, apis, apiTables: apis.map(a => ({ api: a, ...apiTables(a.replace(/\[x\]/g, '[id]')) })) };
});
fs.writeFileSync(process.env.OUT, JSON.stringify(rows, null, 1));
for (const r of rows) console.log(`${r.route} | guard: ${r.guard.slice(0, 70)} | sidebar:${r.sidebar} hub:${r.hub}${r.comingSoon ? ' | COMING-SOON' : ''} | apis: ${r.apis.join(', ').slice(0, 160)}`);
