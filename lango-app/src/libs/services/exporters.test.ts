import { describe, expect, it, vi } from 'vitest';

vi.mock('@/libs/DB', () => ({ db: {} }));

const { isKnownReportType, toCsv } = await import('./exporters');

// CSV injection of a stray quote or comma is what silently corrupts an export,
// so the escaping is the part worth pinning down.
describe('toCsv', () => {
  it('quotes every cell and doubles embedded quotes', () => {
    expect(toCsv(['a', 'b'], [['x', 'y']])).toBe('a,b\n"x","y"');
    expect(toCsv(['a'], [['say "hi"']])).toBe('a\n"say ""hi"""');
  });

  it('keeps commas and newlines inside one cell', () => {
    expect(toCsv(['a'], [['x,y']])).toBe('a\n"x,y"');
    expect(toCsv(['a'], [['x\ny']])).toBe('a\n"x\ny"');
  });

  it('renders null and undefined as empty, not as the words', () => {
    expect(toCsv(['a', 'b'], [[null, undefined]])).toBe('a,b\n"",""');
  });
});

describe('isKnownReportType', () => {
  it('accepts an implemented export and rejects anything else', () => {
    expect(isKnownReportType('audit-logs')).toBe(true);
    expect(isKnownReportType('not-a-report')).toBe(false);
  });

  // Object.hasOwn, not `in` - otherwise 'toString' would look implemented and
  // the job would be accepted and then crash mid-run.
  it('is not fooled by inherited Object properties', () => {
    expect(isKnownReportType('toString')).toBe(false);
    expect(isKnownReportType('constructor')).toBe(false);
  });
});
