export type MassarCoverageInput = { bacSeriesCode?: string | null };

export type MassarCoverage = {
  eligible: number;
  compliant: number;
  percent: number | null;
  configured: boolean;
};

/**
 * MEN Massar coverage over registered streams.
 *
 *   eligible   = streams evaluated (the registered catalogue)
 *   compliant  = streams carrying a non-blank bacSeriesCode (MEN Massar code)
 *   percent    = round(compliant / eligible * 100), or null when eligible = 0
 *   configured = at least one compliant stream exists
 *
 * No division-by-zero fake: an empty catalogue reports `percent: null` and
 * `configured: false` instead of pretending 100%.
 */
export function computeMassarCoverage(items: MassarCoverageInput[]): MassarCoverage {
  const eligible = items.length;
  const compliant = items.filter(item => (item.bacSeriesCode ?? '').trim().length > 0).length;

  return {
    eligible,
    compliant,
    percent: eligible === 0 ? null : Math.round((compliant / eligible) * 100),
    configured: compliant > 0,
  };
}
