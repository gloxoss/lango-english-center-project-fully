import fs from 'node:fs';
import path from 'node:path';

// Static "UI reality" check: does the interface actually do what it claims?
//
// Every defect class below was found by hand in live screens, after 1,860 unit
// tests were passing. None of them is the kind of thing a route test can catch,
// because each one sits between a working API and the user:
//
//   1. DEAD CONTROLS — a <Button>/<button> with no onClick, no submit, no link
//      and no trigger parent. Pagination bars that paginate nothing, row `⋮`
//      menus, "see all" links going nowhere.
//   2. MOCK SCREENS — a component rendering module-level arrays or seeding
//      state from imported data/* fixtures with no fetch in the file. The worst case found was
//      `/academics/grades/entry`, which served a hardcoded exam paper with
//      pre-filled answers while a real grading API sat unused.
//   3. UNLINKED PAGES — a dashboard page on disk that no nav entry points at.
//      From a user's point of view it is not shipped. 71 of 298 were unreachable,
//      including the room registry and grade entry.
//   4. ORPHANED COMPONENTS — an exported component nothing in src imports.
//      Either dead code or a screen someone forgot to wire, and both rot.
//
// RATCHET, NOT ZERO. Each count may only go down. The current numbers are real
// debt that cannot be cleared in one pass, but nothing may make them worse —
// which is the property that actually prevents regression. Lower a baseline when
// you fix something; raising one requires saying so in a reviewable diff.
//
// NOT verified (documented limits of a static heuristic — no type information, no
// rendering): whether a wired handler does anything useful, whether fetched data
// is displayed, whether a linked page works once reached, or whether a mock
// constant is genuinely fake rather than a legitimate lookup table. A count that
// stays flat while one defect is fixed and another introduced is invisible here;
// the printed lists exist so a reviewer can see composition, not just totals.

const SRC = path.join(process.cwd(), 'src');
const APP = path.join(SRC, 'app');
const SIDEBAR = path.join(SRC, 'components', 'shared', 'sidebar.tsx');
const BASELINE_FILE = path.join(process.cwd(), 'scripts', 'ui-reality-baseline.json');

const BACKSLASH = String.fromCharCode(92);

type Baseline = {
  deadControls: number;
  mockScreens: number;
  unlinkedPages: number;
  orphanedComponents: number;
};

// ---------------------------------------------------------------------------
// File walking
// ---------------------------------------------------------------------------

function walk(dir: string, predicate: (name: string) => boolean, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') {
        continue;
      }
      walk(full, predicate, out);
    } else if (predicate(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function rel(file: string): string {
  return path.relative(process.cwd(), file).replace(/\\/g, '/');
}

const isComponentFile = (name: string) =>
  name.endsWith('.tsx') && !name.includes('.test.') && !name.includes('.stories.');

// ---------------------------------------------------------------------------
// 1. Dead controls
// ---------------------------------------------------------------------------

// Anything here counts as wired. Deliberately generous: a false positive blocks
// CI, so the check only reports controls with no plausible handler at all.
const WIRED_PATTERNS = [
  /\bonClick\b/,
  /\bonSubmit\b/,
  /\bonPointerDown\b/,
  /\bonMouseDown\b/,
  /\bonKeyDown\b/,
  /\bonChange\b/,
  /\bonValueChange\b/,
  /\bonSelect\b/,
  /\bonOpenChange\b/,
  /\btype\s*=\s*["']submit["']/,
  /\btype\s*=\s*\{\s*["']submit["']/,
  /\basChild\b/,
  /\bhref\b/,
  /\bformAction\b/,
  /\bpopoverTarget\b/,
];

// A control that is the direct child of one of these is wired by its parent.
const TRIGGER_PARENT = /(?:Dialog|Popover|Tooltip|Sheet|Drawer|DropdownMenu|AlertDialog|Collapsible|Accordion|Select|Tabs|Menubar|ContextMenu|HoverCard)Trigger[^>]*>\s*$/;

/**
 * The full text of the JSX opening tag starting at `start`.
 *
 * Brace- and quote-aware, because `className={`...${x}...`}` contains `>`
 * characters that a naive scan would treat as the end of the tag.
 */
export function readOpeningTag(src: string, start: number): { text: string; end: number; selfClosing: boolean } | null {
  let i = start;
  let depth = 0;
  let quote: string | null = null;

  while (i < src.length) {
    const c = src[i]!;
    if (quote) {
      if (c === BACKSLASH) {
        i += 2;
        continue;
      }
      if (c === quote) {
        quote = null;
      }
    } else if (c === '"' || c === '\'' || c === '`') {
      quote = c;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
    } else if (c === '>' && depth === 0) {
      return { text: src.slice(start, i + 1), end: i + 1, selfClosing: src[i - 1] === '/' };
    }
    i++;
  }
  return null;
}

export type Finding = { file: string; line: number; detail: string };

/**
 * Whether a control is wired, given its own JSX (plus children) and the text
 * immediately preceding it. Split out from the file walk so the rule itself is
 * testable without fixtures on disk — this is where every false positive lives.
 */
export function isControlWired(scope: string, before: string): boolean {
  if (WIRED_PATTERNS.some(r => r.test(scope))) {
    return true;
  }
  if (TRIGGER_PARENT.test(before)) {
    return true;
  }
  // Inside an open <form>, a bare button submits by default.
  return before.lastIndexOf('<form') > before.lastIndexOf('</form>');
}

/** True when a component file fetches its own data. */
export function fileFetchesData(src: string): boolean {
  return /\bfetch\s*\(|useSWR|useQuery|useActionState|useFormState/.test(src);
}

/**
 * Lookup tables are legitimate module constants and must not be mistaken for
 * invented records. Matched by name, because the shape of `['Jan','Fév',...]` and
 * a list of fake students is the same to a regex.
 */
const LOOKUP_NAME = /LABEL|COLOR|ICON|STYLE|VARIANT|THEME|FORMAT|OPTION|TYPE|ROLE|STATUS|KIND|CHANNEL|DAY|MONTH|WEEKDAY|CYCLE|NAV|TAB|LINK|SOCIAL|PLAN|REASON|HANDLER|CODE|FIELD|ENTITY|METHOD|PERIOD|MODE|DIFFICULTY|LIMIT|ORDER|SHORTCUT|STAGE|CATEGOR|LEVEL|LOCALE|CURRENC|PERMISSION|CAPABILIT|COLUMN|HEADER|STEP|UNIT/;

/**
 * Module-level constants that look like invented record sets rather than lookup
 * tables. A list of strings is a lookup; a list of objects is a row set.
 */
export function findRecordConsts(src: string): string[] {
  const found: string[] = [];
  // Name first, then the assignment is inspected by index rather than by pattern.
  // A regex covering the optional `: Type` annotation needs two adjacent `\s*`
  // quantifiers, which backtrack polynomially on a long line.
  const nameRe = /^const\s+([A-Z][A-Z0-9_]{2,})\b/gm;
  let m: RegExpExecArray | null;

  // eslint-disable-next-line no-cond-assign
  while ((m = nameRe.exec(src))) {
    const name = m[1]!;
    if (LOOKUP_NAME.test(name)) {
      continue;
    }

    // Must be assigned an array literal on the same line: `= [`, with an optional
    // type annotation in between.
    const lineEnd = src.indexOf('\n', m.index);
    const decl = src.slice(m.index + m[0].length, lineEnd === -1 ? src.length : lineEnd);
    const eq = decl.indexOf('=');
    if (eq === -1 || decl.slice(eq + 1).trimStart()[0] !== '[') {
      continue;
    }
    const body = src.slice(m.index, m.index + 8000).split('\n];')[0] ?? '';
    if ((body.match(/\{/g) || []).length < 2) {
      continue;
    }
    // Declared and used, not a leftover.
    if ((src.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length < 2) {
      continue;
    }
    found.push(name);
  }

  return found;
}

/** Client state seeded from imported data can hide invented records from the
 * same-file array detector. Type-only imports and unused lookups are ignored. */
export function findImportedFixtureSeeds(src: string): string[] {
  const found: string[] = [];
  const imports = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = imports.exec(src))) {
    if (!match[2]?.includes('/data/')) continue;
    for (const specifier of match[1]!.split(',')) {
      const part = specifier.trim();
      if (!part || part.startsWith('type ')) continue;
      const localName = (part.split(/\s+as\s+/)[1] ?? part).trim();
      if (!/^[A-Za-z_$][\w$]*$/.test(localName)) continue;
      const seed = new RegExp(`\\buseState(?:<[^;\\n]{0,160}>)?\\s*\\(\\s*${localName}\\s*\\)`);
      if (seed.test(src)) found.push(localName);
    }
  }
  return found;
}

/** Whether any nav source links the given dashboard route. */
export function routeIsLinked(route: string, navSources: string): boolean {
  const tail = route.replace(/^dashboard\//, '');
  const backtick = String.fromCharCode(96);
  return navSources.includes(`dashboard/${tail}${backtick}`)
    || navSources.includes(`dashboard/${tail}'`)
    || navSources.includes(`dashboard/${tail}"`)
    || navSources.includes(`/${tail}${backtick}`);
}

function findDeadControls(): Finding[] {
  const findings: Finding[] = [];

  for (const file of walk(SRC, isComponentFile)) {
    const src = fs.readFileSync(file, 'utf8');
    const re = /<(Button|button)(?=[\s/>])/g;
    let m: RegExpExecArray | null;

    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(src))) {
      const tag = readOpeningTag(src, m.index);
      if (!tag) {
        continue;
      }

      const tagName = m[1]!;
      let scope = tag.text;
      if (!tag.selfClosing) {
        // Children matter: a <Link> inside the button makes it navigable.
        const closeIdx = src.indexOf(`</${tagName}>`, tag.end);
        scope += closeIdx === -1 ? '' : src.slice(tag.end, closeIdx);
      }

      const before = src.slice(Math.max(0, m.index - 1500), m.index);
      if (isControlWired(scope, before)) {
        continue;
      }

      const line = src.slice(0, m.index).split('\n').length;
      // Label text between the tags, trimmed in code rather than by the pattern:
      // two `\s*` quantifiers around a lazy group backtrack polynomially.
      const between = (scope.match(/>([^<>{}\n]{2,60})</) || [])[1]?.trim();
      const label = (between && between.length >= 2 ? between : undefined)
        ?? (scope.match(/aria-label\s*=\s*["']([^"']+)/) || [])[1]
        ?? '(icon only)';

      findings.push({ file: rel(file), line, detail: String(label).replace(/\s+/g, ' ').trim() });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// 2. Mock screens
// ---------------------------------------------------------------------------

function findMockScreens(): Finding[] {
  const findings: Finding[] = [];

  for (const file of walk(SRC, isComponentFile)) {
    const src = fs.readFileSync(file, 'utf8');

    // A file that fetches is not a mock screen, even if it also holds constants.
    if (fileFetchesData(src)) {
      continue;
    }
    // Server components receive data as props rather than fetching.
    if (!src.includes('\'use client\'')) {
      continue;
    }

    const recordConsts = findRecordConsts(src);

    const importedSeeds = findImportedFixtureSeeds(src);
    if (recordConsts.length > 0 || importedSeeds.length > 0) {
      findings.push({ file: rel(file), line: 1, detail: [...recordConsts, ...importedSeeds].join(', ') });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// 3. Unlinked pages
// ---------------------------------------------------------------------------

function routeOf(pageFile: string): string {
  let r = rel(pageFile).replace(/^src\/app\//, '').replace(/\/page\.tsx$/, '');
  r = r.split('/').filter(seg => !(seg.startsWith('(') && seg.endsWith(')'))).join('/');
  return r.replace(/^\[locale\]\//, '');
}

function findUnlinkedPages(): Finding[] {
  if (!fs.existsSync(SIDEBAR)) {
    return [];
  }

  const navSources = [SIDEBAR, path.join(SRC, 'libs', 'api', 'portal-manifest.ts')]
    .filter(f => fs.existsSync(f))
    .map(f => fs.readFileSync(f, 'utf8'))
    .join('\n');

  const findings: Finding[] = [];

  for (const file of walk(APP, name => name === 'page.tsx')) {
    const route = routeOf(file);
    if (!route.startsWith('dashboard/')) {
      continue;
    }
    // Reached only by the server page guard after a denied request.
    if (route === 'dashboard/access-denied') {
      continue;
    }
    // A dynamic segment is reached from its parent list, never linked directly.
    if (route.includes('[')) {
      continue;
    }

    if (!routeIsLinked(route, navSources)) {
      findings.push({ file: rel(file), line: 1, detail: route });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// 4. Orphaned components
// ---------------------------------------------------------------------------

function findOrphanedComponents(): Finding[] {
  const roots = [path.join(SRC, 'features'), path.join(SRC, 'components')];
  const candidates = roots.flatMap(r => walk(r, isComponentFile));

  // One pass over the whole tree, so this is not quadratic in file reads.
  const corpus = new Map<string, string>();
  for (const f of walk(SRC, name => /\.(?:tsx?|mjs)$/.test(name))) {
    corpus.set(rel(f), fs.readFileSync(f, 'utf8'));
  }

  const findings: Finding[] = [];

  for (const file of candidates) {
    const key = rel(file);
    const src = corpus.get(key) ?? '';

    const names = [...new Set([
      ...[...src.matchAll(/export\s+(?:default\s+)?(?:async\s+)?function\s+([A-Z]\w+)/g)].map(m => m[1]!),
      ...[...src.matchAll(/export\s+const\s+([A-Z]\w+)/g)].map(m => m[1]!),
    ])];
    if (names.length === 0) {
      continue;
    }

    const base = path.basename(key).replace(/\.tsx$/, '');
    let referenced = false;

    for (const [otherKey, text] of corpus) {
      if (otherKey === key) {
        continue;
      }
      if (text.includes(base) || names.some(n => new RegExp(`\\b${n}\\b`).test(text))) {
        referenced = true;
        break;
      }
    }

    if (!referenced) {
      findings.push({ file: key, line: 1, detail: names.join(', ') });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const VERBOSE = process.env.UI_REALITY_VERBOSE === 'all';
const LIST_LIMIT = VERBOSE ? Number.POSITIVE_INFINITY : 12;

function report(title: string, findings: Finding[], baseline: number): boolean {
  const count = findings.length;
  const ok = count <= baseline;
  const symbol = ok ? (count < baseline ? '🎉' : '✅') : '❌';

  console.log(`\n${symbol} ${title}: ${count} (baseline ${baseline})`);

  if (count < baseline) {
    console.log(`   Improved by ${baseline - count}. Lower the baseline in scripts/ui-reality-baseline.json to lock it in.`);
  }
  if (!ok) {
    console.log(`   REGRESSION: ${count - baseline} more than the baseline allows.`);
  }

  const byFile = new Map<string, Finding[]>();
  for (const f of findings) {
    if (!byFile.has(f.file)) {
      byFile.set(f.file, []);
    }
    byFile.get(f.file)!.push(f);
  }

  const entries = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [file, items] of entries.slice(0, LIST_LIMIT)) {
    console.log(`   ${file} (${items.length})`);
    for (const i of items.slice(0, VERBOSE ? items.length : 4)) {
      console.log(`      :${i.line} ${i.detail}`);
    }
    if (!VERBOSE && items.length > 4) {
      console.log(`      … ${items.length - 4} more`);
    }
  }
  if (entries.length > LIST_LIMIT) {
    console.log(`   … and ${entries.length - LIST_LIMIT} more file(s) (set UI_REALITY_VERBOSE=all to print every finding)`);
  }

  return ok;
}

export function runCheck(): void {
  if (!fs.existsSync(BASELINE_FILE)) {
    console.error(`❌ Missing baseline file: ${rel(BASELINE_FILE)}`);
    process.exit(1);
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) as Baseline;

  const deadControls = findDeadControls();
  const mockScreens = findMockScreens();
  const unlinkedPages = findUnlinkedPages();
  const orphanedComponents = findOrphanedComponents();

  const results = [
    report('Dead controls (no handler, no link, no trigger parent)', deadControls, baseline.deadControls),
    report('Mock screens (invented records or imported fixture state, no fetch)', mockScreens, baseline.mockScreens),
    report('Unlinked dashboard pages (no nav entry points at them)', unlinkedPages, baseline.unlinkedPages),
    report('Orphaned components (nothing in src imports them)', orphanedComponents, baseline.orphanedComponents),
  ];

  const improved = [
    deadControls.length < baseline.deadControls,
    mockScreens.length < baseline.mockScreens,
    unlinkedPages.length < baseline.unlinkedPages,
    orphanedComponents.length < baseline.orphanedComponents,
  ].filter(Boolean).length;

  if (results.includes(false)) {
    console.error(
      `\n❌ UI-reality check failed: at least one count rose above its baseline.`
      + `\n   Either wire up what you added, or — if a finding is a false positive —`
      + ` say so in the PR and raise the baseline deliberately.`,
    );
    process.exit(1);
  }

  console.log(
    `\n✅ UI-reality ratchet holding.`
    + `\n   Dead controls ${deadControls.length}/${baseline.deadControls},`
    + ` mock screens ${mockScreens.length}/${baseline.mockScreens},`
    + ` unlinked pages ${unlinkedPages.length}/${baseline.unlinkedPages},`
    + ` orphaned components ${orphanedComponents.length}/${baseline.orphanedComponents}.${
      improved > 0 ? `\n   ${improved} category(ies) improved — lower the baseline to lock the gain in.` : ''
    }\n   Verified: every <Button>/<button> has a handler, submit, link or trigger parent;`
    + ` no client component renders invented record arrays without fetching;`
    + ` every static dashboard page is reachable from the sidebar or portal manifest;`
    + ` every exported component under features/ and components/ is imported somewhere.`
    + `\n   Limits: static heuristics, no type information and no rendering — a wired handler`
    + ` is not proven to do anything, fetched data is not proven to be displayed, and a`
    + ` flat count can hide one defect fixed while another is added.`,
  );
}

// Only run as a CLI. The heuristics above are exported so a test can import them
// without the check walking the tree and calling process.exit() on import.
if (process.argv[1]?.replace(/\\/g, '/').includes('scripts/check-ui-reality')) {
  runCheck();
}
