import { and, eq } from 'drizzle-orm';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { user } from '@/models/Schema';
import {
  certificateDefinitions,
  certificateDefinitionVersions,
  certificateEvents,
  issuedCertificates,
} from '@/features/certificates/models/certificates-schema';
import { CertificateService } from './certificate-service';
import { renderPdf } from '@/libs/document-studio/render';
import type { DocumentTemplateSchema } from '@/libs/document-studio/types';

export type CertificateRecipientType = 'student' | 'employee';

const STAFF_ROLES = ['teacher', 'accountant', 'receptionist', 'guard', 'school_admin'];

const VERIFY_BASE_URL = process.env.BETTER_AUTH_URL || 'http://localhost:3000';

function splitName(fullName: string | null): [string, string] {
  const parts = (fullName ?? '').trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') return ['', ''];
  return [parts[0] ?? '', parts.slice(1).join(' ')];
}

export async function resolveCertificateRecipient(
  tenantId: string,
  recipientType: CertificateRecipientType,
  recipientId: string,
): Promise<{ recipientId: string; data: Record<string, string> }> {
  const [u] = await db.select().from(user)
    .where(and(eq(user.id, recipientId), eq(user.tenantId, tenantId)))
    .limit(1);
  if (!u) {
    throw new ApiError(404, 'NOT_FOUND', 'Bénéficiaire introuvable pour cet établissement.');
  }

  const expectedRole = recipientType === 'student' ? ['student'] : STAFF_ROLES;
  if (!expectedRole.includes(u.role ?? '')) {
    throw new ApiError(400, 'TYPE_MISMATCH',
      `Le bénéficiaire (rôle "${u.role}") ne correspond pas au type "${recipientType}".`);
  }

  const [firstName, lastName] = splitName(u.name);
  return {
    recipientId: u.id,
    data: {
      subjectName: u.name ?? '',
      firstName: u.firstName ?? firstName,
      lastName: u.lastName ?? lastName,
      matricule: u.matricule ?? '',
      role: u.role ?? '',
      employeeId: u.employeeId ?? '',
      department: u.specialization ?? u.qualification ?? '',
      qualification: u.qualification ?? '',
      hireDate: u.hireDate ?? '',
      phone: u.phone ?? '',
      title: '',
    },
  };
}

export type IssueCertificateParams = {
  tenantId: string;
  definitionId: string;
  definitionVersionId: string;
  recipientType: CertificateRecipientType;
  recipientId: string;
  issuedBy: string;
  ruleType: string;
  ruleParams: Record<string, unknown>;
  requestId?: string | null;
};

export type IssuedCertificateResult = {
  issuedCertificate: typeof issuedCertificates.$inferSelect;
  rawToken: string;
  pdfBase64?: string;
};

/**
 * Issues a single certificate: validates the active definition version +
 * audience, evaluates eligibility (snapshot), records the issue event with the
 * exact render data (the schema stores no render snapshot column, so the
 * re-download route rebuilds the PDF from this event's metadata), renders the
 * PDF and returns the raw token exactly once.
 */
export async function issueCertificate(params: IssueCertificateParams): Promise<IssuedCertificateResult> {
  const {
    tenantId, definitionId, definitionVersionId, recipientType, recipientId,
    issuedBy, ruleType, ruleParams, requestId,
  } = params;

  const [version] = await db.select().from(certificateDefinitionVersions)
    .where(and(
      eq(certificateDefinitionVersions.tenantId, tenantId),
      eq(certificateDefinitionVersions.id, definitionVersionId),
    ))
    .limit(1);
  if (!version) {
    throw new ApiError(404, 'NOT_FOUND', 'Version de définition introuvable pour cet établissement.');
  }
  if (version.status !== 'active') {
    throw new ApiError(400, 'NOT_PUBLISHED', 'Seules les versions actives (publiées) peuvent être émises.');
  }

  const [definition] = await db.select().from(certificateDefinitions)
    .where(and(
      eq(certificateDefinitions.tenantId, tenantId),
      eq(certificateDefinitions.id, definitionId),
    ))
    .limit(1);
  if (!definition) {
    throw new ApiError(404, 'NOT_FOUND', 'Définition introuvable pour cet établissement.');
  }
  if (definition.allowedTargetType !== recipientType) {
    throw new ApiError(400, 'TYPE_MISMATCH',
      `La définition cible "${definition.allowedTargetType}" mais le bénéficiaire est de type "${recipientType}".`);
  }

  const { data } = await resolveCertificateRecipient(tenantId, recipientType, recipientId);

  // The authorizer is always the authenticated actor - never client-supplied
  // and never the 'unknown' sentinel (FIX-PLAN §8).
  const safeParams = { ...ruleParams, authorizedBy: issuedBy };

  const result = await CertificateService.issueCertificate({
    tenantId,
    definitionId,
    versionId: definitionVersionId,
    recipientId,
    issuedBy,
    ruleType,
    ruleParams: safeParams,
  });

  if (!result.success || !result.certificateId) {
    throw new ApiError(400, 'NOT_ELIGIBLE', result.reason ?? 'Le bénéficiaire n\'est pas éligible.');
  }

  const [issuedCertificate] = await db.select().from(issuedCertificates)
    .where(and(
      eq(issuedCertificates.tenantId, tenantId),
      eq(issuedCertificates.id, result.certificateId),
    ))
    .limit(1);
  if (!issuedCertificate) {
    throw new ApiError(500, 'ISSUE_FAILED', 'Certificat introuvable après émission.');
  }

  const renderData: Record<string, string> = {
    ...data,
    serial: issuedCertificate.serialNumber,
    issueDate: issuedCertificate.issuedAt,
    qrCode: `${VERIFY_BASE_URL}/fr/verify/certificate/${result.token}`,
  };

  await db.insert(certificateEvents).values({
    tenantId,
    issuedCertificateId: issuedCertificate.id,
    eventKind: 'issued',
    actorId: issuedBy,
    metadata: {
      definitionId,
      definitionVersionId,
      recipientType,
      recipientId,
      requestId: requestId ?? null,
      ruleType,
      render: renderData,
    },
  });

  let pdfBase64: string | undefined;
  try {
    const pdf = await renderPdf({
      template: {
        basePdf: version.pdfmeBasePdf,
        schemas: version.templateSchema,
      } as DocumentTemplateSchema,
      inputs: [renderData],
    });
    pdfBase64 = pdf.toString('base64');
  } catch (error) {
    // The issued record is the source of truth; a render failure must not fail
    // the issuance. The PDF can be regenerated from the stored event metadata.
    console.error('Certificate PDF render failed (issuance still recorded)', error);
  }

  return { issuedCertificate, rawToken: result.token as string, pdfBase64 };
}
