import { describe, expect, it } from 'vitest';
import { computeMassarCoverage } from '@/libs/academics/massar-coverage';

// FORMULA UNDER TEST (single source of truth for the UI):
//   compliant  = streams with a non-blank massarBacCode
//   eligible   = registered streams evaluated
//   percent    = round(compliant / eligible * 100), null when eligible = 0
//   configured = compliant > 0
//
// The old hardcoded "100%" is gone; an empty catalogue must report
// "not configured" instead of a fabricated full-compliance claim.

describe('massar coverage — computed formula', () => {
  it('reports not-configured and a null percent for an empty catalogue (no division-by-zero 100%)', () => {
    const coverage = computeMassarCoverage([]);

    expect(coverage.eligible).toBe(0);
    expect(coverage.compliant).toBe(0);
    expect(coverage.percent).toBeNull();
    expect(coverage.configured).toBe(false);
  });

  it('computes a partial percentage from real records', () => {
    const coverage = computeMassarCoverage([
      { massarBacCode: 'SM-A' },
      { massarBacCode: null },
      { massarBacCode: 'SP-B' },
    ]);

    expect(coverage.eligible).toBe(3);
    expect(coverage.compliant).toBe(2);
    expect(coverage.percent).toBe(67);
    expect(coverage.configured).toBe(true);
  });

  it('reports full compliance only when every stream carries a code', () => {
    const coverage = computeMassarCoverage([
      { massarBacCode: 'SM-A' },
      { massarBacCode: 'SV-B' },
    ]);

    expect(coverage.percent).toBe(100);
    expect(coverage.configured).toBe(true);
  });

  it('treats missing, empty and whitespace-only codes as non-compliant', () => {
    const coverage = computeMassarCoverage([
      {},
      { massarBacCode: '' },
      { massarBacCode: '   ' },
      { massarBacCode: 'SE-A' },
    ]);

    expect(coverage.compliant).toBe(1);
    expect(coverage.percent).toBe(25);
  });

  it('never claims configured when no stream has a code', () => {
    const coverage = computeMassarCoverage([{ massarBacCode: null }, {}]);

    expect(coverage.percent).toBe(0);
    expect(coverage.configured).toBe(false);
  });
});
