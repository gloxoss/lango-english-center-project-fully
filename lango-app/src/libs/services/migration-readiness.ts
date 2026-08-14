import { and, desc, eq, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { requireTenant, type RequestContext } from '@/libs/api/context';
import { getEffectiveValue, setSettingValue } from '@/libs/settings/registry';
import { classSections, files, studentPlacements, user } from '@/models/Schema';
import {
  MIGRATION_STEPS, INITIAL_COLUMN_MAPPINGS, MIGRATION_TEAM_TASKS, TARGET_COLUMNS,
} from '@/features/settings/data/migration-readiness-config';

export type MigrationStep = {
  id: number;
  stepNumber: number;
  label: string;
  sub: string;
  status: 'done' | 'in_progress' | 'pending';
};

export type QualityProblem = {
  id: number;
  label: string;
  severity: 'danger' | 'warning';
  recordCount: number;
  actionLabel: string;
  actionUrl: string;
};

export type ColumnMapping = { sourceCol: string; targetField: string };

export type TaskItem = {
  id: number;
  task: string;
  status: 'done' | 'in_progress' | 'pending' | 'blocked';
  assignee: string;
  date: string;
};

export type RecentFileItem = {
  id: string;
  name: string;
  size: string;
  author: string;
  time: string;
  status: string;
};

export type ErrorBar = {
  name: string;
  count: number;
  pct: number;
  color: string;
};

export type MigrationReadinessData = {
  readinessScore: number;
  fileCount: number;
  entityCounts: { students: number; guardians: number; classes: number };
  steps: MigrationStep[];
  qualityProblems: QualityProblem[];
  columnMappings: ColumnMapping[];
  mappedColumnsCount: number;
  totalColumnsCount: number;
  errorDistribution: ErrorBar[];
  totalErrors: number;
  recentFiles: RecentFileItem[];
  tasks: TaskItem[];
  nextRecommendation: { type: 'warning' | 'info'; title: string; description: string } | null;
};

export type MigrationState = {
  columnMappings: ColumnMapping[];
  tasks: TaskItem[];
  totalColumnsCount: number;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} Ko`;
  return `${(kb / 1024).toFixed(1)} Mo`;
}

export async function loadMigrationState(
  tenantId: string,
  branchId: string | null,
  context: RequestContext,
): Promise<MigrationState> {
  const effective = await getEffectiveValue(tenantId, branchId, 'migration.state');
  if (effective.source === 'default') {
    // Read-only: the config seed is returned without writing. The school's first
    // real mutation (save mapping / task toggle) persists it via saveMigrationState.
    return {
      columnMappings: Array.from(INITIAL_COLUMN_MAPPINGS),
      tasks: Array.from(MIGRATION_TEAM_TASKS) as TaskItem[],
      totalColumnsCount: TARGET_COLUMNS.length,
    };
  }
  const value = (effective.value ?? {}) as Partial<MigrationState>;
  return {
    columnMappings: Array.isArray(value.columnMappings) ? value.columnMappings : [],
    tasks: Array.isArray(value.tasks) ? value.tasks : [],
    totalColumnsCount: typeof value.totalColumnsCount === 'number' ? value.totalColumnsCount : TARGET_COLUMNS.length,
  };
}

export async function saveMigrationState(
  tenantId: string,
  branchId: string | null,
  state: MigrationState,
  context: RequestContext,
): Promise<void> {
  await setSettingValue(tenantId, branchId, 'migration.state', state, context);
}

export async function buildMigrationReadiness(context: RequestContext): Promise<MigrationReadinessData> {
  const tenantId = requireTenant(context);

  const state = await loadMigrationState(tenantId, context.branchId, context);

  // Real entity counts.
  const [studentRows, guardianRows, classRows] = await Promise.all([
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'))),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'parent'))),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(classSections)
      .where(eq(classSections.tenantId, tenantId)),
  ]);
  const studentCount = studentRows[0]?.c ?? 0;
  const guardianCount = guardianRows[0]?.c ?? 0;
  const classCount = classRows[0]?.c ?? 0;

  // Real data-quality anomalies among the tenant's students.
  const [missingPhoneRows, missingClassRows, missingBirthdateRows, dupCinRows] = await Promise.all([
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), or(isNull(user.phone), eq(user.phone, '')))),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(user)
      .where(and(
        eq(user.tenantId, tenantId),
        eq(user.role, 'student'),
        // Session-scoped placement model: a student counts as placed only via a
        // current studentPlacements row, not the denormalized user.classSectionId.
        sql`NOT EXISTS (
          select 1 from ${studentPlacements} sp
          where sp.student_id = ${user.id} and sp.is_current = true
        )`,
      )),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), isNull(user.dateOfBirth))),
    db
      .select({ nationalId: user.nationalId })
      .from(user)
      .where(and(eq(user.tenantId, tenantId), isNotNull(user.nationalId), ne(user.nationalId, '')))
      .groupBy(user.nationalId)
      .having(sql`count(*) > 1`),
  ]);
  const missingPhone = missingPhoneRows[0]?.c ?? 0;
  const missingClass = missingClassRows[0]?.c ?? 0;
  const missingBirthdate = missingBirthdateRows[0]?.c ?? 0;
  const dupCin = dupCinRows.length;

  const problems: QualityProblem[] = [];
  if (missingPhone > 0) {
    problems.push({
      id: 1, label: 'Téléphones élèves manquants', severity: 'danger', recordCount: missingPhone,
      actionLabel: 'Compléter les numéros', actionUrl: '/dashboard/students',
    });
  }
  if (missingClass > 0) {
    problems.push({
      id: 2, label: 'Affectation de classe manquante', severity: 'danger', recordCount: missingClass,
      actionLabel: 'Assigner une classe', actionUrl: '/dashboard/students',
    });
  }
  if (dupCin > 0) {
    problems.push({
      id: 3, label: "Doublons de numéro CIN", severity: 'warning', recordCount: dupCin,
      actionLabel: 'Fusionner les doublons', actionUrl: '/dashboard/students',
    });
  }
  if (missingBirthdate > 0) {
    problems.push({
      id: 4, label: 'Dates de naissance manquantes', severity: 'warning', recordCount: missingBirthdate,
      actionLabel: 'Corriger les dates', actionUrl: '/dashboard/students',
    });
  }

  const totalErrors = problems.reduce((sum, p) => sum + p.recordCount, 0);
  const errorDistribution: ErrorBar[] = totalErrors > 0
    ? problems.map(p => ({
        name: p.label,
        count: p.recordCount,
        pct: Math.round((p.recordCount / totalErrors) * 1000) / 10,
        color: p.severity === 'danger' ? '#E5544B' : '#E8A33D',
      }))
    : [];

  // Real recent migration source files: only files recorded under an import module
  // slug count as migration sources. Export artifacts and scheduled-job outputs are
  // not source files and are excluded.
  const MIGRATION_SOURCE_MODULES = ['students-import', 'teachers-import', 'import', 'migration'];
  const fileRows = await db
    .select({
      id: files.id,
      fileName: files.fileName,
      sizeBytes: files.sizeBytes,
      module: files.module,
      uploadedBy: files.uploadedBy,
      uploaderName: user.name,
      createdAt: files.createdAt,
    })
    .from(files)
    .leftJoin(user, eq(files.uploadedBy, user.id))
    .where(and(
      eq(files.tenantId, tenantId),
      eq(files.isDeleted, false),
      inArray(files.module, MIGRATION_SOURCE_MODULES),
    ))
    .orderBy(desc(files.createdAt))
    .limit(5);
  // The `files` table has no per-file import state (no status column) and no
  // import-pipeline state machine exists yet, so we never claim a pipeline stage.
  // The badge shows the file's real purpose (module) instead of the fabricated
  // 'Importé' label that used to be applied to every row.
  const MODULE_LABEL: Record<string, string> = {
    'students-import': 'Import élèves',
    'teachers-import': 'Import enseignants',
    import: 'Fichier source',
    migration: 'Fichier source',
  };
  const recentFiles: RecentFileItem[] = fileRows.map(f => ({
    id: f.id,
    name: f.fileName,
    size: formatBytes(f.sizeBytes),
    author: f.uploaderName ?? (f.uploadedBy ? `Utilisateur (${f.uploadedBy.slice(0, 8)})` : '—'),
    time: f.createdAt ? new Date(f.createdAt).toLocaleString('fr-FR') : '—',
    status: MODULE_LABEL[f.module] ?? f.module,
  }));

  const hasData = studentCount > 0 || recentFiles.length > 0;
  const mappedColumnsCount = state.columnMappings.length;
  const totalColumnsCount = state.totalColumnsCount;
  const mappingsComplete = mappedColumnsCount >= totalColumnsCount;

  // Steps derived from real signals.
  const steps: MigrationStep[] = MIGRATION_STEPS.map(s => {
    let status: MigrationStep['status'] = 'pending';
    if (s.id === 1) status = recentFiles.length > 0 ? 'done' : 'pending';
    else if (s.id === 2) status = hasData ? (mappingsComplete ? 'done' : 'in_progress') : 'pending';
    else if (s.id === 3) status = hasData ? (problems.length === 0 ? 'done' : 'in_progress') : 'pending';
    else if (s.id === 4) status = studentCount > 0 ? 'done' : 'pending';
    return { ...s, status };
  });

  const stepsDone = steps.filter(s => s.status === 'done').length;
  const stepsScore = (stepsDone / steps.length) * 70;
  let dataScore = 0;
  if (studentCount > 0) {
    const phoneOk = Math.max(0, studentCount - missingPhone) / studentCount;
    const classOk = Math.max(0, studentCount - missingClass) / studentCount;
    dataScore = ((phoneOk + classOk) / 2) * 30;
  }
  const readinessScore = Math.round(stepsScore + dataScore);

  const danger = problems.filter(p => p.severity === 'danger');
  let nextRecommendation: MigrationReadinessData['nextRecommendation'] = null;
  if (danger.length > 0) {
    nextRecommendation = {
      type: 'warning',
      title: `Action Prioritaire : ${danger[0]!.label}`,
      description: `Corriger ${danger[0]!.recordCount} fiches concernées avant de lancer l'importation finale.`,
    };
  } else if (!hasData) {
    nextRecommendation = {
      type: 'info',
      title: 'Aucune donnée importée pour le moment',
      description: 'Commencez par télécharger le modèle Excel, cartographiez les colonnes puis importez votre premier fichier.',
    };
  }

  return {
    readinessScore,
    fileCount: recentFiles.length,
    entityCounts: { students: studentCount, guardians: guardianCount, classes: classCount },
    steps,
    qualityProblems: problems,
    columnMappings: state.columnMappings,
    mappedColumnsCount,
    totalColumnsCount,
    errorDistribution,
    totalErrors,
    recentFiles,
    tasks: state.tasks,
    nextRecommendation,
  };
}
