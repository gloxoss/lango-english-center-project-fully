/**
 * Timetable constraint solver.
 *
 * The existing conflict endpoint detects clashes and offers fixes one pair at a
 * time, each computed against the *current* schedule. That is the flaw this
 * module exists to close: apply two such suggestions in sequence and the second
 * can reintroduce a clash the first resolved, because neither knew about the
 * other. Resolving a timetable is a search over a *combination* of moves, not a
 * list of independent repairs.
 *
 * Pure and deterministic by design:
 *   no database access, so the search is testable on fixtures;
 *   candidates are generated in a sorted order and the budget is fixed, so the
 *     same input always yields the same plan. A solver that rewrites a school's
 *     timetable differently on each run cannot be reviewed, diffed or trusted.
 */

export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type SolverSlot = {
  id: string;
  dayOfWeek: Weekday | string;
  /** "HH:MM", zero-padded, so lexical comparison is chronological. */
  startTime: string;
  endTime: string;
  classSectionId: string;
  teacherId: string;
  roomLabel: string | null;
  /** Human label, carried through so a plan can be read without a second lookup. */
  label?: string;
};

export type ConflictKind = 'teacher' | 'room' | 'class_section';

export type Conflict = {
  kind: ConflictKind;
  a: string;
  b: string;
};

/** Two slots overlap when they share a day and their time ranges intersect. */
export function overlaps(a: SolverSlot, b: SolverSlot): boolean {
  return a.dayOfWeek === b.dayOfWeek && a.startTime < b.endTime && b.startTime < a.endTime;
}

/**
 * Every hard clash between two overlapping slots.
 *
 * A pair can clash on more than one axis at once (same teacher *and* same room),
 * and both are reported: fixing only the room would leave the teacher
 * double-booked, so a caller that sees one conflict per pair would under-repair.
 */
export function conflictsBetween(a: SolverSlot, b: SolverSlot): ConflictKind[] {
  if (!overlaps(a, b)) {
    return [];
  }

  const kinds: ConflictKind[] = [];
  if (a.teacherId === b.teacherId) {
    kinds.push('teacher');
  }
  if (a.classSectionId === b.classSectionId) {
    kinds.push('class_section');
  }
  // Only a real, shared room label clashes. Two slots with no room are not in
  // the same room — they simply have no room recorded.
  if (a.roomLabel && b.roomLabel && a.roomLabel === b.roomLabel) {
    kinds.push('room');
  }

  return kinds;
}

/** All conflicts in a schedule, in a stable order. */
export function detectConflicts(slots: SolverSlot[]): Conflict[] {
  const out: Conflict[] = [];

  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      for (const kind of conflictsBetween(slots[i]!, slots[j]!)) {
        out.push({ kind, a: slots[i]!.id, b: slots[j]!.id });
      }
    }
  }

  return out;
}

export type Period = { startTime: string; endTime: string };

/**
 * The school's real period grid, recovered from the slots already scheduled.
 *
 * Deliberately not synthesised from arbitrary minute offsets: a generated
 * 09:17–11:17 slot is conflict-free on paper and useless in practice, because it
 * ignores bells, breaks and the hours staff are actually present. If a period is
 * not already in use somewhere in the timetable, the solver will not invent it.
 */
export function periodGrid(slots: SolverSlot[]): Period[] {
  const seen = new Map<string, Period>();

  for (const slot of slots) {
    const key = `${slot.startTime}-${slot.endTime}`;
    if (!seen.has(key)) {
      seen.set(key, { startTime: slot.startTime, endTime: slot.endTime });
    }
  }

  return [...seen.values()].sort((x, y) =>
    x.startTime.localeCompare(y.startTime) || x.endTime.localeCompare(y.endTime));
}

/** Every room label in use, sorted. Plus `null`, meaning "no room assigned". */
export function roomPool(slots: SolverSlot[]): (string | null)[] {
  const rooms = [...new Set(slots.map(s => s.roomLabel).filter((r): r is string => Boolean(r)))].sort();
  return [...rooms, null];
}

export type SolverConstraints = {
  /**
   * Day + period combinations a teacher may not be scheduled into, keyed by
   * teacher id. A solver that ignores declared unavailability produces a
   * "conflict-free" timetable nobody can actually teach.
   */
  teacherUnavailable?: Map<string, { dayOfWeek: string; startTime: string; endTime: string }[]>;
  /**
   * Windows a teacher *is* available in — the positive form, which is how
   * `teacher_availability` actually stores it.
   *
   * Kept as a separate option rather than inverted by the caller, because
   * inverting it is exactly the mistake that would silently forbid every hour a
   * teacher declared themselves free. A teacher absent from this map has no
   * availability configured and is therefore unconstrained: an empty
   * configuration means "not set up yet", never "never available".
   */
  teacherAvailable?: Map<string, { dayOfWeek: string; startTime: string; endTime: string }[]>;
  /** Seats per room, used to refuse a room too small for the class. */
  roomCapacity?: Map<string, number>;
  /** Students per class section, compared against room capacity. */
  sectionSize?: Map<string, number>;
  /** Days the solver may use. Defaults to the days already in the schedule. */
  allowedDays?: string[];
};

export type Move = {
  slotId: string;
  label: string;
  from: { dayOfWeek: string; startTime: string; endTime: string; roomLabel: string | null };
  to: { dayOfWeek: string; startTime: string; endTime: string; roomLabel: string | null };
};

export type SolveResult = {
  /** Empty when the schedule was already conflict-free. */
  moves: Move[];
  /** Conflicts the search could not clear within its budget. */
  unresolved: Conflict[];
  /** True only when `unresolved` is empty. */
  solved: boolean;
  /** Candidate placements examined, for reporting and for budget transparency. */
  nodesExplored: number;
  /** True when the search stopped because it hit the node budget. */
  exhaustedBudget: boolean;
};

/** Bounds the search so a pathological timetable cannot hang a request. */
export const DEFAULT_NODE_BUDGET = 20_000;

function withinUnavailability(
  constraints: SolverConstraints,
  teacherId: string,
  placement: { dayOfWeek: string; startTime: string; endTime: string },
): boolean {
  const windows = constraints.teacherUnavailable?.get(teacherId);
  if (!windows) {
    return false;
  }

  return windows.some(w =>
    w.dayOfWeek === placement.dayOfWeek
    && w.startTime < placement.endTime
    && placement.startTime < w.endTime);
}

/**
 * True when the placement sits wholly inside one of the teacher's declared
 * available windows — or when they declared none, in which case they are
 * unconstrained rather than unavailable.
 *
 * Containment, not mere overlap: a lesson half inside a free window is a lesson
 * the teacher cannot finish.
 */
function withinAvailability(
  constraints: SolverConstraints,
  teacherId: string,
  placement: { dayOfWeek: string; startTime: string; endTime: string },
): boolean {
  const windows = constraints.teacherAvailable?.get(teacherId);
  if (!windows || windows.length === 0) {
    return true;
  }

  return windows.some(w =>
    w.dayOfWeek === placement.dayOfWeek
    && w.startTime <= placement.startTime
    && placement.endTime <= w.endTime);
}

function roomTooSmall(
  constraints: SolverConstraints,
  classSectionId: string,
  roomLabel: string | null,
): boolean {
  if (!roomLabel) {
    return false;
  }

  const capacity = constraints.roomCapacity?.get(roomLabel);
  const size = constraints.sectionSize?.get(classSectionId);

  // Unknown capacity or unknown class size is not a violation — refusing on
  // missing data would reject most rooms in a half-configured school.
  if (capacity === undefined || size === undefined) {
    return false;
  }

  return capacity < size;
}

/**
 * Whether `candidate` can sit in the schedule alongside `others` without
 * breaking a hard constraint.
 */
export function placementIsFeasible(
  candidate: SolverSlot,
  others: SolverSlot[],
  constraints: SolverConstraints = {},
): boolean {
  if (withinUnavailability(constraints, candidate.teacherId, candidate)) {
    return false;
  }

  if (!withinAvailability(constraints, candidate.teacherId, candidate)) {
    return false;
  }

  if (roomTooSmall(constraints, candidate.classSectionId, candidate.roomLabel)) {
    return false;
  }

  return others.every(other => conflictsBetween(candidate, other).length === 0);
}

/**
 * Moves a slot is allowed to take, cheapest first.
 *
 * Ordered so the least disruptive change is tried first: keep the day and time
 * and only change room, then keep the day and move period, then change day last.
 * A timetable is a social artefact — moving a lesson to another day costs a
 * teacher and thirty families more than moving it down the corridor.
 */
export function candidatePlacements(
  slot: SolverSlot,
  grid: Period[],
  rooms: (string | null)[],
  days: string[],
): SolverSlot[] {
  const out: SolverSlot[] = [];
  const push = (dayOfWeek: string, period: Period, roomLabel: string | null) => {
    if (dayOfWeek === slot.dayOfWeek && period.startTime === slot.startTime
      && period.endTime === slot.endTime && roomLabel === slot.roomLabel) {
      return; // the placement it already has
    }
    out.push({ ...slot, dayOfWeek, startTime: period.startTime, endTime: period.endTime, roomLabel });
  };

  const samePeriod: Period = { startTime: slot.startTime, endTime: slot.endTime };

  // 1. Same day, same period, different room.
  for (const room of rooms) {
    push(slot.dayOfWeek, samePeriod, room);
  }

  // 2. Same day, different period, keeping the room.
  for (const period of grid) {
    push(slot.dayOfWeek, period, slot.roomLabel);
  }

  // 3. Same day, different period and room.
  for (const period of grid) {
    for (const room of rooms) {
      push(slot.dayOfWeek, period, room);
    }
  }

  // 4. Another day, last resort.
  for (const day of days) {
    if (day === slot.dayOfWeek) {
      continue;
    }
    for (const period of grid) {
      for (const room of rooms) {
        push(day, period, room);
      }
    }
  }

  return out;
}

/**
 * How constrained a slot is — the number of conflicts it participates in.
 * The search repairs the most-conflicted slot first, which is the standard
 * most-constrained-variable heuristic and keeps the branching factor down.
 */
function conflictCountBySlot(slots: SolverSlot[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const conflict of detectConflicts(slots)) {
    counts.set(conflict.a, (counts.get(conflict.a) ?? 0) + 1);
    counts.set(conflict.b, (counts.get(conflict.b) ?? 0) + 1);
  }

  return counts;
}

/**
 * Searches for a set of moves that makes the schedule conflict-free.
 *
 * Backtracking over the most-conflicted slot first, each slot tried against its
 * candidate placements in least-disruptive order. Only slots that actually
 * participate in a conflict are moved: a solver free to relocate every lesson
 * would produce an unreviewable diff and an unrecognisable week.
 *
 * On failure it returns the best state it reached plus the conflicts it could not
 * clear, rather than throwing. A partial improvement an admin can inspect beats
 * an error that leaves the clashes in place and says nothing about why.
 */
export function solveTimetable(
  slots: SolverSlot[],
  constraints: SolverConstraints = {},
  nodeBudget: number = DEFAULT_NODE_BUDGET,
): SolveResult {
  const days = constraints.allowedDays
    ?? [...new Set(slots.map(s => s.dayOfWeek))].sort();
  const grid = periodGrid(slots);
  const rooms = roomPool(slots);

  const original = new Map(slots.map(s => [s.id, s]));
  let nodesExplored = 0;
  let exhaustedBudget = false;

  // Best-so-far, so a failed search still returns progress rather than nothing.
  let best: SolverSlot[] = [...slots];
  let bestConflictCount = detectConflicts(slots).length;

  function search(current: SolverSlot[]): SolverSlot[] | null {
    const conflicts = detectConflicts(current);

    if (conflicts.length < bestConflictCount) {
      bestConflictCount = conflicts.length;
      best = [...current];
    }

    if (conflicts.length === 0) {
      return current;
    }

    if (nodesExplored >= nodeBudget) {
      exhaustedBudget = true;
      return null;
    }

    const counts = conflictCountBySlot(current);
    // Most-conflicted first; id as the tiebreak so the order is deterministic.
    const ordered = [...counts.entries()]
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
      .map(([id]) => id);

    for (const slotId of ordered) {
      const index = current.findIndex(s => s.id === slotId);
      if (index === -1) {
        continue;
      }

      const slot = current[index]!;
      const others = current.filter(s => s.id !== slotId);

      for (const candidate of candidatePlacements(slot, grid, rooms, days)) {
        if (nodesExplored >= nodeBudget) {
          exhaustedBudget = true;
          return null;
        }
        nodesExplored += 1;

        if (!placementIsFeasible(candidate, others, constraints)) {
          continue;
        }

        const next = [...current];
        next[index] = candidate;

        const solved = search(next);
        if (solved) {
          return solved;
        }
      }
    }

    return null;
  }

  const solution = search([...slots]);
  const finalSlots = solution ?? best;

  const moves: Move[] = [];
  for (const slot of finalSlots) {
    const before = original.get(slot.id);
    if (!before) {
      continue;
    }
    if (before.dayOfWeek === slot.dayOfWeek && before.startTime === slot.startTime
      && before.endTime === slot.endTime && before.roomLabel === slot.roomLabel) {
      continue;
    }

    moves.push({
      slotId: slot.id,
      label: slot.label ?? slot.id,
      from: {
        dayOfWeek: before.dayOfWeek,
        startTime: before.startTime,
        endTime: before.endTime,
        roomLabel: before.roomLabel,
      },
      to: {
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        roomLabel: slot.roomLabel,
      },
    });
  }

  const unresolved = detectConflicts(finalSlots);

  return {
    moves,
    unresolved,
    solved: unresolved.length === 0,
    nodesExplored,
    exhaustedBudget,
  };
}

/** Applies a plan to a schedule in memory, for verifying a plan before writing it. */
export function applyMoves(slots: SolverSlot[], moves: Move[]): SolverSlot[] {
  const byId = new Map(moves.map(m => [m.slotId, m]));

  return slots.map((slot) => {
    const move = byId.get(slot.id);
    if (!move) {
      return slot;
    }
    return {
      ...slot,
      dayOfWeek: move.to.dayOfWeek,
      startTime: move.to.startTime,
      endTime: move.to.endTime,
      roomLabel: move.to.roomLabel,
    };
  });
}
