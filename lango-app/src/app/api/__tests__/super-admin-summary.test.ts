import { describe, expect, it } from 'vitest';
import { buildAttendanceInspection, openInvoiceBalance } from '@/app/api/super-admin/summary/route';

describe('super-admin summary truthfulness', () => {
  it('leaves attendance unknown when the school has no recorded marks', () => {
    const points = buildAttendanceInspection([], new Date('2026-09-23T12:00:00.000Z'));

    expect(points).toHaveLength(7);
    expect(points.every(point => point.studentRate === null && point.employeeRate === null)).toBe(true);
  });

  it('calculates attendance from recorded present and late marks', () => {
    const points = buildAttendanceInspection([
      { date: '2026-09-23', status: 'present', count: 7 },
      { date: '2026-09-23', status: 'late', count: 1 },
      { date: '2026-09-23', status: 'absent', count: 2 },
    ], new Date('2026-09-23T12:00:00.000Z'));

    expect(points.at(-1)).toMatchObject({ date: '23/09', studentRate: 80, employeeRate: null });
  });

  it('uses the open invoice balance without allowing a negative remainder', () => {
    expect(openInvoiceBalance(2_162_000, 1_000_000)).toBe(1_162_000);
    expect(openInvoiceBalance(1_000, 1_500)).toBe(0);
  });
});
