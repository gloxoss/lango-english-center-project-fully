import { describe, expect, it } from 'vitest';
import { csvSafeCell, csvSafeRow } from '@/libs/csv-safe';

describe('csvSafeCell', () => {
  it('neutralises spreadsheet formula triggers', () => {
    expect(csvSafeCell('=HYPERLINK("http://x","clic")')).toBe('"\'=HYPERLINK(""http://x"",""clic"")"');
    expect(csvSafeCell('+212600')).toBe('"\'+212600"');
    expect(csvSafeCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
    expect(csvSafeCell('-cmd')).toBe('"\'-cmd"');
  });

  it('keeps plain and negative numbers as numbers', () => {
    expect(csvSafeCell(-120.5)).toBe('"-120.5"');
    expect(csvSafeCell('-42')).toBe('"-42"');
  });

  it('quotes commas, quotes and newlines; empty for null', () => {
    expect(csvSafeRow(['a,b', 'say "hi"', null])).toBe('"a,b","say ""hi""",""');
  });
});
