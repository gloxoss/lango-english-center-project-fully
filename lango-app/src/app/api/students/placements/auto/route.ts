import { createHash } from 'node:crypto';
import { and, avg, count, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAudit } from '@/libs/api/audit';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { ApiError, apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { parseJson } from '@/libs/api/validation';
import { db } from '@/libs/DB';
import { recordStudentPlacement } from '@/libs/services/student-placement';
import {
  assessmentResults,
  attendance,
  branches,
  classes,
  classSections,
  sections,
  sessionYears,
  studentPlacements,
  user,
} from '@/models/Schema';

const commitAssignmentSchema = z.object({
  studentId: z.string().uuid(),
  targetClassSectionId: z.string().uuid(),
}).strict();

const autoPlacementSchema = z.object({
  sessionYearId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  classSectionIds: z.array(z.string().uuid()).optional(),
  method: z.enum(['random', 'balanced_headcount', 'gender_parity', 'academic_balance']).default('balanced_headcount'),
  studentIds: z.array(z.string()).optional(),
  targetClassSectionId: z.string().uuid().optional(),
  dryRun: z.boolean().default(false),
  rebalanceAssigned: z.boolean().default(false),
  notes: z.string().optional(),
  // Exact-commit mode (audit 2026-09-22, P1-3): the client sends back the
  // assignment list from its accepted dry-run plus the roster fingerprint the
  // server computed for that preview. The commit applies EXACTLY those
  // assignments and refuses with 409 when the roster changed in between —
  // what the director approved is what gets saved.
  assignments: z.array(commitAssignmentSchema).max(2000).optional(),
  rosterFingerprint: z.string().length(64).optional(),
}).strict();

/**
 * Deterministic fingerprint of a reconciled roster: who is assigned where, for
 * which session. Same roster → same hash; any admission, transfer or placement
 * change → different hash. Exported for tests.
 */
export function hashRoster(
  sessionYearId: string,
  students: Array<{ id: string; authoritativeSectionId: string | null }>,
): string {
  const canonical = JSON.stringify([
    sessionYearId,
    ...students
      .map(s => `${s.id}:${s.authoritativeSectionId ?? '-'}`)
      .sort(),
  ]);
  return createHash('sha256').update(canonical).digest('hex');
}

export type TargetSection = {
  id: string;
  classId: string;
  className: string;
  sectionName: string;
  maxStudents: number | null;
  branchId?: string | null;
};

export type ReconciledStudent = {
  id: string;
  name: string;
  matricule: string | null;
  gender: string | null;
  branchId: string | null;
  authoritativeSectionId: string | null;
  authoritativeClassName: string | null;
  authoritativeClassId: string | null;
  placementSectionId: string | null;
  userSectionId: string | null;
  hasMismatch: boolean;
};

export type Assignment = {
  studentId: string;
  studentName: string;
  matricule: string | null;
  gender: string | null;
  previousClassSectionId: string | null;
  previousClassName: string | null;
  targetClassSectionId: string;
  targetClassName: string;
  targetSectionName: string;
  isMove: boolean;
  hasAcademicHistory: boolean;
  score?: number | null;
};

export type UnchangedStudent = {
  studentId: string;
  studentName: string;
  matricule: string | null;
  gender: string | null;
  sectionId: string;
  className: string;
  sectionName: string;
};

export type SimulationBreakdownItem = {
  className: string;
  sectionName: string;
  beforeOccupancy: number;
  movement: number;
  afterOccupancy: number;
  maxStudents: number | null;
  isOverCapacity: boolean;
  availableSlots: number;
  count: number;
  maleCount: number;
  femaleCount: number;
};

export type SimulationResult = {
  evaluatedStudentsCount: number;
  unchangedCount: number;
  newAssignmentsCount: number;
  movedCount: number;
  unplacedCount: number;
  placedCount: number;
  hasChanges: boolean;
  simulationValid: boolean;
  hasAcademicHistoryWarning: boolean;
  movedWithHistoryCount: number;
  assignments: Assignment[];
  unchangedStudents: UnchangedStudent[];
  unplacedStudents: Array<{ studentId: string; studentName: string; matricule: string | null; reason: string }>;
  breakdown: Record<string, SimulationBreakdownItem>;
};

export type SimulationInput = {
  targetSections: TargetSection[];
  eligibleStudents: ReconciledStudent[];
  initialOccupancyMap: Map<string, number>;
  method?: 'random' | 'balanced_headcount' | 'gender_parity' | 'academic_balance';
  targetClassSectionId?: string;
  classId?: string;
  rebalanceAssigned?: boolean;
  gradeMap?: Map<string, number>;
  studentHistorySet?: Set<string>;
};

/**
 * Reconcile student placement from authoritative session placement history and user profile.
 * - Prefers current active studentPlacement for session.
 * - Reconciles with user.classSectionId.
 * - Flags PLACEMENT_SECTION_MISMATCH if both exist and disagree without silently picking one.
 */
export async function resolveAuthoritativeStudents(
  tenantId: string,
  sessionYearId: string,
  branchId?: string | null,
  studentIds?: string[],
): Promise<{ students: ReconciledStudent[]; integrityWarnings: any[] }> {
  const userConditions = [
    eq(user.tenantId, tenantId),
    eq(user.role, 'student'),
    eq(user.userStatus, 'active'),
  ];
  if (branchId) userConditions.push(eq(user.branchId, branchId));
  if (studentIds && studentIds.length > 0) userConditions.push(inArray(user.id, studentIds));

  const [studentRows, placementRows, sectionMetaRows] = await Promise.all([
    db.select({
      id: user.id,
      name: user.name,
      matricule: user.matricule,
      gender: user.gender,
      branchId: user.branchId,
      classSectionId: user.classSectionId,
      className: user.className,
    }).from(user).where(and(...userConditions)),

    db.select({
      studentId: studentPlacements.studentId,
      classSectionId: studentPlacements.classSectionId,
      status: studentPlacements.status,
    }).from(studentPlacements).where(and(
      eq(studentPlacements.tenantId, tenantId),
      eq(studentPlacements.sessionYearId, sessionYearId),
      eq(studentPlacements.isCurrent, true),
    )),

    db.select({
      id: classSections.id,
      classId: classSections.classId,
      className: classes.name,
    }).from(classSections)
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .where(eq(classSections.tenantId, tenantId)),
  ]);

  const placementMap = new Map<string, string>();
  placementRows.forEach(p => placementMap.set(p.studentId, p.classSectionId));

  const sectionMetaMap = new Map<string, { classId: string; className: string }>();
  sectionMetaRows.forEach(s => sectionMetaMap.set(s.id, { classId: s.classId, className: s.className }));

  const integrityWarnings: any[] = [];
  const students: ReconciledStudent[] = [];

  for (const u of studentRows) {
    const placementSec = placementMap.get(u.id) ?? null;
    const userSec = u.classSectionId ?? null;
    let hasMismatch = false;

    if (placementSec && userSec && placementSec !== userSec) {
      hasMismatch = true;
      integrityWarnings.push({
        studentId: u.id,
        studentName: u.name,
        type: 'PLACEMENT_SECTION_MISMATCH',
        placementSectionId: placementSec,
        userSectionId: userSec,
        message: `Incohérence pour ${u.name}: placement actif (${placementSec}) != profil (${userSec}). L'historique de placement officiel fait foi.`,
      });
    }

    const authoritativeSec = placementSec ?? userSec;
    const meta = authoritativeSec ? sectionMetaMap.get(authoritativeSec) : null;

    students.push({
      id: u.id,
      name: u.name,
      matricule: u.matricule,
      gender: u.gender,
      branchId: u.branchId,
      authoritativeSectionId: authoritativeSec,
      authoritativeClassName: meta?.className ?? u.className ?? null,
      authoritativeClassId: meta?.classId ?? null,
      placementSectionId: placementSec,
      userSectionId: userSec,
      hasMismatch,
    });
  }

  return { students, integrityWarnings };
}

/**
 * Pure simulation engine for automatic & balanced student placement.
 * - Rebalancing mode temporarily releases redistributed students from simOccupancy.
 * - If current section is optimal, student is marked as Unchanged (NO-OP).
 * - Only genuine moves/assignments are added to assignments.
 * - Breakdown calculates true delta = afterOccupancy - beforeOccupancy.
 */
export function runAutoPlacementSimulation({
  targetSections,
  eligibleStudents,
  initialOccupancyMap,
  method = 'balanced_headcount',
  targetClassSectionId,
  classId,
  rebalanceAssigned = false,
  gradeMap = new Map(),
  studentHistorySet = new Set(),
}: SimulationInput): SimulationResult {
  // Live occupancy tracker for distribution simulation
  const simOccupancy = new Map<string, number>(initialOccupancyMap);

  // In rebalancing mode, students being redistributed temporarily release their seat
  if (rebalanceAssigned) {
    for (const st of eligibleStudents) {
      if (st.authoritativeSectionId && simOccupancy.has(st.authoritativeSectionId)) {
        const cur = simOccupancy.get(st.authoritativeSectionId)!;
        simOccupancy.set(st.authoritativeSectionId, Math.max(0, cur - 1));
      }
    }
  }

  const assignments: Assignment[] = [];
  const unchangedStudents: UnchangedStudent[] = [];
  const unplacedStudents: Array<{ studentId: string; studentName: string; matricule: string | null; reason: string }> = [];

  const tryAssignStudent = (st: ReconciledStudent, sectionsPool: TargetSection[]): boolean => {
    const availableSections = sectionsPool.filter(sec => {
      if (sec.maxStudents == null) return false;
      // Strict cross-branch guard: student branch must match section branch
      if (st.branchId && sec.branchId && st.branchId !== sec.branchId) return false;
      const occ = simOccupancy.get(sec.id) || 0;
      return occ < sec.maxStudents;
    });

    if (availableSections.length === 0) {
      const hasBranchMismatch = sectionsPool.some(s => st.branchId && s.branchId && st.branchId !== s.branchId);
      unplacedStudents.push({
        studentId: st.id,
        studentName: st.name,
        matricule: st.matricule,
        reason: hasBranchMismatch && !sectionsPool.some(s => !s.branchId || !st.branchId || s.branchId === st.branchId)
          ? "Violation de frontière de succursale : Aucune section disponible dans la succursale de l'élève."
          : 'Toutes les sections cibles ont atteint leur capacité maximale autorisée.',
      });
      return false;
    }

    // If student is already in one of the available compatible sections and sections are balanced, preserve them!
    let bestSec: TargetSection = availableSections[0]!;
    const currentSecInPool = availableSections.find(s => s.id === st.authoritativeSectionId);

    // Pick section with lowest occupancy
    let lowestCount = Infinity;
    for (const sec of availableSections) {
      const occ = simOccupancy.get(sec.id) || 0;
      if (occ < lowestCount) {
        lowestCount = occ;
        bestSec = sec;
      }
    }

    // If current section has equal occupancy to best candidate, prefer keeping the student in place (NO-OP)
    if (currentSecInPool && (simOccupancy.get(currentSecInPool.id) || 0) <= lowestCount) {
      bestSec = currentSecInPool;
    }

    simOccupancy.set(bestSec.id, (simOccupancy.get(bestSec.id) || 0) + 1);

    // Check whether this placement represents a genuine change or a no-op
    if (st.authoritativeSectionId && st.authoritativeSectionId === bestSec.id) {
      // NO-OP: Student remains in current section
      unchangedStudents.push({
        studentId: st.id,
        studentName: st.name,
        matricule: st.matricule,
        gender: st.gender,
        sectionId: bestSec.id,
        className: bestSec.className,
        sectionName: bestSec.sectionName,
      });
    } else {
      // GENUINE CHANGE: New assignment or section move
      const isMove = Boolean(st.authoritativeSectionId && st.authoritativeSectionId !== bestSec.id);
      const score = gradeMap.get(st.id) ?? null;

      assignments.push({
        studentId: st.id,
        studentName: st.name,
        matricule: st.matricule,
        gender: st.gender,
        previousClassSectionId: st.authoritativeSectionId,
        previousClassName: st.authoritativeClassName,
        targetClassSectionId: bestSec.id,
        targetClassName: bestSec.className,
        targetSectionName: bestSec.sectionName,
        isMove,
        hasAcademicHistory: isMove && studentHistorySet.has(st.id),
        score: score !== null ? Math.round((score / 5) * 100) / 100 : null,
      });
    }

    return true;
  };

  const distributeCluster = (students: ReconciledStudent[], sectionsPool: TargetSection[]) => {
    if (sectionsPool.length === 0 || students.length === 0) return;

    if (targetClassSectionId) {
      const targetSec = sectionsPool.find(s => s.id === targetClassSectionId);
      if (!targetSec) return;
      for (const st of students) {
        tryAssignStudent(st, [targetSec]);
      }
    } else if (method === 'gender_parity') {
      const males = students.filter(s => s.gender === 'male');
      const females = students.filter(s => s.gender === 'female');
      const others = students.filter(s => s.gender !== 'male' && s.gender !== 'female');

      const maxLen = Math.max(males.length, females.length, others.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < females.length) tryAssignStudent(females[i]!, sectionsPool);
        if (i < males.length) tryAssignStudent(males[i]!, sectionsPool);
        if (i < others.length) tryAssignStudent(others[i]!, sectionsPool);
      }
    } else if (method === 'academic_balance') {
      const sorted = [...students].sort((a, b) => {
        const gradeA = gradeMap.get(a.id) ?? 50;
        const gradeB = gradeMap.get(b.id) ?? 50;
        return gradeB - gradeA;
      });
      for (const st of sorted) {
        tryAssignStudent(st, sectionsPool);
      }
    } else {
      const studentsPool = method === 'random'
        ? [...students].sort(() => Math.random() - 0.5)
        : [...students];

      for (const st of studentsPool) {
        tryAssignStudent(st, sectionsPool);
      }
    }
  };

  if (targetClassSectionId || classId) {
    distributeCluster(eligibleStudents, targetSections);
  } else {
    const sectionsByClass = new Map<string, TargetSection[]>();
    for (const sec of targetSections) {
      const list = sectionsByClass.get(sec.classId) ?? [];
      list.push(sec);
      sectionsByClass.set(sec.classId, list);
    }

    const assignedStudents = new Set<string>();
    for (const [clsId, classSecs] of sectionsByClass.entries()) {
      const studentsForClass = eligibleStudents.filter(s => s.authoritativeClassId === clsId);
      studentsForClass.forEach(s => assignedStudents.add(s.id));
      distributeCluster(studentsForClass, classSecs);
    }

    const unassignedStudents = eligibleStudents.filter(s => !assignedStudents.has(s.id));
    if (unassignedStudents.length > 0) {
      distributeCluster(unassignedStudents, targetSections);
    }
  }

  // Detailed Breakdown with Truthful Before / After Metrics
  const breakdown: Record<string, SimulationBreakdownItem> = {};
  let hasOverCapacitySection = false;

  for (const sec of targetSections) {
    const before = initialOccupancyMap.get(sec.id) || 0; // FROZEN BASELINE!
    const after = simOccupancy.get(sec.id) || 0;
    const delta = after - before; // TRUE DELTA!
    const maxCap = sec.maxStudents;
    const isOver = maxCap != null && after > maxCap;
    if (isOver) hasOverCapacitySection = true;

    const secAssignments = assignments.filter(a => a.targetClassSectionId === sec.id);

    breakdown[sec.id] = {
      className: sec.className,
      sectionName: sec.sectionName,
      beforeOccupancy: before,
      movement: delta,
      afterOccupancy: after,
      maxStudents: maxCap ?? null,
      isOverCapacity: isOver,
      availableSlots: maxCap != null ? Math.max(0, maxCap - after) : 0,
      count: secAssignments.length,
      maleCount: secAssignments.filter(a => a.gender === 'male').length,
      femaleCount: secAssignments.filter(a => a.gender === 'female').length,
    };
  }

  const movedStudents = assignments.filter(a => a.isMove);
  const newAssignments = assignments.filter(a => !a.isMove);
  const movedWithHistoryCount = movedStudents.filter(a => a.hasAcademicHistory).length;
  const hasAcademicHistoryWarning = movedWithHistoryCount > 0;

  const hasChanges = assignments.length > 0;
  const simulationValid = !hasOverCapacitySection && unplacedStudents.length === 0;

  return {
    evaluatedStudentsCount: eligibleStudents.length,
    unchangedCount: unchangedStudents.length,
    newAssignmentsCount: newAssignments.length,
    movedCount: movedStudents.length,
    unplacedCount: unplacedStudents.length,
    placedCount: assignments.length,
    hasChanges,
    simulationValid,
    hasAcademicHistoryWarning,
    movedWithHistoryCount,
    assignments,
    unchangedStudents,
    unplacedStudents,
    breakdown,
  };
}

/**
 * Pre-flight capability and capacity check before launching auto-placement simulation
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'students.placements.manage');

    const { searchParams } = new URL(req.url);
    const classIdParam = searchParams.get('classId');

    // 1. Authoritative Scope
    const [activeSession] = await db
      .select({ id: sessionYears.id, name: sessionYears.name })
      .from(sessionYears)
      .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
      .limit(1);

    let branchName = 'Campus Principal';
    if (ctx.branchId) {
      const [b] = await db.select({ name: branches.name }).from(branches).where(and(eq(branches.tenantId, tenantId), eq(branches.id, ctx.branchId))).limit(1);
      if (b) branchName = b.name;
    } else {
      const [defaultB] = await db.select({ name: branches.name }).from(branches).where(and(eq(branches.tenantId, tenantId), eq(branches.isDefault, true))).limit(1);
      if (defaultB) branchName = defaultB.name;
    }

    // 2. Query target sections
    const sectionConditions = [eq(classSections.tenantId, tenantId)];
    if (ctx.branchId) {
      sectionConditions.push(eq(classes.branchId, ctx.branchId));
    }
    if (classIdParam && classIdParam !== 'all') {
      sectionConditions.push(eq(classSections.classId, classIdParam));
    }

    const targetSections: TargetSection[] = await db
      .select({
        id: classSections.id,
        classId: classSections.classId,
        className: classes.name,
        sectionName: sections.name,
        maxStudents: classSections.maxStudents,
        branchId: classes.branchId,
      })
      .from(classSections)
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .innerJoin(sections, eq(classSections.sectionId, sections.id))
      .where(and(...sectionConditions));

    const targetSectionIds = targetSections.map(s => s.id);
    const sectionsWithUnknownCapacity = targetSections
      .filter(s => s.maxStudents == null)
      .map(s => (s.className ? `${s.className} (${s.sectionName})` : s.id));

    // 3. Occupancy from reconciled authoritative student placement.
    // A tenant with no default session year must get a clean 422 — the empty
    // string used to flow into a uuid column and 500 the whole preflight
    // (root cause of the recurring tenant-isolation failure).
    if (!activeSession?.id) {
      throw new ApiError(422, 'MISSING_SESSION', 'Aucune année scolaire par défaut trouvée : configurez l\'année scolaire avant le placement.');
    }
    const sessionYearId = activeSession.id;
    const { students: allActiveStudents, integrityWarnings } = await resolveAuthoritativeStudents(
      tenantId,
      sessionYearId,
      ctx.branchId,
    );

    const occMap = new Map<string, number>();
    targetSectionIds.forEach(id => occMap.set(id, 0));
    allActiveStudents.forEach(st => {
      if (st.authoritativeSectionId && occMap.has(st.authoritativeSectionId)) {
        occMap.set(st.authoritativeSectionId, (occMap.get(st.authoritativeSectionId) || 0) + 1);
      }
    });

    const totalCapacity = targetSections.reduce((sum, s) => sum + (s.maxStudents ?? 0), 0);
    const totalEnrolledInSections = targetSections.reduce((sum, s) => sum + (occMap.get(s.id) ?? 0), 0);
    const availableCapacity = Math.max(0, totalCapacity - totalEnrolledInSections);

    const unassignedCount = allActiveStudents.filter(s => s.authoritativeSectionId == null).length;
    const totalAssignedCount = allActiveStudents.filter(s => s.authoritativeSectionId != null).length;

    return NextResponse.json({
      success: true,
      data: {
        scope: {
          branchName,
          branchId: ctx.branchId ?? null,
          academicYearName: activeSession?.name ?? '2026–2027',
          sessionYearId: activeSession?.id ?? null,
        },
        eligibleSectionsCount: targetSections.length,
        totalCapacity,
        availableCapacity,
        unassignedCount,
        totalAssignedCount,
        sectionsWithUnknownCapacity,
        isSimulationBlocked: sectionsWithUnknownCapacity.length > 0,
        integrityWarnings,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireRequestContext(req, ['school_admin']);
    const tenantId = requireTenant(ctx);
    await requireCapability(ctx, 'students.placements.manage');

    const body = await parseJson(req, autoPlacementSchema);

    // 1. Resolve Session Year
    let targetSessionYearId = body.sessionYearId;
    let sessionYearName = 'Année en cours';
    if (!targetSessionYearId) {
      const [activeSession] = await db
        .select({ id: sessionYears.id, name: sessionYears.name })
        .from(sessionYears)
        .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
        .limit(1);
      targetSessionYearId = activeSession?.id;
      if (activeSession) sessionYearName = activeSession.name;
    } else {
      const [sess] = await db
        .select({ id: sessionYears.id, name: sessionYears.name })
        .from(sessionYears)
        .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.id, targetSessionYearId)))
        .limit(1);
      if (sess) sessionYearName = sess.name;
    }

    if (!targetSessionYearId) {
      throw new ApiError(422, 'MISSING_SESSION', 'Aucune année scolaire active trouvée.');
    }

    let branchName = 'Campus Principal';
    if (ctx.branchId) {
      const [b] = await db.select({ name: branches.name }).from(branches).where(and(eq(branches.tenantId, tenantId), eq(branches.id, ctx.branchId))).limit(1);
      if (b) branchName = b.name;
    } else {
      const [defaultB] = await db.select({ name: branches.name }).from(branches).where(and(eq(branches.tenantId, tenantId), eq(branches.isDefault, true))).limit(1);
      if (defaultB) branchName = defaultB.name;
    }

    // 2. Query target sections
    const sectionConditions = [eq(classSections.tenantId, tenantId)];
    if (ctx.branchId) {
      sectionConditions.push(eq(classes.branchId, ctx.branchId));
    }
    if (body.classId) {
      sectionConditions.push(eq(classSections.classId, body.classId));
    }
    if (body.classSectionIds && body.classSectionIds.length > 0) {
      sectionConditions.push(inArray(classSections.id, body.classSectionIds));
    }

    const targetSections: TargetSection[] = await db
      .select({
        id: classSections.id,
        classId: classSections.classId,
        className: classes.name,
        sectionName: sections.name,
        maxStudents: classSections.maxStudents,
        branchId: classes.branchId,
      })
      .from(classSections)
      .innerJoin(classes, eq(classSections.classId, classes.id))
      .innerJoin(sections, eq(classSections.sectionId, sections.id))
      .where(and(...sectionConditions));

    if (targetSections.length === 0) {
      throw new ApiError(422, 'NO_SECTIONS', 'Aucune section cible éligible disponible dans cette succursale.');
    }

    // Capacity Visibility Safeguard: Block simulation if any target section has unconfigured capacity
    const sectionsWithUnknownCapacity = targetSections
      .filter(s => s.maxStudents == null)
      .map(s => (s.className ? `${s.className} (${s.sectionName})` : s.id));

    if (sectionsWithUnknownCapacity.length > 0) {
      return NextResponse.json({
        success: false,
        code: 'CAPACITY_NOT_CONFIGURED',
        error: {
          code: 'CAPACITY_NOT_CONFIGURED',
          message: `Capacité non configurée pour ${sectionsWithUnknownCapacity.length} section(s) cible(s) (${sectionsWithUnknownCapacity.join(', ')}). La simulation et l'affectation sont bloquées tant que les capacités maximales ne sont pas définies.`,
        },
        data: {
          scope: { branchName, branchId: ctx.branchId ?? null, academicYearName: sessionYearName, sessionYearId: targetSessionYearId },
          sectionsWithUnknownCapacity,
          totalCapacity: 0,
          placedCount: 0,
          unplacedCount: 0,
          simulationValid: false,
          hasChanges: false,
          assignments: [],
          unchangedStudents: [],
          unplacedStudents: [],
          breakdown: {},
        },
      }, { status: 422 });
    }

    const targetSectionIds = targetSections.map(s => s.id);

    // 3. Resolve Authoritative Students for target session
    const { students: allActiveStudents, integrityWarnings } = await resolveAuthoritativeStudents(
      tenantId,
      targetSessionYearId,
      ctx.branchId,
      body.studentIds,
    );

    // Frozen baseline occupancy map from current authoritative assignments
    const initialOccupancyMap = new Map<string, number>();
    targetSectionIds.forEach(id => initialOccupancyMap.set(id, 0));
    allActiveStudents.forEach(st => {
      if (st.authoritativeSectionId && initialOccupancyMap.has(st.authoritativeSectionId)) {
        initialOccupancyMap.set(st.authoritativeSectionId, (initialOccupancyMap.get(st.authoritativeSectionId) || 0) + 1);
      }
    });

    const rosterFingerprint = hashRoster(targetSessionYearId, allActiveStudents);
    const totalCapacity = targetSections.reduce((sum, s) => sum + (s.maxStudents ?? 0), 0);

    // =========================================================================
    // 4-bis. EXACT COMMIT — apply the previewed assignments verbatim
    // =========================================================================
    if (!body.dryRun && body.assignments) {
      if (body.rosterFingerprint && body.rosterFingerprint !== rosterFingerprint) {
        throw new ApiError(409, 'ROSTER_CHANGED', 'La liste des élèves a changé depuis la simulation. Relancez la simulation puis validez à nouveau.');
      }

      const studentById = new Map(allActiveStudents.map(s => [s.id, s]));
      const sectionById = new Map(targetSections.map(s => [s.id, s]));
      const seenStudents = new Set<string>();
      const exactAssignments: Assignment[] = [];
      const exactUnplaced: Array<{ studentId: string; studentName: string; matricule: string | null; reason: string }> = [];

      // Capacity simulation of EXACTLY the submitted list, in order.
      const simulatedOccupancy = new Map(initialOccupancyMap);

      // Section-level academic history advisory for moved students
      const movedInIds = body.assignments
        .filter(a => studentById.get(a.studentId)?.authoritativeSectionId && studentById.get(a.studentId)!.authoritativeSectionId !== a.targetClassSectionId)
        .map(a => a.studentId);
      const historySet = new Set<string>();
      if (movedInIds.length > 0) {
        const [attRows, gradeRows] = await Promise.all([
          db.select({ studentId: attendance.studentId }).from(attendance)
            .where(and(eq(attendance.tenantId, tenantId), inArray(attendance.studentId, movedInIds))).limit(500),
          db.select({ studentId: assessmentResults.studentId }).from(assessmentResults)
            .where(and(eq(assessmentResults.tenantId, tenantId), inArray(assessmentResults.studentId, movedInIds))).limit(500),
        ]);
        attRows.forEach(r => historySet.add(r.studentId));
        gradeRows.forEach(r => historySet.add(r.studentId));
      }

      for (const a of body.assignments) {
        const student = studentById.get(a.studentId);
        const target = sectionById.get(a.targetClassSectionId);
        if (!student) {
          exactUnplaced.push({
            studentId: a.studentId,
            studentName: a.studentId,
            matricule: null,
            reason: 'Élève introuvable ou non éligible dans la portée actuelle (transfert, radiation ou portée de succursale).',
          });
          continue;
        }
        if (!target) {
          exactUnplaced.push({
            studentId: a.studentId,
            studentName: student.name,
            matricule: student.matricule,
            reason: 'Section cible invalide ou hors portée.',
          });
          continue;
        }
        if (!seenStudents.has(a.studentId)) {
          seenStudents.add(a.studentId);
          const occ = (simulatedOccupancy.get(a.targetClassSectionId) || 0) + 1;
          if (target.maxStudents != null && occ > target.maxStudents) {
            exactUnplaced.push({
              studentId: a.studentId,
              studentName: student.name,
              matricule: student.matricule,
              reason: `La section ${target.className} (${target.sectionName}) dépasserait sa capacité maximale (${target.maxStudents}).`,
            });
            continue;
          }
          simulatedOccupancy.set(a.targetClassSectionId, occ);

          const isMove = Boolean(student.authoritativeSectionId && student.authoritativeSectionId !== a.targetClassSectionId);
          exactAssignments.push({
            studentId: student.id,
            studentName: student.name,
            matricule: student.matricule,
            gender: student.gender,
            previousClassSectionId: student.authoritativeSectionId,
            previousClassName: student.authoritativeClassName,
            targetClassSectionId: target.id,
            targetClassName: target.className,
            targetSectionName: target.sectionName,
            isMove,
            hasAcademicHistory: isMove && historySet.has(student.id),
            score: null,
          });
        }
      }

      if (exactAssignments.length === 0) {
        throw new ApiError(400, 'NO_CHANGES', 'Aucune affectation valide à appliquer : relancez une simulation.');
      }

      const batchId = `BATCH-${Date.now()}`;

      // Transactional commit of EXACTLY the previewed assignments
      await db.transaction(async (tx) => {
        for (const a of exactAssignments) {
          if (a.previousClassSectionId && a.previousClassSectionId === a.targetClassSectionId) {
            continue;
          }
          await recordStudentPlacement({
            tenantId,
            studentId: a.studentId,
            sessionYearId: targetSessionYearId,
            classSectionId: a.targetClassSectionId,
            notes: body.notes || `Affectation validée depuis simulation [${batchId}] (${body.method})`,
          }, tx);
        }

        const placementCounts = await tx
          .select({ studentId: studentPlacements.studentId, count: count() })
          .from(studentPlacements)
          .where(and(
            eq(studentPlacements.tenantId, tenantId),
            eq(studentPlacements.sessionYearId, targetSessionYearId),
            eq(studentPlacements.isCurrent, true),
            inArray(studentPlacements.studentId, exactAssignments.map(a => a.studentId)),
          ))
          .groupBy(studentPlacements.studentId);

        for (const row of placementCounts) {
          if (Number(row.count) > 1) {
            throw new ApiError(500, 'INVARIANT_VIOLATION', `L'élève ${row.studentId} possède plus d'un placement actif pour l'année scolaire.`);
          }
        }
      });

      recordAudit(ctx, 'create', 'student_placements_auto', targetSessionYearId, {
        batchId,
        appliedFromPreview: true,
        rosterFingerprint: body.rosterFingerprint ?? null,
        notes: body.notes || null,
        branchName,
        academicYearName: sessionYearName,
        totalPlaced: exactAssignments.length,
        totalNew: exactAssignments.filter(a => !a.isMove).length,
        totalMoved: exactAssignments.filter(a => a.isMove).length,
        totalUnchanged: 0,
        unplacedCount: exactUnplaced.length,
        method: body.method,
        rebalanceAssigned: body.rebalanceAssigned,
        timestamp: new Date().toISOString(),
      });

      const exactBreakdown: Record<string, SimulationBreakdownItem> = {};
      for (const sec of targetSections) {
        const before = initialOccupancyMap.get(sec.id) || 0;
        const after = simulatedOccupancy.get(sec.id) || 0;
        const secAssignments = exactAssignments.filter(a => a.targetClassSectionId === sec.id);
        exactBreakdown[sec.id] = {
          className: sec.className,
          sectionName: sec.sectionName,
          beforeOccupancy: before,
          movement: after - before,
          afterOccupancy: after,
          maxStudents: sec.maxStudents ?? null,
          isOverCapacity: sec.maxStudents != null && after > sec.maxStudents,
          availableSlots: sec.maxStudents != null ? Math.max(0, sec.maxStudents - after) : 0,
          count: secAssignments.length,
          maleCount: secAssignments.filter(a => a.gender === 'male').length,
          femaleCount: secAssignments.filter(a => a.gender === 'female').length,
        };
      }

      return NextResponse.json({
        success: true,
        data: {
          isDryRun: false,
          appliedFromPreview: true,
          rosterFingerprint,
          scope: {
            branchName,
            branchId: ctx.branchId ?? null,
            academicYearName: sessionYearName,
            sessionYearId: targetSessionYearId,
          },
          evaluatedStudentsCount: body.assignments.length,
          unchangedCount: 0,
          newAssignmentsCount: exactAssignments.filter(a => !a.isMove).length,
          movedCount: exactAssignments.filter(a => a.isMove).length,
          unplacedCount: exactUnplaced.length,
          placedCount: exactAssignments.length,
          hasChanges: true,
          totalCapacity,
          currentOccupancy: targetSections.reduce((sum, s) => sum + (initialOccupancyMap.get(s.id) ?? 0), 0),
          availableCapacity: Math.max(0, totalCapacity - targetSections.reduce((sum, s) => sum + (exactBreakdown[s.id]?.afterOccupancy ?? 0), 0)),
          capacityExceeded: exactUnplaced.length > 0,
          simulationValid: exactUnplaced.length === 0,
          hasAcademicHistoryWarning: exactAssignments.some(a => a.hasAcademicHistory),
          movedWithHistoryCount: exactAssignments.filter(a => a.hasAcademicHistory).length,
          sectionsWithUnknownCapacity,
          method: body.method,
          breakdown: exactBreakdown,
          assignments: exactAssignments,
          unchangedStudents: [],
          unplacedStudents: exactUnplaced,
          integrityWarnings,
        },
        message: exactUnplaced.length > 0
          ? `${exactAssignments.length} affectation(s) appliquée(s), ${exactUnplaced.length} refusée(s) (capacité ou éligibilité).`
          : `${exactAssignments.length} affectation(s) appliquée(s) avec succès.`,
      });
    }

    // 4. Resolve Eligible Student Pool
    let eligibleStudents: ReconciledStudent[];
    if (body.rebalanceAssigned) {
      if (body.classId) {
        eligibleStudents = allActiveStudents.filter(s =>
          s.authoritativeClassId === body.classId ||
          (s.authoritativeSectionId && targetSectionIds.includes(s.authoritativeSectionId)) ||
          s.authoritativeSectionId == null,
        );
      } else {
        eligibleStudents = allActiveStudents.filter(s =>
          (s.authoritativeSectionId && targetSectionIds.includes(s.authoritativeSectionId)) ||
          s.authoritativeSectionId == null,
        );
      }
    } else {
      eligibleStudents = allActiveStudents.filter(s => s.authoritativeSectionId == null);
    }

    if (eligibleStudents.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          isDryRun: body.dryRun,
          appliedFromPreview: Boolean(body.assignments) && !body.dryRun,
          rosterFingerprint,
          scope: { branchName, branchId: ctx.branchId ?? null, academicYearName: sessionYearName, sessionYearId: targetSessionYearId },
          evaluatedStudentsCount: 0,
          unchangedCount: 0,
          newAssignmentsCount: 0,
          movedCount: 0,
          unplacedCount: 0,
          placedCount: 0,
          hasChanges: false,
          totalCapacity,
          availableCapacity: Math.max(0, totalCapacity - targetSections.reduce((sum, s) => sum + (initialOccupancyMap.get(s.id) ?? 0), 0)),
          simulationValid: true,
          hasAcademicHistoryWarning: false,
          movedWithHistoryCount: 0,
          sectionsWithUnknownCapacity: [],
          assignments: [],
          unchangedStudents: [],
          unplacedStudents: [],
          breakdown: {},
          integrityWarnings,
        },
        message: body.rebalanceAssigned
          ? 'Aucun élève trouvé pour cette classe à rééquilibrer.'
          : 'Aucun élève sans section à affecter.',
      });
    }

    // Check academic history (attendance / assessment results) for mid-year safety advisory
    const assignedStudentIds = eligibleStudents.filter(s => s.authoritativeSectionId != null).map(s => s.id);
    const studentHistorySet = new Set<string>();
    if (assignedStudentIds.length > 0) {
      const [attRows, gradeRows] = await Promise.all([
        db.select({ studentId: attendance.studentId })
          .from(attendance)
          .where(and(eq(attendance.tenantId, tenantId), inArray(attendance.studentId, assignedStudentIds)))
          .limit(500),
        db.select({ studentId: assessmentResults.studentId })
          .from(assessmentResults)
          .where(and(eq(assessmentResults.tenantId, tenantId), inArray(assessmentResults.studentId, assignedStudentIds)))
          .limit(500),
      ]);
      attRows.forEach(r => studentHistorySet.add(r.studentId));
      gradeRows.forEach(r => studentHistorySet.add(r.studentId));
    }

    let gradeMap = new Map<string, number>();
    if (body.method === 'academic_balance') {
      const studentIds = eligibleStudents.map(s => s.id);
      const gradeRows = await db
        .select({
          studentId: assessmentResults.studentId,
          avgPct: avg(assessmentResults.finalPercentage),
        })
        .from(assessmentResults)
        .where(and(
          eq(assessmentResults.tenantId, tenantId),
          inArray(assessmentResults.studentId, studentIds),
        ))
        .groupBy(assessmentResults.studentId);

      gradeMap = new Map(gradeRows.map(r => [r.studentId, r.avgPct ? Number(r.avgPct) : 50]));
    }

    const simulation = runAutoPlacementSimulation({
      targetSections,
      eligibleStudents,
      initialOccupancyMap,
      method: body.method,
      targetClassSectionId: body.targetClassSectionId,
      classId: body.classId,
      rebalanceAssigned: body.rebalanceAssigned,
      gradeMap,
      studentHistorySet,
    });

    const {
      assignments,
      unchangedStudents,
      unplacedStudents,
      breakdown,
      hasChanges,
      simulationValid,
      hasAcademicHistoryWarning,
      movedWithHistoryCount,
      evaluatedStudentsCount,
      unchangedCount,
      newAssignmentsCount,
      movedCount,
    } = simulation;

    const movedStudents = assignments.filter(a => a.isMove);
    const newAssignments = assignments.filter(a => !a.isMove);
    const hasOverCapacitySection = Object.values(breakdown).some(b => b.isOverCapacity);

    // 7. Transactional Commit Placements (Strictly genuine changes only)
    if (!body.dryRun) {
      if (!hasChanges || assignments.length === 0) {
        throw new ApiError(400, 'NO_CHANGES', 'Aucune modification nécessaire : les sections sont déjà équilibrées.');
      }
      if (hasOverCapacitySection) {
        throw new ApiError(409, 'CAPACITY_EXCEEDED', 'Validation bloquée : Une ou plusieurs sections dépassent leur capacité maximale autorisée.');
      }

      const batchId = `BATCH-${Date.now()}`;

      // Transactional commit: all succeed or all rollback!
      await db.transaction(async (tx) => {
        for (const a of assignments) {
          // Strictly skip no-ops
          if (a.previousClassSectionId && a.previousClassSectionId === a.targetClassSectionId) {
            continue;
          }

          await recordStudentPlacement({
            tenantId,
            studentId: a.studentId,
            sessionYearId: targetSessionYearId,
            classSectionId: a.targetClassSectionId,
            notes: body.notes || `Affectation automatique [${batchId}] (${body.method})`,
          }, tx);
        }

        // Transactional Invariant: Verify at most one current placement per student for this session
        const placementCounts = await tx
          .select({
            studentId: studentPlacements.studentId,
            count: count(),
          })
          .from(studentPlacements)
          .where(and(
            eq(studentPlacements.tenantId, tenantId),
            eq(studentPlacements.sessionYearId, targetSessionYearId),
            eq(studentPlacements.isCurrent, true),
            inArray(studentPlacements.studentId, assignments.map(a => a.studentId)),
          ))
          .groupBy(studentPlacements.studentId);

        for (const row of placementCounts) {
          if (Number(row.count) > 1) {
            throw new ApiError(500, 'INVARIANT_VIOLATION', `L'élève ${row.studentId} possède plus d'un placement actif pour l'année scolaire.`);
          }
        }
      });

      recordAudit(ctx, 'create', 'student_placements_auto', targetSessionYearId, {
        batchId,
        appliedFromPreview: false,
        notes: body.notes || null,
        branchName,
        academicYearName: sessionYearName,
        totalPlaced: assignments.length,
        totalNew: newAssignments.length,
        totalMoved: movedStudents.length,
        totalUnchanged: unchangedStudents.length,
        unplacedCount: unplacedStudents.length,
        method: body.method,
        rebalanceAssigned: body.rebalanceAssigned,
        breakdown,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        isDryRun: body.dryRun,
        appliedFromPreview: Boolean(body.assignments) && !body.dryRun,
        rosterFingerprint,
        scope: {
          branchName,
          branchId: ctx.branchId ?? null,
          academicYearName: sessionYearName,
          sessionYearId: targetSessionYearId,
        },
        evaluatedStudentsCount: eligibleStudents.length,
        unchangedCount: unchangedStudents.length,
        newAssignmentsCount: newAssignments.length,
        movedCount: movedStudents.length,
        unplacedCount: unplacedStudents.length,
        placedCount: assignments.length, // Only genuine changes!
        hasChanges,
        totalCapacity,
        currentOccupancy: targetSections.reduce((sum, s) => sum + (initialOccupancyMap.get(s.id) ?? 0), 0),
        availableCapacity: Math.max(0, totalCapacity - targetSections.reduce((sum, s) => sum + (breakdown[s.id]?.afterOccupancy ?? 0), 0)),
        capacityExceeded: unplacedStudents.length > 0 || hasOverCapacitySection,
        simulationValid,
        hasAcademicHistoryWarning,
        movedWithHistoryCount,
        sectionsWithUnknownCapacity,
        method: body.method,
        breakdown,
        assignments,
        unchangedStudents,
        unplacedStudents,
        integrityWarnings,
      },
      message: unplacedStudents.length > 0
        ? `${assignments.length} modification(s) proposée(s), ${unplacedStudents.length} non affecté(s).`
        : !hasChanges
          ? 'Aucune modification nécessaire. Les sections sont déjà équilibrées.'
          : body.dryRun
            ? `Simulation prête : ${newAssignments.length} nouvelle(s) affectation(s), ${movedStudents.length} déplacement(s).`
            : `${assignments.length} affectation(s) appliquée(s) avec succès.`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
