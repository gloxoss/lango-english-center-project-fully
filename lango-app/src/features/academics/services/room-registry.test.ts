import type { RoomRow, RoomScheduleEntry } from './room-registry';
import { describe, expect, it } from 'vitest';
import {
  attachOccupancy,
  clockOf,
  deriveOccupancy,
  normalizeLabel,
  roomLabelKeys,

  slotCovers,
  weekdayOf,
} from './room-registry';

function room(overrides: Partial<RoomRow> = {}): RoomRow {
  return {
    id: 'room-1',
    name: 'Salle 104',
    code: 'A-104',
    building: 'Bâtiment Principal',
    floor: '1er Étage',
    capacity: 32,
    roomType: 'Classroom',
    equipment: [],
    status: 'available',
    isActive: true,
    ...overrides,
  };
}

function slot(startTime: string, endTime: string, course = '2BAC-A (Maths)'): RoomScheduleEntry {
  return { startTime, endTime, time: `${startTime} - ${endTime}`, course };
}

describe('slotCovers', () => {
  it('treats the interval as half-open so a class ending at 10:00 frees the room', () => {
    expect(slotCovers(slot('08:00', '10:00'), '09:59')).toBe(true);
    expect(slotCovers(slot('08:00', '10:00'), '10:00')).toBe(false);
  });

  it('includes the exact start minute', () => {
    expect(slotCovers(slot('08:00', '10:00'), '08:00')).toBe(true);
  });

  it('compares zero-padded times chronologically, not numerically', () => {
    // '9:00' would sort after '10:00' lexically; the padded form must not.
    expect(slotCovers(slot('08:00', '10:00'), '08:05')).toBe(true);
    expect(slotCovers(slot('14:00', '16:00'), '09:00')).toBe(false);
  });
});

describe('deriveOccupancy', () => {
  it('reports Occupied with the covering class when a slot is running', () => {
    const result = deriveOccupancy(room(), [slot('08:00', '10:00', '2BAC-A (Maths)')], '09:00');

    expect(result.occupancyStatus).toBe('Occupied');
    expect(result.currentClass).toBe('2BAC-A (Maths)');
  });

  it('reports Available between classes', () => {
    const result = deriveOccupancy(room(), [slot('08:00', '10:00'), slot('14:00', '16:00')], '12:00');

    expect(result.occupancyStatus).toBe('Available');
    expect(result.currentClass).toBeNull();
  });

  it('reports Maintenance even when a class is scheduled, so the conflict is visible', () => {
    const result = deriveOccupancy(room({ status: 'maintenance' }), [slot('08:00', '10:00')], '09:00');

    expect(result.occupancyStatus).toBe('Maintenance');
    expect(result.currentClass).toBeNull();
  });

  it('reports Available for a room with no timetable at all', () => {
    expect(deriveOccupancy(room(), [], '09:00').occupancyStatus).toBe('Available');
  });
});

describe('room label matching', () => {
  it('normalizes case and runs of whitespace', () => {
    expect(normalizeLabel('  Salle   104 ')).toBe('salle 104');
    expect(normalizeLabel(null)).toBe('');
  });

  it('matches a slot on either the room name or its code', () => {
    expect(roomLabelKeys(room())).toEqual(['salle 104', 'a-104']);
  });

  it('does not double-count a room whose code equals its name', () => {
    expect(roomLabelKeys(room({ name: 'AMPHI-1', code: 'amphi-1' }))).toEqual(['amphi-1']);
  });

  it('drops a missing code rather than matching every unlabelled slot', () => {
    expect(roomLabelKeys(room({ code: null }))).toEqual(['salle 104']);
  });
});

describe('attachOccupancy', () => {
  const at = (hhmm: string) => new Date(`2026-09-10T${hhmm}:00`);

  it('attaches the schedule found under either label, sorted by start time', () => {
    const byLabel = new Map<string, RoomScheduleEntry[]>([
      ['salle 104', [slot('14:00', '16:00', 'Philo')]],
      ['a-104', [slot('08:00', '10:00', 'Maths')]],
    ]);

    const [result] = attachOccupancy([room()], byLabel, at('09:00'));

    expect(result!.schedule.map(s => s.course)).toEqual(['Maths', 'Philo']);
    expect(result!.occupancyStatus).toBe('Occupied');
    expect(result!.currentClass).toBe('Maths');
  });

  it('leaves a room with no matching label empty rather than borrowing another room’s slots', () => {
    const byLabel = new Map<string, RoomScheduleEntry[]>([['labo physique 2', [slot('08:00', '10:00')]]]);

    const [result] = attachOccupancy([room()], byLabel, at('09:00'));

    expect(result!.schedule).toEqual([]);
    expect(result!.occupancyStatus).toBe('Available');
  });

  it('matches a slot whose label differs only in case and spacing', () => {
    const byLabel = new Map<string, RoomScheduleEntry[]>([['salle 104', [slot('08:00', '10:00')]]]);

    const [result] = attachOccupancy([room({ name: '  SALLE  104 ', code: null })], byLabel, at('09:00'));

    expect(result!.occupancyStatus).toBe('Occupied');
  });
});

describe('weekdayOf / clockOf', () => {
  it('maps Date#getDay() onto the day_of_week enum values', () => {
    // 2026-09-10 is a Thursday; 2026-09-13 a Sunday.
    expect(weekdayOf(new Date('2026-09-10T09:00:00'))).toBe('thursday');
    expect(weekdayOf(new Date('2026-09-13T09:00:00'))).toBe('sunday');
  });

  it('zero-pads the clock so it compares against stored slot times', () => {
    expect(clockOf(new Date('2026-09-10T08:05:00'))).toBe('08:05');
    expect(clockOf(new Date('2026-09-10T14:30:00'))).toBe('14:30');
  });
});
