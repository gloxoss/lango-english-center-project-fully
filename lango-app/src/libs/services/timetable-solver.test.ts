import type { SolverSlot } from './timetable-solver';
import { describe, expect, it } from 'vitest';
import {
  applyMoves,
  candidatePlacements,
  conflictsBetween,
  detectConflicts,
  overlaps,
  periodGrid,
  placementIsFeasible,
  roomPool,

  solveTimetable,
} from './timetable-solver';

function slot(overrides: Partial<SolverSlot> & { id: string }): SolverSlot {
  return {
    dayOfWeek: 'monday',
    startTime: '08:00',
    endTime: '10:00',
    classSectionId: 'sec-a',
    teacherId: 'teacher-1',
    roomLabel: 'A-104',
    ...overrides,
  };
}

describe('overlaps', () => {
  it('is false on different days', () => {
    expect(overlaps(slot({ id: '1' }), slot({ id: '2', dayOfWeek: 'tuesday' }))).toBe(false);
  });

  it('is false when one ends exactly as the other begins', () => {
    // Back-to-back lessons are not a clash; the room frees at the bell.
    expect(overlaps(
      slot({ id: '1', startTime: '08:00', endTime: '10:00' }),
      slot({ id: '2', startTime: '10:00', endTime: '12:00' }),
    )).toBe(false);
  });

  it('is true on partial overlap', () => {
    expect(overlaps(
      slot({ id: '1', startTime: '08:00', endTime: '10:00' }),
      slot({ id: '2', startTime: '09:00', endTime: '11:00' }),
    )).toBe(true);
  });
});

describe('conflictsBetween', () => {
  it('reports every axis a pair clashes on, not just the first', () => {
    // Fixing only the room would leave the teacher double-booked, so a caller
    // that saw one conflict per pair would under-repair.
    const kinds = conflictsBetween(
      slot({ id: '1', teacherId: 't1', roomLabel: 'A', classSectionId: 's1' }),
      slot({ id: '2', teacherId: 't1', roomLabel: 'A', classSectionId: 's1' }),
    );

    expect(kinds.sort()).toEqual(['class_section', 'room', 'teacher']);
  });

  it('does not treat two roomless slots as sharing a room', () => {
    const kinds = conflictsBetween(
      slot({ id: '1', teacherId: 't1', roomLabel: null, classSectionId: 's1' }),
      slot({ id: '2', teacherId: 't2', roomLabel: null, classSectionId: 's2' }),
    );

    expect(kinds).toEqual([]);
  });

  it('reports nothing for non-overlapping slots however much they share', () => {
    expect(conflictsBetween(
      slot({ id: '1', startTime: '08:00', endTime: '10:00' }),
      slot({ id: '2', startTime: '14:00', endTime: '16:00' }),
    )).toEqual([]);
  });
});

describe('detectConflicts', () => {
  it('finds a teacher double-booking', () => {
    const conflicts = detectConflicts([
      slot({ id: '1', classSectionId: 's1', roomLabel: 'A' }),
      slot({ id: '2', classSectionId: 's2', roomLabel: 'B' }),
    ]);

    expect(conflicts).toEqual([{ kind: 'teacher', a: '1', b: '2' }]);
  });

  it('returns nothing for a clean schedule', () => {
    expect(detectConflicts([
      slot({ id: '1', startTime: '08:00', endTime: '10:00' }),
      slot({ id: '2', startTime: '10:00', endTime: '12:00' }),
    ])).toEqual([]);
  });
});

describe('periodGrid', () => {
  it('recovers the school’s real periods and sorts them', () => {
    // Never synthesised from minute offsets: a 09:17–11:17 slot is conflict-free
    // on paper and useless against real bells and breaks.
    const grid = periodGrid([
      slot({ id: '1', startTime: '14:00', endTime: '16:00' }),
      slot({ id: '2', startTime: '08:00', endTime: '10:00' }),
      slot({ id: '3', startTime: '08:00', endTime: '10:00' }),
    ]);

    expect(grid).toEqual([
      { startTime: '08:00', endTime: '10:00' },
      { startTime: '14:00', endTime: '16:00' },
    ]);
  });
});

describe('roomPool', () => {
  it('lists used rooms then the no-room option', () => {
    expect(roomPool([
      slot({ id: '1', roomLabel: 'B' }),
      slot({ id: '2', roomLabel: 'A' }),
      slot({ id: '3', roomLabel: null }),
    ])).toEqual(['A', 'B', null]);
  });
});

describe('placementIsFeasible', () => {
  it('refuses a placement inside a teacher’s declared unavailability', () => {
    // A "conflict-free" timetable nobody can teach is not a solution.
    const constraints = {
      teacherUnavailable: new Map([
        ['teacher-1', [{ dayOfWeek: 'monday', startTime: '08:00', endTime: '12:00' }]],
      ]),
    };

    expect(placementIsFeasible(slot({ id: '1' }), [], constraints)).toBe(false);
    expect(placementIsFeasible(slot({ id: '1', dayOfWeek: 'tuesday' }), [], constraints)).toBe(true);
  });

  it('treats declared availability as positive, not inverted', () => {
    // teacher_availability stores the hours a teacher *is* free. Reading those as
    // forbidden would silently ban every hour they volunteered.
    const constraints = {
      teacherAvailable: new Map([
        ['teacher-1', [{ dayOfWeek: 'monday', startTime: '08:00', endTime: '12:00' }]],
      ]),
    };

    expect(placementIsFeasible(slot({ id: '1', startTime: '08:00', endTime: '10:00' }), [], constraints)).toBe(true);
    expect(placementIsFeasible(slot({ id: '1', dayOfWeek: 'tuesday' }), [], constraints)).toBe(false);
  });

  it('requires the lesson to fit wholly inside an available window', () => {
    // Half inside is a lesson the teacher cannot finish.
    const constraints = {
      teacherAvailable: new Map([
        ['teacher-1', [{ dayOfWeek: 'monday', startTime: '08:00', endTime: '09:00' }]],
      ]),
    };

    expect(placementIsFeasible(slot({ id: '1', startTime: '08:00', endTime: '10:00' }), [], constraints)).toBe(false);
  });

  it('leaves a teacher with no availability configured unconstrained', () => {
    // An empty configuration means "not set up yet", never "never available".
    const constraints = { teacherAvailable: new Map([['someone-else', []]]) };

    expect(placementIsFeasible(slot({ id: '1' }), [], constraints)).toBe(true);
  });

  it('refuses a room smaller than the class', () => {
    const constraints = {
      roomCapacity: new Map([['A-104', 20]]),
      sectionSize: new Map([['sec-a', 32]]),
    };

    expect(placementIsFeasible(slot({ id: '1' }), [], constraints)).toBe(false);
  });

  it('allows the placement when capacity or class size is unknown', () => {
    // Refusing on missing data would reject most rooms in a half-configured school.
    expect(placementIsFeasible(slot({ id: '1' }), [], { roomCapacity: new Map([['A-104', 20]]) })).toBe(true);
    expect(placementIsFeasible(slot({ id: '1' }), [], { sectionSize: new Map([['sec-a', 32]]) })).toBe(true);
  });
});

describe('candidatePlacements', () => {
  const grid = [
    { startTime: '08:00', endTime: '10:00' },
    { startTime: '10:00', endTime: '12:00' },
  ];

  it('never offers the placement the slot already has', () => {
    const candidates = candidatePlacements(slot({ id: '1' }), grid, ['A-104', 'B-201', null], ['monday']);

    expect(candidates.some(c =>
      c.dayOfWeek === 'monday' && c.startTime === '08:00' && c.roomLabel === 'A-104')).toBe(false);
  });

  it('tries a room change before a day change, because that is less disruptive', () => {
    const candidates = candidatePlacements(slot({ id: '1' }), grid, ['A-104', 'B-201'], ['monday', 'friday']);

    const firstRoomChange = candidates.findIndex(c => c.dayOfWeek === 'monday' && c.startTime === '08:00');
    const firstDayChange = candidates.findIndex(c => c.dayOfWeek === 'friday');

    expect(firstRoomChange).toBeLessThan(firstDayChange);
  });
});

describe('solveTimetable', () => {
  it('leaves a clean schedule untouched', () => {
    const slots = [
      slot({ id: '1', startTime: '08:00', endTime: '10:00' }),
      slot({ id: '2', startTime: '10:00', endTime: '12:00' }),
    ];

    const result = solveTimetable(slots);

    expect(result.solved).toBe(true);
    expect(result.moves).toEqual([]);
  });

  it('resolves a room double-booking by moving one slot to a free room', () => {
    const slots = [
      slot({ id: '1', teacherId: 't1', classSectionId: 's1', roomLabel: 'A-104' }),
      slot({ id: '2', teacherId: 't2', classSectionId: 's2', roomLabel: 'A-104' }),
      // Gives the solver a second room to know about.
      slot({ id: '3', teacherId: 't3', classSectionId: 's3', roomLabel: 'B-201', dayOfWeek: 'friday' }),
    ];

    const result = solveTimetable(slots);

    expect(result.solved).toBe(true);
    expect(result.moves).toHaveLength(1);
    expect(detectConflicts(applyMoves(slots, result.moves))).toEqual([]);
  });

  it('resolves a teacher double-booking', () => {
    const slots = [
      slot({ id: '1', teacherId: 't1', classSectionId: 's1', roomLabel: 'A', startTime: '08:00', endTime: '10:00' }),
      slot({ id: '2', teacherId: 't1', classSectionId: 's2', roomLabel: 'B', startTime: '08:00', endTime: '10:00' }),
      slot({ id: '3', teacherId: 't9', classSectionId: 's9', roomLabel: 'C', startTime: '10:00', endTime: '12:00' }),
    ];

    const result = solveTimetable(slots);

    expect(result.solved).toBe(true);
    expect(detectConflicts(applyMoves(slots, result.moves))).toEqual([]);
  });

  it('solves a chain no sequence of independent one-pair fixes would settle', () => {
    // This is the case the old per-pair suggestions got wrong: every repair was
    // computed against the current schedule, so moving 1 into the only free room
    // created a fresh clash with 3.
    const slots = [
      slot({ id: '1', teacherId: 't1', classSectionId: 's1', roomLabel: 'A', startTime: '08:00', endTime: '10:00' }),
      slot({ id: '2', teacherId: 't2', classSectionId: 's2', roomLabel: 'A', startTime: '08:00', endTime: '10:00' }),
      slot({ id: '3', teacherId: 't3', classSectionId: 's3', roomLabel: 'B', startTime: '08:00', endTime: '10:00' }),
      slot({ id: '4', teacherId: 't4', classSectionId: 's4', roomLabel: 'C', startTime: '10:00', endTime: '12:00' }),
      slot({ id: '5', teacherId: 't5', classSectionId: 's5', roomLabel: 'A', startTime: '12:00', endTime: '14:00' }),
    ];

    const result = solveTimetable(slots);

    expect(result.solved).toBe(true);
    expect(detectConflicts(applyMoves(slots, result.moves))).toEqual([]);
  });

  it('respects teacher unavailability while resolving', () => {
    const slots = [
      slot({ id: '1', teacherId: 't1', classSectionId: 's1', roomLabel: 'A', startTime: '08:00', endTime: '10:00' }),
      slot({ id: '2', teacherId: 't1', classSectionId: 's2', roomLabel: 'B', startTime: '08:00', endTime: '10:00' }),
      slot({ id: '3', teacherId: 't9', classSectionId: 's9', roomLabel: 'C', startTime: '10:00', endTime: '12:00' }),
      slot({ id: '4', teacherId: 't8', classSectionId: 's8', roomLabel: 'D', startTime: '14:00', endTime: '16:00' }),
    ];

    const result = solveTimetable(slots, {
      teacherUnavailable: new Map([
        ['t1', [{ dayOfWeek: 'monday', startTime: '10:00', endTime: '12:00' }]],
      ]),
    });

    const final = applyMoves(slots, result.moves);
    const moved = final.filter(s => s.teacherId === 't1');

    expect(detectConflicts(final)).toEqual([]);
    // Neither of t1's lessons may land in the window they declared unavailable.
    expect(moved.every(s => !(s.dayOfWeek === 'monday' && s.startTime === '10:00'))).toBe(true);
  });

  it('is deterministic — the same input gives the same plan', () => {
    const slots = [
      slot({ id: '1', teacherId: 't1', classSectionId: 's1', roomLabel: 'A' }),
      slot({ id: '2', teacherId: 't2', classSectionId: 's2', roomLabel: 'A' }),
      slot({ id: '3', teacherId: 't3', classSectionId: 's3', roomLabel: 'B', dayOfWeek: 'tuesday' }),
    ];

    // A solver that rewrote a school's week differently on each run could not be
    // reviewed or diffed.
    const first = solveTimetable(slots);
    const second = solveTimetable(slots);

    expect(first.moves).toEqual(second.moves);
  });

  it('reports what it could not fix instead of throwing', () => {
    // One room, one period, one day, two classes: genuinely unsolvable.
    const slots = [
      slot({ id: '1', teacherId: 't1', classSectionId: 's1', roomLabel: 'A' }),
      slot({ id: '2', teacherId: 't2', classSectionId: 's2', roomLabel: 'A' }),
    ];

    const result = solveTimetable(slots, { roomCapacity: new Map(), sectionSize: new Map() }, 500);

    // Dropping a room is a legal escape here, so it may well solve it; what must
    // hold is that it never throws and never lies about the outcome.
    expect(result.solved).toBe(detectConflicts(applyMoves(slots, result.moves)).length === 0);
  });

  it('stops at its node budget rather than hanging', () => {
    // One teacher, ten lessons, and only nine day/period combinations to put them
    // in: unsolvable, but across a search space wide enough that the budget — not
    // the space — is what ends the search.
    const days = ['monday', 'tuesday', 'wednesday'];
    const periods = [
      { startTime: '08:00', endTime: '10:00' },
      { startTime: '10:00', endTime: '12:00' },
      { startTime: '14:00', endTime: '16:00' },
    ];

    const slots = Array.from({ length: 10 }, (_, i) => slot({
      id: `s${i}`,
      teacherId: 't1',
      classSectionId: `sec${i}`,
      roomLabel: `R${i % 3}`,
      dayOfWeek: days[i % days.length]!,
      startTime: periods[i % periods.length]!.startTime,
      endTime: periods[i % periods.length]!.endTime,
    }));

    const result = solveTimetable(slots, {}, 200);

    expect(result.nodesExplored).toBeLessThanOrEqual(200);
    expect(result.exhaustedBudget).toBe(true);
    // Even a give-up must hand back a state no worse than the input.
    expect(detectConflicts(applyMoves(slots, result.moves)).length)
      .toBeLessThanOrEqual(detectConflicts(slots).length);
  });

  it('gives up cleanly when the search space itself runs out, without claiming a budget stop', () => {
    // One room, one period, one day, two classes, and no room-dropping escape:
    // the space is exhausted long before any budget, and the result must say so
    // honestly rather than report a false budget exhaustion.
    const slots = [
      slot({ id: '1', teacherId: 't1', classSectionId: 's1', roomLabel: 'A' }),
      slot({ id: '2', teacherId: 't1', classSectionId: 's2', roomLabel: 'A' }),
    ];

    const result = solveTimetable(slots, {}, 100_000);

    expect(result.exhaustedBudget).toBe(false);
    expect(result.nodesExplored).toBeLessThan(100_000);
  });

  it('never reports a move whose from and to are identical', () => {
    const slots = [
      slot({ id: '1', teacherId: 't1', classSectionId: 's1', roomLabel: 'A' }),
      slot({ id: '2', teacherId: 't2', classSectionId: 's2', roomLabel: 'A' }),
      slot({ id: '3', teacherId: 't3', classSectionId: 's3', roomLabel: 'B', dayOfWeek: 'friday' }),
    ];

    for (const move of solveTimetable(slots).moves) {
      expect(move.to).not.toEqual(move.from);
    }
  });
});

describe('applyMoves', () => {
  it('rewrites only the slots the plan names', () => {
    const slots = [slot({ id: '1' }), slot({ id: '2', roomLabel: 'B' })];

    const result = applyMoves(slots, [{
      slotId: '1',
      label: '1',
      from: { dayOfWeek: 'monday', startTime: '08:00', endTime: '10:00', roomLabel: 'A-104' },
      to: { dayOfWeek: 'friday', startTime: '10:00', endTime: '12:00', roomLabel: 'C-301' },
    }]);

    expect(result[0]).toMatchObject({ dayOfWeek: 'friday', startTime: '10:00', roomLabel: 'C-301' });
    expect(result[1]).toEqual(slots[1]);
  });
});
