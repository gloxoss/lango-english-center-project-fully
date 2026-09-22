import { describe, expect, it } from 'vitest';
import { computeTeacherDossier, summarizeTeacherDossiers } from '../teacher-dossier';
import { parseTimeToMinutes, slotDurationHours, summarizeWorkload, sumWeeklyHours } from '../teacher-workload';

describe('teacher dossier completeness', () => {
  const completeInput = {
    documents: { contract: true, cin: true, diploma: true },
    employeeId: 'EMP-2026-0001',
    hireDate: '2024-09-01',
    specialization: 'Mathématiques',
  };

  it('is complete when all required documents and profile fields are present', () => {
    const dossier = computeTeacherDossier(completeInput);

    expect(dossier.complete).toBe(true);
    expect(dossier.missingItems).toHaveLength(0);
    expect(dossier.hasAnyDocument).toBe(true);
  });

  it('lists missing documents and profile fields for an empty dossier', () => {
    const dossier = computeTeacherDossier({ documents: null, employeeId: null, hireDate: null, specialization: null });

    expect(dossier.complete).toBe(false);
    expect(dossier.hasAnyDocument).toBe(false);
    expect(dossier.missingDocuments).toEqual(['contract', 'cin', 'diploma']);
    expect(dossier.missingProfileFields).toEqual(['employeeId', 'hireDate', 'specialization']);
    expect(dossier.missingItems).toEqual(['contract', 'cin', 'diploma', 'employeeId', 'hireDate', 'specialization']);
  });

  it('does not treat optional fields as blockers', () => {
    const dossier = computeTeacherDossier({ ...completeInput, documents: { contract: true, cin: true, diploma: true } });

    expect(dossier.complete).toBe(true);
  });

  it('summarizes dossiers into complete / partial / no-documents buckets', () => {
    const complete = computeTeacherDossier(completeInput);
    const partial = computeTeacherDossier({ ...completeInput, documents: { contract: true } });
    const none = computeTeacherDossier({ documents: {}, employeeId: null, hireDate: null, specialization: null });

    const summary = summarizeTeacherDossiers([complete, partial, none, none]);

    expect(summary).toEqual({ complete: 1, partial: 1, noDocuments: 2, toComplete: 3 });
    // "Sans pièces" is a subset of "à régulariser", never double-counted.
    expect(summary.partial + summary.noDocuments).toBe(summary.toComplete);
  });

  it('counts "1 élément manquant" as one missing item, not a whole dossier', () => {
    // Only the contract is missing: the count is a number of items, which is
    // what the UI pluralizes (1 élément manquant / N éléments manquants).
    const dossier = computeTeacherDossier({
      documents: { cin: true, diploma: true },
      employeeId: completeInput.employeeId,
      hireDate: completeInput.hireDate,
      specialization: completeInput.specialization,
    });

    expect(dossier.complete).toBe(false);
    expect(dossier.missingItems).toHaveLength(1);
    expect(dossier.missingItems).toEqual(['contract']);
  });
});

describe('teacher workload math', () => {
  it('parses HH:MM safely', () => {
    expect(parseTimeToMinutes('08:30')).toBe(510);
    expect(parseTimeToMinutes('8:05')).toBe(485);
    expect(parseTimeToMinutes('24:00')).toBeNull();
    expect(parseTimeToMinutes('08:75')).toBeNull();
    expect(parseTimeToMinutes(null)).toBeNull();
    expect(parseTimeToMinutes('not-a-time')).toBeNull();
  });

  it('computes slot durations and refuses inverted ranges', () => {
    expect(slotDurationHours({ startTime: '08:00', endTime: '10:00' })).toBe(2);
    expect(slotDurationHours({ startTime: '10:00', endTime: '08:00' })).toBe(0);
    expect(slotDurationHours({ startTime: '08:00', endTime: '08:00' })).toBe(0);
  });

  it('sums weekly hours', () => {
    expect(sumWeeklyHours([
      { startTime: '08:00', endTime: '09:30' },
      { startTime: '10:00', endTime: '11:00' },
    ])).toBe(2.5);
  });

  it('reports "no timetable" instead of a misleading 0h average', () => {
    const none = summarizeWorkload(0, 0, 4);

    expect(none.hasTimetable).toBe(false);
    expect(none.averageWeeklyHours).toBeNull();
    expect(none.source).toBe('none');

    const some = summarizeWorkload(10, 2, 4);

    expect(some.hasTimetable).toBe(true);
    expect(some.averageWeeklyHours).toBe(5);
    expect(some.source).toBe('published_timetable');
  });
});
