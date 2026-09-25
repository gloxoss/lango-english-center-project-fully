#!/usr/bin/env node
// Ratchet for hardcoded French UI text (audit S-7).
//
// Counts, per module, the string literals and JSX text in src/**/*.tsx that
// contain an accented letter: the cheap, reliable signal of French copy that
// bypasses next-intl (so Arabic and English users see French). The real number
// of untranslated strings is higher (unaccented French is not counted), but
// this one can only go down.
//
//   npm run check:i18n:hardcoded             fail if any module grew
//   npm run check:i18n:hardcoded -- --update rewrite the baseline (refuses increases)
//   npm run check:i18n:hardcoded -- --list <module>   print the offending lines
//
// Modules: src/features/<name>, src/components/<name>, src/app/api, src/app/pages.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SRC = path.join(ROOT, 'src');
const BASELINE = path.join(ROOT, 'scripts', 'i18n-hardcoded-baseline.json');
const ACCENT = /[À-ÖØ-öø-ÿ]/;
const LITERAL = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
const JSX_TEXT = />([^<>{}\n]+)</g;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      walk(full, out);
    } else if (entry.name.endsWith('.tsx') && !/\.(test|spec|stories)\.tsx$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function moduleOf(file) {
  const parts = path.relative(SRC, file).split(path.sep);
  if (parts[0] === 'features' || parts[0] === 'components' || parts[0] === 'addons') return `${parts[0]}/${parts[1]}`;
  if (parts[0] === 'app') return parts.includes('api') ? 'app/api' : 'app/pages';
  return parts[0];
}

function scan(file) {
  const hits = [];
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let inBlockComment = false;
  lines.forEach((raw, i) => {
    let line = raw;
    if (inBlockComment) {
      const end = line.indexOf('*/');
      if (end === -1) return;
      line = line.slice(end + 2);
      inBlockComment = false;
    }
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlockComment = true;
      return;
    }
    // Drop trailing // comments and {/* */} JSX comments before matching.
    line = line.replace(/\{\/\*.*?\*\/\}/g, '').replace(/\s\/\/.*$/, '');
    if (/console\.(log|warn|error|info|debug)\(/.test(line)) return;
    const found = new Set();
    for (const m of line.matchAll(LITERAL)) if (ACCENT.test(m[2])) found.add(m[2]);
    for (const m of line.matchAll(JSX_TEXT)) if (ACCENT.test(m[1]) && m[1].trim()) found.add(m[1].trim());
    for (const text of found) hits.push({ line: i + 1, text });
  });
  return hits;
}

const counts = {};
const details = {};
for (const file of walk(SRC)) {
  const hits = scan(file);
  if (!hits.length) continue;
  const mod = moduleOf(file);
  counts[mod] = (counts[mod] ?? 0) + hits.length;
  (details[mod] ??= []).push(...hits.map(h => `${path.relative(ROOT, file)}:${h.line}  ${h.text}`));
}
const total = Object.values(counts).reduce((s, n) => s + n, 0);
const args = process.argv.slice(2);

if (args[0] === '--list') {
  for (const l of details[args[1]] ?? []) console.log(l);
  process.exit(0);
}

const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : null;
const grown = baseline
  ? Object.entries(counts).filter(([mod, n]) => n > (baseline.modules[mod] ?? 0)).map(([mod, n]) => `${mod}: ${baseline.modules[mod] ?? 0} -> ${n}`)
  : [];

if (args[0] === '--update') {
  if (grown.length) {
    console.error(`Refusing to raise the baseline:\n  ${grown.join('\n  ')}\nMove the new strings to locales/*.json instead.`);
    process.exit(1);
  }
  const sorted = Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
  fs.writeFileSync(BASELINE, `${JSON.stringify({ total, modules: sorted }, null, 2)}\n`);
  console.log(`Baseline written: ${total} hardcoded accented strings in ${Object.keys(sorted).length} modules.`);
  process.exit(0);
}

if (!baseline) {
  console.error('No baseline yet: run with --update once.');
  process.exit(1);
}
const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([m, n]) => `${m} ${n}`).join(', ');
console.log(`Hardcoded accented strings: ${total} (baseline ${baseline.total}). Top: ${top}`);
if (grown.length) {
  console.error(`Hardcoded French went up (use t() and locales/*.json):\n  ${grown.join('\n  ')}\nList them: npm run check:i18n:hardcoded -- --list <module>`);
  process.exit(1);
}
if (total < baseline.total) console.log('Lower than the baseline: run with --update to lock the gain in.');
