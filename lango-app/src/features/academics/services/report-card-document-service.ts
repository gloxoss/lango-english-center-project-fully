import { and, eq } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { renderPdf } from '@/libs/document-studio/render';
import type { DocumentTemplateSchema } from '@/libs/document-studio/types';
import { documentTemplates, documentTemplateVersions, issuedDocuments } from '@/features/cards/models/cards-schema';
import { user } from '@/models/Schema';
import { getClassReportCards, type ReportCard } from './report-card-service';

// A sensible A4 portrait default: header fields + a multi-line subject list.
// Field `name`s map 1:1 to the flattened bulletin data produced by flattenCard.
const DEFAULT_REPORT_CARD_SCHEMA = {
  basePdf: { width: 210, height: 297, padding: [15, 15, 15, 15] },
  schemas: [[
    { name: 'title', type: 'text', position: { x: 15, y: 15 }, width: 180, height: 14, content: 'Bulletin scolaire', fontName: 'Roboto', fontSize: 20, alignment: 'center' },
    { name: 'studentName', type: 'text', position: { x: 15, y: 40 }, width: 180, height: 10, content: '', fontName: 'Roboto', fontSize: 14, alignment: 'left' },
    { name: 'className', type: 'text', position: { x: 15, y: 54 }, width: 180, height: 8, content: '', fontName: 'Roboto', fontSize: 11, alignment: 'left' },
    { name: 'matricule', type: 'text', position: { x: 15, y: 64 }, width: 180, height: 8, content: '', fontName: 'Roboto', fontSize: 10, alignment: 'left' },
    { name: 'generalAverage', type: 'text', position: { x: 15, y: 76 }, width: 180, height: 10, content: '', fontName: 'Roboto', fontSize: 12, alignment: 'left' },
    { name: 'mention', type: 'text', position: { x: 15, y: 88 }, width: 180, height: 8, content: '', fontName: 'Roboto', fontSize: 10, alignment: 'left' },
    { name: 'rank', type: 'text', position: { x: 15, y: 98 }, width: 180, height: 8, content: '', fontName: 'Roboto', fontSize: 10, alignment: 'left' },
    { name: 'subjects', type: 'text', position: { x: 15, y: 112 }, width: 180, height: 160, content: '', fontName: 'Roboto', fontSize: 10, alignment: 'left', lineHeight: 1.6 },
  ]],
};

function flattenCard(card: ReportCard): Record<string, string> {
  const subjects = card.subjects
    .map(s => `${s.subjectName} (coef ${s.coefficient}) — ${s.average.toFixed(2)}/20`)
    .join('\n');
  return {
    title: 'Bulletin scolaire',
    studentName: card.student.name,
    className: card.student.className ?? '',
    matricule: card.student.matricule ?? '',
    generalAverage: `Moyenne générale : ${card.generalAverage.toFixed(2)} / 20`,
    mention: card.mention ? `Mention : ${card.mention}` : '',
    rank: card.rank ? `Rang : ${card.rank} / ${card.classSize}` : '',
    subjects,
  };
}

export type ReportCardVersion = typeof documentTemplateVersions.$inferSelect;

/** Validates a report_card template version is present, published and of the right type. */
export async function resolveReportCardVersion(tenantId: string, templateVersionId: string): Promise<ReportCardVersion> {
  const [version] = await db.select().from(documentTemplateVersions)
    .where(and(
      eq(documentTemplateVersions.tenantId, tenantId),
      eq(documentTemplateVersions.id, templateVersionId),
    ))
    .limit(1);
  if (!version) throw new ApiError(404, 'NOT_FOUND', 'Version de modèle introuvable.');
  if (!version.publishedById) throw new ApiError(400, 'NOT_PUBLISHED', 'Seule une version publiée peut être émise.');

  const [template] = await db.select().from(documentTemplates)
    .where(and(eq(documentTemplates.tenantId, tenantId), eq(documentTemplates.id, version.templateId)))
    .limit(1);
  if (!template || template.type !== 'report_card') {
    throw new ApiError(400, 'TYPE_MISMATCH', 'Ce modèle n\'est pas un modèle de bulletin.');
  }
  return version;
}

/** Lazily seeds a published report_card template if the tenant has none. Returns a published version id. */
export async function ensureDefaultReportCardTemplate(tenantId: string, createdBy: string): Promise<string> {
  const [existing] = await db.select({
    versionId: documentTemplateVersions.id,
  })
    .from(documentTemplates)
    .innerJoin(documentTemplateVersions, eq(documentTemplateVersions.templateId, documentTemplates.id))
    .where(and(
      eq(documentTemplates.tenantId, tenantId),
      eq(documentTemplates.type, 'report_card'),
    ))
    .limit(1);

  if (existing?.versionId) return existing.versionId;

  const now = new Date().toISOString();
  const [template] = await db.insert(documentTemplates).values({
    tenantId,
    name: 'Bulletin scolaire (défaut)',
    type: 'report_card',
    status: 'published',
    isDefault: true,
    createdBy,
  }).returning();

  const [version] = await db.insert(documentTemplateVersions).values({
    tenantId,
    templateId: template!.id,
    versionNumber: 1,
    pageWidthMm: 210,
    pageHeightMm: 297,
    orientation: 'portrait',
    schemaJson: DEFAULT_REPORT_CARD_SCHEMA,
    publishedById: createdBy,
    publishedAt: now,
  }).returning();

  return version!.id;
}

export type IssuedReportCard = {
  issuedDocument: typeof issuedDocuments.$inferSelect;
  rawToken: string;
  pdfBase64?: string;
};

/** Renders + records a single bulletin as an issued report_card document. */
export async function issueReportCardDocument(params: {
  tenantId: string;
  version: ReportCardVersion;
  card: ReportCard;
  issuedBy: string;
}): Promise<IssuedReportCard> {
  const { tenantId, version, card, issuedBy } = params;

  const renderData = flattenCard(card);
  const rawToken = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(rawToken).digest('hex');

  const [issuedDocument] = await db.insert(issuedDocuments).values({
    tenantId,
    type: 'report_card',
    templateVersionId: version.id,
    subjectType: 'student',
    subjectId: card.student.id,
    examCandidateId: null,
    publicTokenHash: hash,
    status: 'active',
    renderDataSnapshot: renderData,
    issuedById: issuedBy,
  }).returning();

  if (!issuedDocument) {
    throw new ApiError(500, 'ISSUE_FAILED', 'Erreur lors de la création du bulletin.');
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
    console.error('Report card PDF render failed (issuance still recorded)', error);
  }

  return { issuedDocument, rawToken, pdfBase64 };
}

/** Resolves a single student's bulletin and issues it as a report_card document. */
export async function issueReportCardPdf(params: {
  tenantId: string;
  templateVersionId: string;
  studentId: string;
  issuedBy: string;
}): Promise<IssuedReportCard> {
  const { tenantId, templateVersionId, studentId, issuedBy } = params;

  const [student] = await db
    .select({ classSectionId: user.classSectionId })
    .from(user)
    .where(and(eq(user.id, studentId), eq(user.tenantId, tenantId), eq(user.role, 'student')))
    .limit(1);
  if (!student) throw new ApiError(404, 'NOT_FOUND', 'Élève introuvable.');
  if (!student.classSectionId) throw new ApiError(422, 'NOT_ASSIGNED', 'Élève non affecté à une classe.');

  const version = await resolveReportCardVersion(tenantId, templateVersionId);
  const { cards } = await getClassReportCards(tenantId, student.classSectionId);
  const card = cards.find(c => c.student.id === studentId);
  if (!card) throw new ApiError(404, 'NOT_FOUND', 'Bulletin introuvable pour cet élève.');

  return issueReportCardDocument({ tenantId, version, card, issuedBy });
}
