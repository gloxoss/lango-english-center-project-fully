// Finds translation keys that components call but any shipped locale does not
// define. next-intl renders the raw key ("Academics.tabExam") when a key is
// missing, so each hit is text a real user sees. Static analysis only: keys
// built dynamically (t(`x.${y}`)) are not checked.
// Usage: node scripts/check-missing-i18n-keys.mjs
import fs from 'node:fs';
import path from 'node:path';

const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
const locales = ['fr', 'en', 'ar'].map(locale => {
  const keys = new Set(flat(JSON.parse(fs.readFileSync(`locales/${locale}.json`, 'utf8'))));
  const prefixes = new Set([...keys].flatMap(k => k.split('.').map((_, i, a) => a.slice(0, i + 1).join('.'))));
  return { locale, keys, prefixes };
});

const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { if (!/node_modules|__tests__/.test(p)) walk(p); }
    else if (/\.tsx?$/.test(p) && !/\.test\./.test(p)) files.push(p);
  }
})('src');

const decl = /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:\{[^}]*namespace:\s*)?['"]([\w.]+)['"]/g;
const missing = new Map();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const [, v, ns] of src.matchAll(decl)) {
    const call = new RegExp(`\\b${v}(?:\\.rich|\\.raw|\\.markup|\\.has)?\\(\\s*['"]([\\w.]+)['"]`, 'g');
    for (const [, k] of src.matchAll(call)) {
      const key = `${ns}.${k}`;
      for (const { locale, keys, prefixes } of locales) {
        const missingKey = `${locale}:${key}`;
        if (!keys.has(key) && !prefixes.has(key) && !missing.has(missingKey)) {
          missing.set(missingKey, f.replace(/\\/g, '/'));
        }
      }
    }
  }
}

const byFile = {};
for (const [k, f] of missing) (byFile[f] ??= []).push(k);
console.log(`missing translation keys: ${missing.size} in ${Object.keys(byFile).length} files`);
for (const [f, ks] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)) {
  const shown = process.argv.includes('--all') ? ks : ks.slice(0, 4);
  console.log(`${String(ks.length).padStart(4)}  ${f}  ${shown.join(', ')}${ks.length > shown.length ? ', …' : ''}`);
}
process.exit(missing.size > 0 ? 1 : 0);
