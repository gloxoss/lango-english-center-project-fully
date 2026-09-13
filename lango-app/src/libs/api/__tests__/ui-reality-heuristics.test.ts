import { describe, expect, it } from 'vitest';
import {
  fileFetchesData,
  findRecordConsts,
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
