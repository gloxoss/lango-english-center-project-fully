import { describe, expect, it } from 'vitest';
import {
  declaresRecordSet,
  fileFetchesData,
  findImportedFixtureSeeds,
  findMockScreenSeeds,
  findRecordConsts,
  findRenderedFixtureImports,
  isComponentFile,
  isControlWired,
  readOpeningTag,
  routeIsLinked,
} from '../../../../scripts/check-ui-reality';

// Pins the heuristics behind `npm run check:ui`.
//
// This repo has already shipped a gate that silently never ran: `npm run lint` is
// `eslint . && tsx check-tenant-isolation.ts`, eslint exited 2, and the isolation
// check was skipped by the `&&` for an unknown length of time. A static checker
// that quietly stops catching things is worse than no checker, because it reads as
// evidence.
//
// So the rules are tested directly: a false positive here blocks CI on honest
// code, and a false negative lets a dead button ship while the gate reports green.

describe('readOpeningTag', () => {
  it('reads a simple self-closing tag', () => {
    const src = '<Button size="sm" />';
    const tag = readOpeningTag(src, 0);

    expect(tag?.text).toBe('<Button size="sm" />');
    expect(tag?.selfClosing).toBe(true);
  });

  it('does not stop at a > inside a template literal', () => {
    // The bug this guards: className={`a > b ${x}`} ends the tag early, so the
    // onClick after it is never seen and an honest control reads as dead.
    const src = '<Button className={`w-4 > ${x}`} onClick={go}>Go</Button>';
    const tag = readOpeningTag(src, 0);

    expect(tag?.text).toContain('onClick');
    expect(tag?.selfClosing).toBe(false);
  });

  it('does not stop at a > inside a quoted attribute', () => {
    const src = '<button aria-label="a > b" onClick={go}>x</button>';

    expect(readOpeningTag(src, 0)?.text).toContain('onClick');
  });

  it('handles an escaped quote inside an attribute', () => {
    const src = `<button aria-label='it\\'s here' onClick={go}>x</button>`;

    expect(readOpeningTag(src, 0)?.text).toContain('onClick');
  });

  it('returns null for an unterminated tag', () => {
    expect(readOpeningTag('<Button onClick={go}', 0)).toBeNull();
  });
});

describe('isControlWired', () => {
  it('accepts every handler form', () => {
    for (const attr of ['onClick={go}', 'onSubmit={go}', 'onKeyDown={go}', 'onValueChange={go}']) {
      expect(isControlWired(`<button ${attr}>x</button>`, '')).toBe(true);
    }
  });

  it('accepts type="submit" in both quote and brace form', () => {
    expect(isControlWired('<button type="submit">x</button>', '')).toBe(true);
    expect(isControlWired('<button type={\'submit\'}>x</button>', '')).toBe(true);
  });

  it('accepts asChild and href, which delegate the action', () => {
    expect(isControlWired('<Button asChild><Link href="/x">x</Link></Button>', '')).toBe(true);
    expect(isControlWired('<Button href="/x">x</Button>', '')).toBe(true);
  });

  it('accepts a link in the children, not just the tag', () => {
    expect(isControlWired('<Button><a href="/x">x</a></Button>', '')).toBe(true);
  });

  it('accepts a control whose parent is a trigger', () => {
    expect(isControlWired('<button>Open</button>', '<DialogTrigger asChild>\n  ')).toBe(true);
    expect(isControlWired('<button>Open</button>', '<DropdownMenuTrigger>\n  ')).toBe(true);
  });

  it('accepts a bare button inside an open form', () => {
    expect(isControlWired('<button>Save</button>', '<form onSubmit={go}>\n  <input />\n  ')).toBe(true);
  });

  it('does not accept a bare button after the form has closed', () => {
    expect(isControlWired('<button>Save</button>', '<form></form>\n<div>\n  ')).toBe(false);
  });

  it('rejects the real shapes found in this codebase', () => {
    // Pagination that paginates nothing.
    expect(isControlWired('<button className="size-6 rounded"><ChevronLeft /></button>', '<div>')).toBe(false);
    // A row overflow menu.
    expect(isControlWired('<button className="p-1">⋮</button>', '<td>')).toBe(false);
    // A "see all" link that is not a link.
    expect(isControlWired('<button className="font-bold">Voir toutes mes classes</button>', '<div>')).toBe(false);
  });
});

describe('fileFetchesData', () => {
  it('recognises the data-loading forms used here', () => {
    for (const src of ['await fetch("/api/x")', 'useSWR("/api/x")', 'useQuery({})', 'useActionState(a, b)']) {
      expect(fileFetchesData(src)).toBe(true);
    }
  });

  it('is false for a file that loads nothing', () => {
    expect(fileFetchesData('const ROWS = [{ a: 1 }]; export function V() { return null; }')).toBe(false);
  });

  it('is not fooled by the word fetch in prose', () => {
    expect(fileFetchesData('// we should fetch this later')).toBe(false);
  });
});

describe('findRecordConsts', () => {
  it('flags an array of invented records that the file renders', () => {
    const src = [
      'const STUDENTS = [',
      '  { id: 1, name: "Bennani Salma", score: 16.5 },',
      '  { id: 2, name: "El Fassi Youssef", score: 18.5 },',
      '];',
      'export function V() { return STUDENTS.map(s => s.name); }',
    ].join('\n');

    expect(findRecordConsts(src)).toEqual(['STUDENTS']);
  });

  it('ignores lookup tables, which are legitimate', () => {
    // These are exactly the names that made the first draft of this scanner
    // report 17 "mock screens" when the real number was 1.
    const names = ['DAY_LABELS', 'MENTION_STYLES', 'ROLE_OPTIONS', 'CYCLE_COLORS', 'PLAN_ICONS', 'STATUS_LABELS'];

    for (const name of names) {
      const src = `const ${name} = [{ a: 1 }, { b: 2 }];\nexport function V() { return ${name}; }`;

      expect(findRecordConsts(src)).toEqual([]);
    }
  });

  it('ignores a list of plain strings', () => {
    const src = 'const DAYS = ["lundi", "mardi"];\nexport function V() { return DAYS; }';

    expect(findRecordConsts(src)).toEqual([]);
  });

  it('ignores a declared-but-unused leftover', () => {
    const src = 'const STUDENTS = [{ a: 1 }, { b: 2 }];\nexport function V() { return null; }';

    expect(findRecordConsts(src)).toEqual([]);
  });

  it('ignores a constant that is not module-level', () => {
    const src = '  const STUDENTS = [{ a: 1 }, { b: 2 }];\nexport function V() { return STUDENTS; }';

    expect(findRecordConsts(src)).toEqual([]);
  });
});

describe('findImportedFixtureSeeds', () => {
  it('finds fixture data imported into client state, including typed state', () => {
    const src = `
      'use client';
      import { KANBAN_COLUMNS as INITIAL_COLUMNS, type Lead } from '../data/lead-pipeline-config';
      const [columns] = useState<Lead[]>(INITIAL_COLUMNS);
    `;
    expect(findImportedFixtureSeeds(src)).toEqual(['INITIAL_COLUMNS']);
  });

  it('ignores unused data imports and type-only imports', () => {
    const src = `import { type Lead, LABELS } from '../data/lead-pipeline-config';
      const label = LABELS[0];`;
    expect(findImportedFixtureSeeds(src)).toEqual([]);
  });

  it('finds the lazy initializer form, which hid from the first version of the rule', () => {
    const src = `
      'use client';
      import { KANBAN_COLUMNS } from '../data/lead-pipeline-config';
      const [columns] = useState(() => KANBAN_COLUMNS);
    `;
    expect(findImportedFixtureSeeds(src)).toEqual(['KANBAN_COLUMNS']);
  });
});

describe('findMockScreenSeeds', () => {
  // The gate itself, not just its helpers. S-1 shipped on invented data while the
  // helpers were green: a tested detector that its caller forgets to run reports
  // the same as no detector at all.
  const fixture = [
    `'use client';`,
    `import { useState } from 'react';`,
    `import { CAMPAIGN_REPORTS } from '../data/delivery-reports-config';`,
    `export function DeliveryReports() {`,
    `  const [selected] = useState(CAMPAIGN_REPORTS);`,
    `  return selected.map(r => r.campaignName);`,
    `}`,
  ].join('\n');

  it('flags a client screen that renders records imported from a data module', () => {
    expect(findMockScreenSeeds(fixture)).toContain('CAMPAIGN_REPORTS');
  });

  it('flags an in-file record array through the same gate', () => {
    const src = [
      `'use client';`,
      `const STUDENTS = [`,
      `  { id: 1, name: "Bennani Salma" },`,
      `  { id: 2, name: "El Fassi Youssef" },`,
      `];`,
      `export function V() { return STUDENTS.map(s => s.name); }`,
    ].join('\n');

    expect(findMockScreenSeeds(src)).toEqual(['STUDENTS']);
  });

  it('stays quiet when the screen fetches its own data', () => {
    const src = fixture.replace(
      `  const [selected] = useState(CAMPAIGN_REPORTS);`,
      `  const [selected] = useState(CAMPAIGN_REPORTS);\n  useEffect(() => { fetch('/api/campaigns'); }, []);`,
    );

    expect(findMockScreenSeeds(src)).toEqual([]);
  });

  it('stays quiet for a server component, which is fed by its caller', () => {
    expect(findMockScreenSeeds(fixture.replace(`'use client';`, ''))).toEqual([]);
  });
});

describe('routeIsLinked', () => {
  const nav = [
    'href: `/${locale}/dashboard/academics/rooms`',
    'href: \'/dashboard/finance/expenses\'',
  ].join('\n');

  it('finds a template-literal nav href', () => {
    expect(routeIsLinked('dashboard/academics/rooms', nav)).toBe(true);
  });

  it('finds a single-quoted nav href', () => {
    expect(routeIsLinked('dashboard/finance/expenses', nav)).toBe(true);
  });

  it('is false for a page no nav entry points at', () => {
    expect(routeIsLinked('dashboard/academics/grades/entry', nav)).toBe(false);
  });

  it('does not treat a longer route as linked by its prefix', () => {
    // `dashboard/academics/rooms` is linked; `.../rooms/edit` is not, and must not
    // inherit its parent's link.
    expect(routeIsLinked('dashboard/academics/rooms/edit', nav)).toBe(false);
  });
});

describe('declaresRecordSet', () => {
  it('accepts an exported array of object rows, with or without a type annotation', () => {
    expect(declaresRecordSet('export const campaigns = [{ a: 1 }, { b: 2 }];', 'campaigns')).toBe(true);
    expect(declaresRecordSet('const CAMPAIGN_REPORTS: Row[] = [\n  { a: 1 },\n  { b: 2 },\n];', 'CAMPAIGN_REPORTS')).toBe(true);
  });

  it('rejects types, functions and single-object constants', () => {
    expect(declaresRecordSet('export type Session = { id: string };', 'Session')).toBe(false);
    expect(declaresRecordSet('export function getMySessions() { return []; }', 'getMySessions')).toBe(false);
    expect(declaresRecordSet('export const SETTINGS = { a: 1 };', 'SETTINGS')).toBe(false);
    expect(declaresRecordSet('export const CHANNELS = ["sms", "email"];', 'CHANNELS')).toBe(false);
  });
});

describe('findRenderedFixtureImports', () => {
  // The shape that shipped on two Communication pages: a production screen
  // rendering records imported straight from a fixture module. State seeding was
  // covered already; rendering the import directly hid behind it, and the gate
  // reported zero mock screens while the screen showed invented campaigns and
  // delivery rates.
  const fixtureModule = [
    `export const campaigns = [`,
    `  { id: '1', name: 'Rappel Réunion de Rentrée 2025', recipients: 420 },`,
    `  { id: '2', name: 'Offre Portes Ouvertes Maarif', recipients: 156 },`,
    `];`,
  ].join('\n');

  const screen = [
    `'use client';`,
    `import { campaigns } from '@/features/crm/data/campaign-fixtures';`,
    `export function Page() { return campaigns.map((c) => c.name); }`,
  ].join('\n');

  const resolveWith = (source: string | null) => () => source;

  it('flags records a production screen renders straight from a fixture module', () => {
    expect(findRenderedFixtureImports(screen, resolveWith(fixtureModule))).toEqual(['campaigns']);
  });

  it('resolves an aliased import back to the source declaration', () => {
    const aliased = [
      `import { campaigns as rows } from '../data/campaign-fixtures';`,
      `export function Page() { return rows.length; }`,
    ].join('\n');

    expect(findRenderedFixtureImports(aliased, resolveWith(fixtureModule))).toEqual(['rows']);
  });

  it('ignores lookup tables and settings catalogs from the same kind of module', () => {
    // SETTINGS_MODULES is the real settings hub catalog: a menu definition with
    // ids, titles and hrefs. Flagging it would block CI on honest code, which is
    // what this list is here to prevent.
    const configModule = [
      `export const STATUS_LABELS = [{ a: 1 }, { b: 2 }];`,
      `export const PCG_MAPPINGS = [{ a: 1 }, { b: 2 }];`,
      `export const SETTINGS_MODULES = [{ id: 'users', href: '/dashboard/settings/users' }, { id: 'onboarding', href: '/dashboard/settings/onboarding' }];`,
    ].join('\n');
    const src = [
      `import { STATUS_LABELS, PCG_MAPPINGS, SETTINGS_MODULES } from '@/features/settings/data/settings-hub-config';`,
      `export function Page() { return [STATUS_LABELS, PCG_MAPPINGS, SETTINGS_MODULES]; }`,
    ].join('\n');

    expect(findRenderedFixtureImports(src, resolveWith(configModule))).toEqual([]);
  });

  it('ignores marketing copy, which is content rather than invented data', () => {
    const contentModule = `export const INTEGRATION_TOOLS_COL1 = [{ name: 'Zoom' }, { name: 'Classroom' }];`;
    const src = [
      `import { INTEGRATION_TOOLS_COL1 } from '../data/marketing-content';`,
      `export function Section() { return INTEGRATION_TOOLS_COL1.map((tool) => tool.name); }`,
    ].join('\n');

    expect(findRenderedFixtureImports(src, resolveWith(contentModule))).toEqual([]);
  });

  it('ignores functions and types imported from a data module', () => {
    const apiModule = `export function getMySessions() { return []; }\nexport type Session = { id: string };`;
    const src = [
      `import { getMySessions, Session } from '../data/api';`,
      `export function Page() { return getMySessions(); }`,
    ].join('\n');

    expect(findRenderedFixtureImports(src, resolveWith(apiModule))).toEqual([]);
  });

  it('ignores an import whose module cannot be resolved instead of guessing', () => {
    expect(findRenderedFixtureImports(screen, resolveWith(null))).toEqual([]);
  });

  it('ignores an unused import', () => {
    const src = [
      `import { campaigns } from '@/features/crm/data/campaign-fixtures';`,
      `export function Page() { return null; }`,
    ].join('\n');

    expect(findRenderedFixtureImports(src, resolveWith(fixtureModule))).toEqual([]);
  });

  it('flags the direct-render form through the mock-screen gate as well', () => {
    expect(findMockScreenSeeds(screen, resolveWith(fixtureModule))).toContain('campaigns');
  });

  it('still flags the state-seeding form, which the earlier rule covered', () => {
    const seeded = [
      `'use client';`,
      `import { useState } from 'react';`,
      `import { campaigns } from '@/features/crm/data/campaign-fixtures';`,
      `export function Page() { const [rows] = useState(() => campaigns); return rows.length; }`,
    ].join('\n');

    const seeds = findMockScreenSeeds(seeded, resolveWith(fixtureModule));
    expect(seeds).toContain('campaigns');
  });
});

describe('isComponentFile', () => {
  it('scans production screens but not test fixtures or stories', () => {
    expect(isComponentFile('campaign-composer-client.tsx')).toBe(true);
    expect(isComponentFile('campaign-composer-client.test.tsx')).toBe(false);
    expect(isComponentFile('campaign-composer-client.stories.tsx')).toBe(false);
    expect(isComponentFile('campaign-fixtures.ts')).toBe(false);
  });
});
