import { describe, expect, it } from 'vitest';
import { parseSegmentDefinition } from '../segments-service';

describe('Segment definition validation (parseSegmentDefinition)', () => {
  it('accepts a valid definition and keeps filters', () => {
    const d = parseSegmentDefinition({ kind: 'inquiry', filters: { status: 'new', tag: 'web', interestLevel: 'high' } });
    expect(d.kind).toBe('inquiry');
    expect(d.filters?.status).toBe('new');
    expect(d.filters?.tag).toBe('web');
    expect(d.filters?.interestLevel).toBe('high');
  });

  it('rejects an unknown recipient kind', () => {
    expect(() => parseSegmentDefinition({ kind: 'aliens' })).toThrow();
    expect(() => parseSegmentDefinition(undefined)).toThrow();
  });

  it('coerces string filters only from strings, booleans only from booleans', () => {
    const d = parseSegmentDefinition({ kind: 'student', filters: { status: 'active', hasPhone: true, hasEmail: 'yes' } });
    expect(d.filters?.status).toBe('active');
    expect(d.filters?.hasPhone).toBe(true);
    expect(d.filters?.hasEmail).toBeUndefined();
  });

  it('strips filters that are not part of the schema', () => {
    const d = parseSegmentDefinition({ kind: 'external', filters: { foo: 'bar', role: 'guard' } });
    expect(Object.prototype.hasOwnProperty.call(d.filters, 'foo')).toBe(false);
    expect(d.filters?.role).toBe('guard');
  });

  it('defaults to an empty filter object when absent', () => {
    const d = parseSegmentDefinition({ kind: 'guardian' });
    expect(d.kind).toBe('guardian');
    expect(d.filters).toEqual({});
  });
});
