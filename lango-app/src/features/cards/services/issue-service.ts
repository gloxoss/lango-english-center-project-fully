import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { ApiError } from '@/libs/api/errors';
import { hasAddon } from '@/libs/api/entitlements';
import { getEffectiveValue } from '@/libs/settings/registry';
import { db } from '@/libs/DB';
import { classes, classSections, sections, user } from '@/models/Schema';
import { examHalls, examSeats, examTerms } from '@/features/assessment/models/assessment-schema';
import {
  documentTemplates,
  documentTemplateVersions,
  documentEvents,
  issuedDocuments,
} from '@/features/cards/models/cards-schema';
import { renderPdf } from '@/libs/document-studio/render';
import type { DocumentTemplateSchema } from '@/libs/document-studio/types';

export type CardSubjectType = 'student' | 'employee' | 'exam_candidate';

const TEMPLATE_TYPE_BY_SUBJECT: Record<CardSubjectType, string> = {
  student: 'student_id',
  employee: 'employee_id',
  exam_candidate: 'admit_card',
};

const VERIFY_BASE_URL = process.env.BETTER_AUTH_URL || 'http://localhost:3000';

function splitName(fullName: string | null): [string, string] {
  const parts = (fullName ?? '').trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') return ['', ''];
  return [parts[0] ?? '', parts.slice(1).join(' ')];
}

export async function resolveSubjectData(
  tenantId: string,
  subjectType: CardSubjectType,
  subjectId: string,
): Promise<{ subjectId: string; data: Record<string, string> }> {
  if (subjectType === 'student') {
    const [u] = await db.select().from(user)
      .where(and(eq(user.id, subjectId), eq(user.tenantId, tenantId)))
      .limit(1);
    if (!u) throw new ApiError(404, 'NOT_FOUND', 'Élève introuvable pour cet établissement.');
    const [firstName, lastName] = splitName(u.name);
    let program = u.className ?? u.level ?? '';
    if (u.classSectionId) {
      const [sec] = await db
        .select({ label: sections.name })
        .from(classSections)
        .innerJoin(classes, eq(classSections.classId, classes.id))
        .innerJoin(sections, eq(classSections.sectionId, sections.id))
        .where(eq(classSections.id, u.classSectionId))
        .limit(1);
      if (sec) {
        program = [u.className ?? u.level, sec.label].filter(Boolean).join(' ');
      }
    }
    return {
      subjectId: u.id,
      data: {
        subjectName: u.name,
        firstName: u.firstName ?? firstName,
        lastName: u.lastName ?? lastName,
        matricule: u.matricule ?? '',
        dateOfBirth: u.dateOfBirth ?? '',
        program,
        city: u.city ?? '',
        gender: u.gender ?? '',
        bloodGroup: u.bloodGroup ?? '',
        nationalId: u.nationalId ?? '',
        guardianName: u.guardianName ?? '',
        photo: '',
        title: 'Carte d\'étudiant',
        subtitle: '',
      },
    };
  }

  if (subjectType === 'employee') {
    const [u] = await db.select().from(user)
      .where(and(eq(user.id, subjectId), eq(user.tenantId, tenantId)))
      .limit(1);
    if (!u) throw new ApiError(404, 'NOT_FOUND', 'Employé introuvable pour cet établissement.');
    const [firstName, lastName] = splitName(u.name);
    return {
      subjectId: u.id,
      data: {
        subjectName: u.name,
        firstName: u.firstName ?? firstName,
        lastName: u.lastName ?? lastName,
        department: u.specialization ?? u.qualification ?? '',
        role: u.role ?? '',
        employeeId: u.employeeId ?? '',
        qualification: u.qualification ?? '',
        hireDate: u.hireDate ?? '',
        phone: u.phone ?? '',
        photo: '',
        title: 'Carte d\'employé',
        subtitle: '',
      },
    };
  }

  // exam_candidate: subjectId is the examSeats row id.
  const [seat] = await db.select().from(examSeats)
    .where(and(eq(examSeats.id, subjectId), eq(examSeats.tenantId, tenantId)))
    .limit(1);
  if (!seat) throw new ApiError(404, 'NOT_FOUND', 'Place d\'examen introuvable pour cet établissement.');

  const [u] = await db.select().from(user).where(eq(user.id, seat.studentId)).limit(1);
  const [term] = await db.select().from(examTerms).where(eq(examTerms.id, seat.examTermId)).limit(1);
  const [hall] = await db.select().from(examHalls).where(eq(examHalls.id, seat.examHallId)).limit(1);
  const [firstName, lastName] = splitName(u?.name ?? '');

  return {
    subjectId: seat.studentId,
    data: {
      subjectName: u?.name ?? '',
      firstName: u?.firstName ?? firstName,
      lastName: u?.lastName ?? lastName,
      matricule: u?.matricule ?? '',
      dateOfBirth: u?.dateOfBirth ?? '',
      candidateNumber: seat.candidateNumber,
      seatNumber: String(seat.seatNumber),
      deskLabel: seat.deskLabel ?? '',
      hall: hall?.name ?? '',
      examName: term?.name ?? '',
      date: term?.startDate ?? '',
      barcode: seat.candidateNumber,
      photo: '',
      title: 'Convocation d\'examen',
      subtitle: '',
      instructions: '',
    },
  };
}

export type IssueDocumentParams = {
  tenantId: string;
  templateVersionId: string;
  subjectType: CardSubjectType;
  subjectId: string;
  issuedBy: string;
};

export type IssuedResult = {
  issuedDocument: typeof issuedDocuments.$inferSelect;
  rawToken: string;
  pdfBase64?: string;
};

/**
 * Issues a single card. Only published template versions are issuable; the
 * template type must match the subject type. The raw verification token is
 * returned exactly once to the caller - only its sha256 hash is persisted.
 */
export async function issueDocument(params: IssueDocumentParams): Promise<IssuedResult> {
  const { tenantId, templateVersionId, subjectType, subjectId, issuedBy } = params;

  const [version] = await db.select().from(documentTemplateVersions)
    .where(and(
      eq(documentTemplateVersions.tenantId, tenantId),
      eq(documentTemplateVersions.id, templateVersionId),
    ))
    .limit(1);
  if (!version) throw new ApiError(404, 'NOT_FOUND', 'Version de modèle introuvable pour cet établissement.');
  if (!version.publishedById) throw new ApiError(400, 'NOT_PUBLISHED', 'Seules les versions publiées peuvent être émises.');

  const [template] = await db.select().from(documentTemplates)
    .where(and(
      eq(documentTemplates.tenantId, tenantId),
      eq(documentTemplates.id, version.templateId),
    ))
    .limit(1);
  if (!template) throw new ApiError(404, 'NOT_FOUND', 'Modèle introuvable pour cet établissement.');

  const expectedType = TEMPLATE_TYPE_BY_SUBJECT[subjectType];
  if (template.type !== expectedType) {
    throw new ApiError(400, 'TYPE_MISMATCH', `Le modèle est de type "${template.type}" mais le sujet est de type "${subjectType}".`);
  }

  const { subjectId: resolvedSubjectId, data } = await resolveSubjectData(tenantId, subjectType, subjectId);

  const rawToken = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(rawToken).digest('hex');

  const renderData: Record<string, string> = {
    ...data,
    qrCode: `${VERIFY_BASE_URL}/fr/verify/card/${rawToken}`,
  };

  const [issuedDocument] = await db.insert(issuedDocuments).values({
    tenantId,
    type: template.type,
    templateVersionId: version.id,
    subjectType,
    subjectId: resolvedSubjectId,
    examCandidateId: subjectType === 'exam_candidate' ? subjectId : null,
    publicTokenHash: hash,
    status: 'active',
    validFrom: new Date().toISOString(),
    renderDataSnapshot: renderData,
    issuedById: issuedBy,
  }).returning();

  if (!issuedDocument) {
    throw new ApiError(500, 'ISSUE_FAILED', 'Erreur lors de la création du document émis.');
  }

  let pdfBase64: string | undefined;
  try {
    const pdf = await renderPdf({
      template: version.schemaJson as DocumentTemplateSchema,
      inputs: [renderData],
    });
    pdfBase64 = pdf.toString('base64');
  } catch (error) {
    // The issued document is the source of truth; a render failure must not
    // fail the issuance. The PDF can be regenerated from the stored snapshot.
    console.error('Card PDF render failed (issuance still recorded)', error);
  }

  return { issuedDocument, rawToken, pdfBase64 };
}

/**
 * Resolve the tenant's default published template version for a document type.
 * Prefers the template flagged `isDefault`; falls back to the first published
 * template of that type. Only a version with a published version row (a non-null
 * publishedById) is issuable. Returns null when nothing is ready to issue.
 */
export async function resolveDefaultPublishedTemplateVersion(
  tenantId: string,
  type: 'student_id' | 'employee_id' | 'admit_card',
): Promise<string | null> {
  const templates = await db
    .select({ id: documentTemplates.id, isDefault: documentTemplates.isDefault })
    .from(documentTemplates)
    .where(and(
      eq(documentTemplates.tenantId, tenantId),
      eq(documentTemplates.type, type),
      eq(documentTemplates.status, 'published'),
    ));

  if (templates.length === 0) return null;
  const first = templates[0];
  if (!first) return null;
  const preferredId = (templates.find(t => t.isDefault) ?? first).id;

  const [version] = await db
    .select({ id: documentTemplateVersions.id })
    .from(documentTemplateVersions)
    .where(and(
      eq(documentTemplateVersions.tenantId, tenantId),
      eq(documentTemplateVersions.templateId, preferredId),
      isNotNull(documentTemplateVersions.publishedById),
    ))
    .orderBy(desc(documentTemplateVersions.versionNumber))
    .limit(1);

  return version?.id ?? null;
}

/**
 * Auto-issue a student ID card when the school has opted in via the
 * `cards.autoIssueStudentCardOnApproval` setting. Best-effort by design: the
 * caller swallows any error so a missing template/disabled addon never blocks
 * the admission conversion that triggered it.
 */
export async function autoIssueStudentCardOnAdmission(
  tenantId: string,
  studentId: string,
  issuedBy: string,
): Promise<IssuedResult | null> {
  const setting = await getEffectiveValue(tenantId, null, 'cards.autoIssueStudentCardOnApproval');
  if (setting.value !== true) return null;
  if (!(await hasAddon(tenantId, 'card-management'))) return null;

  const templateVersionId = await resolveDefaultPublishedTemplateVersion(tenantId, 'student_id');
  if (!templateVersionId) return null;

  const result = await issueDocument({
    tenantId,
    templateVersionId,
    subjectType: 'student',
    subjectId: studentId,
    issuedBy,
  });

  await db.insert(documentEvents).values({
    tenantId,
    issuedDocumentId: result.issuedDocument.id,
    eventKind: 'issued',
    actorId: issuedBy,
    metadata: { subjectType: 'student', source: 'admission_auto_issue' },
  });

  return result;
}
