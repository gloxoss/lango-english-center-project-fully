import ExcelJS from 'exceljs';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { user, classSections, classes, sections, tenants } from '@/models/Schema';
import { assessmentDefinitions, assessmentOutcomes } from '@/features/assessment/models/assessment-schema';

export interface MassarImportResult {
  totalProcessed: number;
  importedCount: number;
  errorCount: number;
  errors: string[];
}

/**
 * Generates an official Moroccan Ministry of National Education (MEN)
 * Massar-compatible Excel student roster.
 */
export interface MassarValidationStudent {
  id: string;
  name: string;
  codeMassar: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  className: string | null;
  status: 'valid' | 'blocked';
  blockingReasons: string[];
}

export interface MassarValidationReport {
  total: number;
  validCount: number;
  blockedCount: number;
  students: MassarValidationStudent[];
}

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
  }
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

  const validCount = validationResults.filter((s) => s.status === 'valid').length;
  const blockedCount = validationResults.filter((s) => s.status === 'blocked').length;

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
  }
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
  const filename = `Massar_Eleves_${sectionName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.xlsx`;
  return { buffer: Buffer.from(arrayBuffer), filename };
}

/**
 * Generates an official Moroccan Massar Marksheet for an assessment definition.
 */
export async function generateMassarMarksheet(
  tenantId: string,
  assessmentDefId: string
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
  const filename = `Massar_Notes_${assessment.title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.xlsx`;
  return { buffer: Buffer.from(arrayBuffer), filename };
}

/**
 * Parses an uploaded Massar Excel notes file and persists scores to assessmentOutcomes.
 * Validates Moroccan /20 grade range (0.00 to 20.00).
 */
export async function parseAndImportMassarMarks(
  tenantId: string,
  assessmentDefId: string,
  fileBuffer: Buffer
): Promise<MassarImportResult> {
  const [assessment] = await db
    .select()
    .from(assessmentDefinitions)
    .where(and(eq(assessmentDefinitions.id, assessmentDefId), eq(assessmentDefinitions.tenantId, tenantId)))
    .limit(1);

  if (!assessment) {
    throw new Error('Évaluation introuvable.');
  }

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

  for (const s of students) {
    if (s.codeMassar) {
      studentsByCode.set(s.codeMassar.trim().toUpperCase(), s);
    }
    if (s.name) {
      studentsByName.set(s.name.trim().toLowerCase(), s);
    }
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as any);
  const sheet = workbook.worksheets[0];

  if (!sheet) {
    throw new Error('Le classeur Excel ne contient aucune feuille.');
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
    if (headerRowIndex !== -1) return;
    row.eachCell((cell, colNumber) => {
      const val = String(cell.value || '').toLowerCase();
      if (val.includes('massar') || val.includes('code')) codeColIdx = colNumber;
      if (val.includes('nom') || val.includes('prénom')) nameColIdx = colNumber;
      if (val.includes('note') || val.includes('/20') || val.includes('score')) scoreColIdx = colNumber;
      if (val.includes('absent') || val.includes('absence')) absentColIdx = colNumber;
      if (val.includes('observ') || val.includes('appréc') || val.includes('remarque')) feedbackColIdx = colNumber;
    });

    if (codeColIdx !== -1 || scoreColIdx !== -1) {
      headerRowIndex = rowNumber;
    }
  });

  if (headerRowIndex === -1 || scoreColIdx === -1) {
    throw new Error('En-têtes Massar non reconnus. Veuillez utiliser le modèle de notes officiel généré par SchoolOS.');
  }

  // Iterate over data rows
  const outcomesToCommit: Array<{
    studentId: string;
    score: string | null;
    isExcused: boolean;
    feedback: string | null;
  }> = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return;

    const rawCode = codeColIdx !== -1 ? String(row.getCell(codeColIdx).value || '').trim().toUpperCase() : '';
    const rawName = nameColIdx !== -1 ? String(row.getCell(nameColIdx).value || '').trim().toLowerCase() : '';
    const rawScore = row.getCell(scoreColIdx).value;
    const rawAbsent = absentColIdx !== -1 ? String(row.getCell(absentColIdx).value || '').trim().toUpperCase() : 'N';
    const rawFeedback = feedbackColIdx !== -1 ? String(row.getCell(feedbackColIdx).value || '').trim() : '';

    if (!rawCode && !rawName) return; // Skip empty rows

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
      if (Number.isNaN(numScore) || numScore < 0 || numScore > 20) {
        result.errorCount++;
        result.errors.push(`Ligne ${rowNumber}: Note invalide (${rawScore}) pour ${matchedStudent.name}. La note doit être comprise entre 0 et 20.`);
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

  // Batch commit to assessmentOutcomes
  for (const item of outcomesToCommit) {
    const [existing] = await db
      .select({ id: assessmentOutcomes.id })
      .from(assessmentOutcomes)
      .where(
        and(
          eq(assessmentOutcomes.tenantId, tenantId),
          eq(assessmentOutcomes.assessmentDefinitionId, assessmentDefId),
          eq(assessmentOutcomes.studentId, item.studentId)
        )
      )
      .limit(1);

    const statusVal = item.isExcused ? 'absent' : (item.score !== null ? 'graded' : 'pending');
    if (existing) {
      await db
        .update(assessmentOutcomes)
        .set({
          rawScore: item.score !== null ? String(item.score) : null,
          normalizedScore: item.score !== null ? String(item.score) : null,
          status: statusVal,
          grade: item.feedback || null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(assessmentOutcomes.id, existing.id));
    } else {
      await db.insert(assessmentOutcomes).values({
        tenantId,
        assessmentDefinitionId: assessmentDefId,
        studentId: item.studentId,
        rawScore: item.score !== null ? String(item.score) : null,
        normalizedScore: item.score !== null ? String(item.score) : null,
        maximumScoreSnapshot: '20.00',
        status: statusVal,
        grade: item.feedback || null,
        sourceType: 'paper_exam',
        moderationState: 'draft',
      });
    }
    result.importedCount++;
  }

  return result;
}
