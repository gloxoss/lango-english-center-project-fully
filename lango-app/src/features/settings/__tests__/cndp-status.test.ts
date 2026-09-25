import { describe, expect, it } from 'vitest';
import { cndpStatusOf } from '@/features/settings/cndp-status';

// The audit finding: a header badge claimed "Conformité CNDP F211" on every page
// while /settings/cndp said the school had not filed. These states are what the
// screen may claim, and the rule is that missing or unreadable data never reads
// as compliance.
describe('cndpStatusOf', () => {
  it('says the school has not filed when there is no filing record', () => {
    expect(cndpStatusOf(null)).toMatchObject({ key: 'draft', label: 'Non déposé' });
    expect(cndpStatusOf(undefined)).toMatchObject({ key: 'draft', label: 'Non déposé' });
    expect(cndpStatusOf('draft')).toMatchObject({ key: 'draft', label: 'Non déposé' });
  });

  it('reflects a real filed or approved declaration', () => {
    expect(cndpStatusOf('submitted')).toMatchObject({ key: 'submitted', label: 'En cours' });
    expect(cndpStatusOf('approved')).toMatchObject({ key: 'approved', label: 'Récépissé déclaré' });
    expect(cndpStatusOf('approved').label).not.toMatch(/Conforme/);
  });

  it('reports an unreadable registry as unavailable, never as compliant', () => {
    const status = cndpStatusOf(null, true);
    expect(status).toMatchObject({ key: 'unavailable', label: 'Information non disponible' });
    expect(status.label).not.toMatch(/Conforme/);
  });

  it('falls back to the neutral state for a status it does not know', () => {
    const status = cndpStatusOf('approved_by_a_friend');
    expect(status).toMatchObject({ key: 'draft', label: 'Non déposé' });
    expect(status.label).not.toMatch(/Conforme/);
  });
});
