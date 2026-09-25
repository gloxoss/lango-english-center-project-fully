import { Buffer } from 'node:buffer';
import { and, eq, inArray } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { assessmentDefinitions, assessmentOutcomes } from '@/features/assessment/models/assessment-schema';
import { ExamMasterService } from '@/features/assessment/services/exam-master-service';
import { requireExamTermStage } from '@/features/assessment/services/exam-term-guard';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { classes, classSections, sections, tenants, user } from '@/models/Schema';

export type MassarImportResult = {
  totalProcessed: number;
  importedCount: number;
  errorCount: number;
  errors: string[];
};

/**
 * Generates an official Moroccan Ministry of National Education (MEN)
 * Massar-compatible Excel student roster.
 */
export type MassarValidationStudent = {
  id: string;
  name: string;
  codeMassar: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  className: string | null;
  status: 'valid' | 'blocked';
  blockingReasons: string[];
};

export type MassarValidationReport = {
  total: number;
  validCount: number;
  blockedCount: number;
  students: MassarValidationStudent[];
};

/**
 * Validates students prior to official MEN Massar export.
 * Identifies missing codes or mandatory fields without generating fake data.
 */
export async function validateMassarStudentRoster(
  tenantId: string,
  options?: {
    classSectionId?: string;
    branchId?: string;
    studentIds?: string[];
  },
): Promise<MassarValidationReport> {
  const conditions = [
    eq(user.tenantId, tenantId),
    eq(user.role, 'student'),
    eq(user.userStatus, 'active'),
  ];
  if (options?.classSectionId) {
    conditions.push(eq(user.classSectionId, options.classSectionId));
  }
  if (options?.branchId) {
    conditions.push(eq(user.branchId, options.branchId));
  }
  if (options?.studentIds && options.studentIds.length > 0) {
    conditions.push(inArray(user.id, options.studentIds));
  }

  const students = await db
    .select({
      id: user.id,
      name: user.name,
      codeMassar: user.nationalId,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      className: classes.name,
      sectionName: sections.name,
    })
    .from(user)
    .leftJoin(classSections, eq(user.classSectionId, classSections.id))
    .leftJoin(classes, eq(classSections.classId, classes.id))
    .leftJoin(sections, eq(classSections.sectionId, sections.id))
    .where(and(...conditions))
    .orderBy(user.name);

  const validationResults: MassarValidationStudent[] = students.map((s) => {
    const blockingReasons: string[] = [];
    const code = s.codeMassar?.trim();
    if (!code) {
      blockingReasons.push('Code Massar manquant');
    } else if (code.startsWith('MA-STU-') || code.length < 5) {
      blockingReasons.push('Code Massar non conforme');
    }

    if (!s.gender) {
      blockingReasons.push('Genre non renseigné');
    }
    if (!s.dateOfBirth) {
      blockingReasons.push('Date de naissance manquante');
    }

    const fullClassName = s.className ? `${s.className} ${s.sectionName || ''}`.trim() : 'Sans section';

    return {
      id: s.id,
      name: s.name,
      codeMassar: s.codeMassar,
      gender: s.gender,
      dateOfBirth: s.dateOfBirth,
      className: fullClassName,
      status: blockingReasons.length === 0 ? 'valid' : 'blocked',
      blockingReasons,
    };
  });

  const validCount = validationResults.filter(s => s.status === 'valid').length;
  const blockedCount = validationResults.filter(s => s.status === 'blocked').length;

  return {
    total: validationResults.length,
    validCount,
    blockedCount,
    students: validationResults,
  };
}

/**
 * Generates an official Moroccan Ministry of National Education (MEN)
 * Massar-compatible Excel student roster.
 * Strictly avoids generating fake/synthetic codes.
 */
export async function generateMassarStudentRoster(
  tenantId: string,
  options?: {
    classSectionId?: string;
    branchId?: string;
    studentIds?: string[];
    onlyValid?: boolean;
  },
): Promise<{ buffer: Buffer; filename: string }> {
  const [tenant] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const schoolName = tenant?.name || 'Établissement';

  let sectionName = 'Toutes les sections';
  if (options?.classSectionId) {
    const [sec] = await db
      .select({ sectionName: sections.name, className: classes.name })
      .from(classSections)
      .leftJoin(classes, eq(classSections.classId, classes.id))
      .leftJoin(sections, eq(classSections.sectionId, sections.id))
      .where(and(eq(classSections.id, options.classSectionId), eq(classSections.tenantId, tenantId)))
      .limit(1);
    if (sec) {
      sectionName = `${sec.className || ''} - ${sec.sectionName || ''}`.trim();
    }
  }

  // Fetch students
  const conditions = [
    eq(user.tenantId, tenantId),
    eq(user.role, 'student'),
    eq(user.userStatus, 'active'),
  ];
  if (options?.classSectionId) {
    conditions.push(eq(user.classSectionId, options.classSectionId));
  }
  if (options?.branchId) {
    conditions.push(eq(user.branchId, options.branchId));
  }
  if (options?.studentIds && options.studentIds.length > 0) {
    conditions.push(inArray(user.id, options.studentIds));
  }

  let students = await db
    .select({
      id: user.id,
      name: user.name,
      codeMassar: user.nationalId,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
    })
    .from(user)
    .where(and(...conditions))
    .orderBy(user.name);

  if (options?.onlyValid) {
    students = students.filter(s => !!s.codeMassar?.trim() && !s.codeMassar.startsWith('MA-STU-') && !!s.dateOfBirth);
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('MASSAR_ELEVES');

  // Title Banner
  sheet.addRow(['ROYAUME DU MAROC - MINISTÈRE DE L’ÉDUCATION NATIONALE']);
  sheet.addRow([`ÉTABLISSEMENT : ${schoolName.toUpperCase()} | CLASSE : ${sectionName}`]);
  sheet.addRow([`DATE D'EXPORT : ${new Date().toLocaleDateString('fr-MA')} | FORMAT MASSAR OFFICIEL`]);
  sheet.addRow([]); // Blank row

  const headers = [
    'N° Ordre',
    'Code Massar',
    'Nom Complet',
    'Genre',
    'Date de Naissance',
    'Statut',
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF17A673' }, // Moroccan Emerald
  };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

  students.forEach((s, idx) => {
    const genderLabel = s.gender === 'female' ? 'Féminin' : 'Masculin';
    const dobLabel = s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString('fr-MA') : '—';
    // STRICT INVARIANT: Never invent fake codes. If missing, leave empty.
    const cleanCodeMassar = s.codeMassar?.trim() || '';

    const row = sheet.addRow([
      idx + 1,
      cleanCodeMassar,
      s.name,
      genderLabel,
      dobLabel,
      'Inscrit',
    ]);
    if (idx % 2 === 1) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF6F9FC' },
      };
    }
  });

  sheet.columns = [
    { width: 12 },
    { width: 22 },
    { width: 35 },
    { width: 15 },
    { width: 20 },
    { width: 15 },
  ];

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const filename = `Massar_Eleves_${sectionName.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.xlsx`;
  return { buffer: Buffer.from(arrayBuffer), filename };
}

/**
 * Generates an official Moroccan Massar Marksheet for an assessment definition.
 */
export async function generateMassarMarksheet(
  tenantId: string,
  assessmentDefId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const [assessment] = await db
    .select()
    .from(assessmentDefinitions)
    .where(and(eq(assessmentDefinitions.id, assessmentDefId), eq(assessmentDefinitions.tenantId, tenantId)))
    .limit(1);

  if (!assessment) {
    throw new Error('Évaluation introuvable.');
  }

  // Get existing outcomes
  const outcomes = await db
    .select()
    .from(assessmentOutcomes)
    .where(and(eq(assessmentOutcomes.assessmentDefinitionId, assessmentDefId), eq(assessmentOutcomes.tenantId, tenantId)));

  const outcomesMap = new Map(outcomes.map(o => [o.studentId, o]));

  // Get enrolled students
  const students = await db
    .select({
      id: user.id,
      name: user.name,
      codeMassar: user.nationalId,
    })
    .from(user)
    .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), eq(user.userStatus, 'active')))
    .orderBy(user.name);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('MASSAR_NOTES');

  sheet.addRow(['MINISTÈRE DE L’ÉDUCATION NATIONALE DU MAROC']);
  sheet.addRow([`RELEVÉ DE NOTES MASSAR : ${assessment.title.toUpperCase()}`]);
  sheet.addRow([`BARÈME MAROCAIN : /20 | COEFFICIENT : ${assessment.coefficient || '1.00'} | REF: ${assessment.id}`]);
  sheet.addRow([]);

  const headers = [
    'N° Ordre',
    'Code Massar',
    'Nom & Prénom de l’Élève',
    'Note /20',
    'Absent (O/N)',
    'Observations / Appréciation',
  ];

  const headerRow = sheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1B6C93' }, // Moroccan Royal Blue
  };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

  students.forEach((s, idx) => {
    const outcome = outcomesMap.get(s.id);
    const scoreVal = outcome?.rawScore ? Number(outcome.rawScore) : '';
    const absentVal = outcome?.status === 'absent' ? 'O' : 'N';
    const feedbackVal = outcome?.grade || '';

    const row = sheet.addRow([
      idx + 1,
      s.codeMassar || '',
      s.name,
      scoreVal,
      absentVal,
      feedbackVal,
    ]);

    if (idx % 2 === 1) {
      row.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF6F9FC' },
      };
    }
  });

  sheet.columns = [
    { width: 12 },
    { width: 22 },
    { width: 35 },
    { width: 15 },
    { width: 15 },
    { width: 35 },
  ];

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const filename = `Massar_Notes_${assessment.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.xlsx`;
  return { buffer: Buffer.from(arrayBuffer), filename };
}

/**
 * Parses an uploaded Massar Excel notes file and persists scores to assessmentOutcomes.
 * Validates Moroccan /20 grade range (0.00 to 20.00).
 */
/**
 * The import used to write assessment_outcomes directly: no term-stage lock
 * (published marks could be overwritten), no teacher class scoping, no
 * moderation lock, no revision trail, and every paper assumed /20. It now
 * parses the sheet, applies the same guards as grade entry, and saves through
 * ExamMasterService.saveMarksheetGrid (bounds, locks, revisions).
 */
export async function parseAndImportMassarMarks(
  tenantId: string,
  assessmentDefId: string,
  fileBuffer: Buffer,
  options: { markerId: string; writableStudentIds: Set<string> | null },
): Promise<MassarImportResult> {
  const [assessment] = await db
    .select()
    .from(assessmentDefinitions)
    .where(and(eq(assessmentDefinitions.id, assessmentDefId), eq(assessmentDefinitions.tenantId, tenantId)))
    .limit(1);

  if (!assessment) {
    throw new ApiError(404, 'NOT_FOUND', 'Évaluation introuvable.');
  }
  if (assessment.termId) {
    await requireExamTermStage(tenantId, assessment.termId, 'enter_marks');
  }
  const maximumScore = Number(assessment.maximumScore) || 20;

  // Pre-fetch all students in tenant for fast in-memory matching
  const students = await db
    .select({
      id: user.id,
      name: user.name,
      codeMassar: user.nationalId,
    })
    .from(user)
    .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student')));

  const studentsByCode = new Map<string, typeof students[0]>();
  const studentsByName = new Map<string, typeof students[0]>();

  // Two students with the same name must not be matched by name: the mark
  // would land on whichever came last.
  const ambiguousNames = new Set<string>();
  for (const s of students) {
    if (s.codeMassar) {
      studentsByCode.set(s.codeMassar.trim().toUpperCase(), s);
    }
    if (s.name) {
      const key = s.name.trim().toLowerCase();
      if (studentsByName.has(key)) {
        ambiguousNames.add(key);
      }
      studentsByName.set(key, s);
    }
  }
  for (const key of ambiguousNames) {
    studentsByName.delete(key);
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(fileBuffer as any);
  } catch {
    throw new ApiError(422, 'INVALID_FILE', 'Fichier Excel illisible (.xlsx attendu).');
  }
  const sheet = workbook.worksheets[0];

  if (!sheet) {
    throw new ApiError(422, 'INVALID_FILE', 'Le classeur Excel ne contient aucune feuille.');
  }

  const result: MassarImportResult = {
    totalProcessed: 0,
    importedCount: 0,
    errorCount: 0,
    errors: [],
  };

  // Find header row containing "Code Massar" or "Note"
  let headerRowIndex = -1;
  let codeColIdx = -1;
  let nameColIdx = -1;
  let scoreColIdx = -1;
  let absentColIdx = -1;
  let feedbackColIdx = -1;

  sheet.eachRow((row, rowNumber) => {
    if (headerRowIndex !== -1) {
      return;
    }
    row.eachCell((cell, colNumber) => {
      const val = String(cell.value || '').toLowerCase();
      if (val.includes('massar') || val.includes('code')) {
        codeColIdx = colNumber;
      }
      if (val.includes('nom') || val.includes('prénom')) {
        nameColIdx = colNumber;
      }
      if (val.includes('note') || val.includes('/20') || val.includes('score')) {
        scoreColIdx = colNumber;
      }
      if (val.includes('absent') || val.includes('absence')) {
        absentColIdx = colNumber;
      }
      if (val.includes('observ') || val.includes('appréc') || val.includes('remarque')) {
        feedbackColIdx = colNumber;
      }
    });

    if (codeColIdx !== -1 || scoreColIdx !== -1) {
      headerRowIndex = rowNumber;
    }
  });

  if (headerRowIndex === -1 || scoreColIdx === -1) {
    throw new ApiError(422, 'INVALID_FILE', 'En-têtes Massar non reconnus. Veuillez utiliser le modèle de notes officiel généré par SchoolOS.');
  }

  // Iterate over data rows
  const outcomesToCommit: Array<{
    studentId: string;
    score: string | null;
    isExcused: boolean;
    feedback: string | null;
  }> = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) {
      return;
    }

    const rawCode = codeColIdx !== -1 ? String(row.getCell(codeColIdx).value || '').trim().toUpperCase() : '';
    const rawName = nameColIdx !== -1 ? String(row.getCell(nameColIdx).value || '').trim().toLowerCase() : '';
    const rawScore = row.getCell(scoreColIdx).value;
    const rawAbsent = absentColIdx !== -1 ? String(row.getCell(absentColIdx).value || '').trim().toUpperCase() : 'N';
    const rawFeedback = feedbackColIdx !== -1 ? String(row.getCell(feedbackColIdx).value || '').trim() : '';

    if (!rawCode && !rawName) {
      return;
    } // Skip empty rows

    result.totalProcessed++;

    // Find student
    const matchedStudent = (rawCode ? studentsByCode.get(rawCode) : null) || (rawName ? studentsByName.get(rawName) : null);

    if (!matchedStudent) {
      result.errorCount++;
      result.errors.push(`Ligne ${rowNumber}: Aucun élève trouvé pour le code Massar "${rawCode || rawName}".`);
      return;
    }

    const isAbsent = rawAbsent === 'O' || rawAbsent === 'OUI' || rawAbsent === 'ABSENT';

    let scoreStr: string | null = null;
    if (!isAbsent && rawScore !== null && rawScore !== undefined && rawScore !== '') {
      const numScore = Number(rawScore);
      if (Number.isNaN(numScore) || numScore < 0 || numScore > maximumScore) {
        result.errorCount++;
        result.errors.push(`Ligne ${rowNumber}: Note invalide (${rawScore}) pour ${matchedStudent.name}. La note doit être comprise entre 0 et ${maximumScore}.`);
        return;
      }
      scoreStr = numScore.toFixed(2);
    }

    outcomesToCommit.push({
      studentId: matchedStudent.id,
      score: scoreStr,
      isExcused: isAbsent,
      feedback: rawFeedback || null,
    });
  });

  // Rows with neither a mark nor an absence carry nothing to record.
  const marks = outcomesToCommit
    .filter(item => item.isExcused || item.score !== null)
    .map(item => ({
      studentId: item.studentId,
      rawScore: item.isExcused || item.score === null ? undefined : Number(item.score),
      status: (item.isExcused ? 'absent' : 'graded') as 'absent' | 'graded',
    }));

  const seen = new Set<string>();
  for (const m of marks) {
    if (seen.has(m.studentId)) {
      throw new ApiError(422, 'DUPLICATE_STUDENT', 'Le fichier contient plusieurs lignes pour le même élève.');
    }
    seen.add(m.studentId);
  }

  // Same rule as grade entry: refused whole, since a partial import would leave
  // a teacher believing marks were saved that were not.
  if (options.writableStudentIds) {
    const outside = marks.filter(m => !options.writableStudentIds!.has(m.studentId));
    if (outside.length > 0) {
      throw new ApiError(403, 'FORBIDDEN', `Le fichier contient ${outside.length} élève(s) hors de vos classes. Import refusé.`);
    }
  }

  if (marks.length > 0) {
    await ExamMasterService.saveMarksheetGrid({
      tenantId,
      assessmentDefinitionId: assessmentDefId,
      markerId: options.markerId,
      marks,
    });
  }
  result.importedCount = marks.length;

  return result;
}
