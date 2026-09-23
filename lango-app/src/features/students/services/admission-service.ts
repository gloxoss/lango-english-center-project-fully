import type { RequestContext } from '@/libs/api/context';
import { randomBytes } from 'node:crypto';
import { and, count, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { autoIssueStudentCardOnAdmission } from '@/features/cards/services/issue-service';
import { assertStudentCapacity } from '@/features/subscriptions/services/plan-limits-service';
import { recordAudit } from '@/libs/api/audit';
import { requireTenant } from '@/libs/api/context';
import { ApiError } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { copyUploadedFile } from '@/libs/api/uploads';
import { db } from '@/libs/DB';
import { reserveMatricule } from '@/libs/services/matricule';
import { recordStudentPlacement } from '@/libs/services/student-placement';
import { hashSetupToken } from '@/libs/setup-token';
import {
  accountSetupTokens,
  admissionComments,
  admissionInterviews,
  applicantDocuments,
  applicants,
  branches,
  classes,
  classSections,
  guardians,
  guardianStudents,
  sessionYears,
  smsMessages,
  studentDocuments,
  studentPhotos,
  studentPlacements,
  user,
} from '@/models/Schema';
import { GuardianResolutionService } from './guardian-resolution-service';

export type ListAdmissionsQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  branchId?: string;
  sessionYearId?: string;
};

export type CreateAdmissionInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  gender?: 'female' | 'male' | 'other';
  nationality?: string;
  motherTongue?: string;
  city?: string;
  bloodGroup?: string;
  nationalId?: string; // Code Massar
  branchId?: string;
  sessionYearId?: string;
  academicYearId?: string; // legacy fallback
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  guardianRelation?: string;
  occupation?: string;
  address?: string;
  emailOptIn?: boolean;
  smsOptIn?: boolean;
  preferredLanguage?: string;
  guardianId?: string;
  consentAccuracy?: boolean;
  consentCndp?: boolean;
  overrideDuplicate?: boolean;
  overrideReason?: string;
};

export type DuplicateMatchSeverity = 'strong' | 'medium' | 'advisory';
export type DuplicateMatchType = 'massar' | 'contact' | 'identity';

export type DuplicateWarning = {
  id: string;
  name: string;
  status: string;
  isEnrolledStudent?: boolean;
  severity: DuplicateMatchSeverity;
  matchType: DuplicateMatchType;
};

export type UpdateAdmissionInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: 'female' | 'male' | 'other';
  nationality?: string;
  motherTongue?: string;
  city?: string;
  bloodGroup?: string;
  nationalId?: string;
  branchId?: string;
  sessionYearId?: string;
  academicYearId?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  guardianRelation?: string;
  occupation?: string;
  address?: string;
  emailOptIn?: boolean;
  smsOptIn?: boolean;
  preferredLanguage?: string;
  guardianId?: string;
  consentAccuracy?: boolean;
  consentCndp?: boolean;
  overrideDuplicate?: boolean;
  overrideReason?: string;
};

export type EnrollApplicantInput = {
  classSectionId?: string | null;
  branchId?: string;
  sessionYearId?: string;
};

// Moroccan Massar Code format: Letter followed by 9 digits (e.g. G134567890)
const MASSAR_CODE_REGEX = /^[A-Z]\d{9}$/i;

function _normalizePhone(phone: string | null | undefined): string {
  if (!phone) {
    return '';
  }
  return phone.replace(/[\s\-().]/g, '').replace(/^\+212/, '0');
}

/**
 * Authoritative Admission Service
 * Strictly separates Admission Decision from Student Enrollment Conversion.
 */
export class AdmissionService {
  /**
   * List admissions with server pagination, server search, branch isolation, and counters.
   */
  static async listAdmissions(context: RequestContext, query: ListAdmissionsQuery = {}) {
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.view');

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    // 1. Authoritative Branch Scoping
    let effectiveBranchId: string | null = null;
    if (context.branchId) {
      effectiveBranchId = context.branchId;
    } else if (query.branchId) {
      const [branchRow] = await db
        .select({ id: branches.id })
        .from(branches)
        .where(and(eq(branches.tenantId, tenantId), eq(branches.id, query.branchId)))
        .limit(1);
      if (branchRow) {
        effectiveBranchId = branchRow.id;
      }
    }

    // 2. Base filters
    const conditions = [eq(applicants.tenantId, tenantId)];
    if (effectiveBranchId) {
      conditions.push(eq(applicants.branchId, effectiveBranchId));
    }
    if (query.sessionYearId) {
      conditions.push(eq(applicants.sessionYearId, query.sessionYearId));
    }

    // Status filter
    if (query.status && query.status !== 'all') {
      if (query.status === 'pending') {
        conditions.push(or(eq(applicants.status, 'applied'), eq(applicants.status, 'in_review'))!);
      } else {
        conditions.push(eq(applicants.status, query.status));
      }
    }

    // Search filter across candidate fields
    if (query.search?.trim()) {
      const s = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(applicants.firstName, s),
          ilike(applicants.lastName, s),
          ilike(applicants.email, s),
          ilike(applicants.phone, s),
          ilike(applicants.guardianName, s),
          ilike(applicants.guardianPhone, s),
          ilike(applicants.nationalId, s),
        )!,
      );
    }

    const whereClause = and(...conditions);

    // Query paginated items
    const [totalResult, items] = await Promise.all([
      db.select({ count: count() }).from(applicants).where(whereClause),
      db
        .select({
          id: applicants.id,
          firstName: applicants.firstName,
          lastName: applicants.lastName,
          email: applicants.email,
          phone: applicants.phone,
          dateOfBirth: applicants.dateOfBirth,
          gender: applicants.gender,
          nationality: applicants.nationality,
          motherTongue: applicants.motherTongue,
          city: applicants.city,
          nationalId: applicants.nationalId,
          branchId: applicants.branchId,
          sessionYearId: applicants.sessionYearId,
          status: applicants.status,
          guardianName: applicants.guardianName,
          guardianPhone: applicants.guardianPhone,
          guardianEmail: applicants.guardianEmail,
          applicationDate: applicants.applicationDate,
          convertedUserId: applicants.convertedUserId,
          approvedAt: applicants.approvedAt,
          rejectedAt: applicants.rejectedAt,
          enrolledAt: applicants.enrolledAt,
          checklistDocumentsReceived: applicants.checklistDocumentsReceived,
          checklistInterviewDone: applicants.checklistInterviewDone,
          checklistFileComplete: applicants.checklistFileComplete,
          // Blood group is intentionally EXCLUDED from list payloads (Law 09-08 / health PII)
        })
        .from(applicants)
        .where(whereClause)
        .orderBy(desc(applicants.applicationDate))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = totalResult[0]?.count ?? 0;
    const totalPages = Math.ceil(total / pageSize) || 1;

    // Server-computed counters across same effective scope
    const counterConditions = [eq(applicants.tenantId, tenantId)];
    if (effectiveBranchId) {
      counterConditions.push(eq(applicants.branchId, effectiveBranchId));
    }
    const allScoped = await db
      .select({ status: applicants.status })
      .from(applicants)
      .where(and(...counterConditions));

    const summary = {
      total: allScoped.length,
      pending: allScoped.filter(a => a.status === 'applied' || a.status === 'in_review').length,
      applied: allScoped.filter(a => a.status === 'applied').length,
      in_review: allScoped.filter(a => a.status === 'in_review').length,
      approved: allScoped.filter(a => a.status === 'approved').length,
      enrolled: allScoped.filter(a => a.status === 'enrolled').length,
      rejected: allScoped.filter(a => a.status === 'rejected').length,
    };

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      summary,
    };
  }

  /**
   * Get single admission detail with derived checklist, interview, comments, and converted student info.
   */
  static async getAdmissionDetail(context: RequestContext, applicantId: string) {
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.view');

    const [applicant] = await db
      .select()
      .from(applicants)
      .where(and(eq(applicants.id, applicantId), eq(applicants.tenantId, tenantId)))
      .limit(1);

    if (!applicant) {
      throw new ApiError(404, 'ADMISSION_NOT_FOUND', 'Demande d\'admission introuvable.');
    }

    // Branch isolation check
    if (context.branchId && applicant.branchId && applicant.branchId !== context.branchId) {
      throw new ApiError(403, 'BRANCH_ACCESS_DENIED', 'Accès interdit à cette succursale.');
    }

    // Load branch and session year labels
    let branchName: string | null = null;
    if (applicant.branchId) {
      const [br] = await db.select({ name: branches.name }).from(branches).where(eq(branches.id, applicant.branchId)).limit(1);
      branchName = br?.name ?? null;
    }

    let sessionYearName: string | null = null;
    if (applicant.sessionYearId) {
      const [sy] = await db.select({ name: sessionYears.name }).from(sessionYears).where(eq(sessionYears.id, applicant.sessionYearId)).limit(1);
      sessionYearName = sy?.name ?? null;
    }

    // Load interview
    const [interview] = await db
      .select()
      .from(admissionInterviews)
      .where(and(eq(admissionInterviews.applicantId, applicantId), eq(admissionInterviews.tenantId, tenantId)))
      .limit(1);

    // Load comments (internal notes)
    const comments = await db
      .select({
        id: admissionComments.id,
        body: admissionComments.body,
        createdAt: admissionComments.createdAt,
        authorId: admissionComments.authorId,
        authorName: user.name,
      })
      .from(admissionComments)
      .leftJoin(user, eq(admissionComments.authorId, user.id))
      .where(and(eq(admissionComments.applicantId, applicantId), eq(admissionComments.tenantId, tenantId)))
      .orderBy(admissionComments.createdAt);

    // Load documents
    const documents = await db
      .select({
        id: applicantDocuments.id,
        documentType: applicantDocuments.documentType,
        fileExt: applicantDocuments.fileExt,
        uploadedAt: applicantDocuments.uploadedAt,
      })
      .from(applicantDocuments)
      .where(and(eq(applicantDocuments.applicantId, applicantId), eq(applicantDocuments.tenantId, tenantId)));

    // Derived checklist
    const derivedInterviewDone = interview?.status === 'completed' || applicant.checklistInterviewDone;
    const derivedDocumentsReceived = documents.length >= 2 || applicant.checklistDocumentsReceived;
    const derivedFileComplete = (derivedInterviewDone && derivedDocumentsReceived) || applicant.checklistFileComplete;

    // Converted student information if enrolled
    let convertedStudent: {
      id: string;
      matricule: string | null;
      userStatus: string | null;
      className?: string | null;
      sectionName?: string | null;
    } | null = null;

    if (applicant.convertedUserId) {
      const [studentRow] = await db
        .select({
          id: user.id,
          matricule: user.matricule,
          userStatus: user.userStatus,
          classSectionId: user.classSectionId,
        })
        .from(user)
        .where(and(eq(user.id, applicant.convertedUserId), eq(user.tenantId, tenantId)))
        .limit(1);

      if (studentRow) {
        convertedStudent = {
          id: studentRow.id,
          matricule: studentRow.matricule,
          userStatus: studentRow.userStatus,
        };

        if (studentRow.classSectionId) {
          const [secRow] = await db
            .select({ className: classes.name })
            .from(classSections)
            .leftJoin(classes, eq(classSections.classId, classes.id))
            .where(eq(classSections.id, studentRow.classSectionId))
            .limit(1);
          convertedStudent.className = secRow?.className ?? null;
        }
      }
    }

    return {
      ...applicant,
      branchName,
      sessionYearName,
      interview: interview ?? null,
      comments,
      documents,
      derivedChecklist: {
        documentsReceived: derivedDocumentsReceived,
        interviewDone: derivedInterviewDone,
        fileComplete: derivedFileComplete,
      },
      convertedStudent,
    };
  }

  /**
   * Create an admission application.
   * Performs branch scoping, Code Massar validation, duplicate candidate detection (applicants & students),
   * guardian reuse, and CNDP consent persistence.
   */
  static async createAdmission(context: RequestContext, input: CreateAdmissionInput) {
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');

    // 1. Resolve Target Branch
    let targetBranchId: string | null = null;
    if (context.branchId) {
      targetBranchId = context.branchId;
    } else if (input.branchId) {
      const [br] = await db
        .select({ id: branches.id })
        .from(branches)
        .where(and(eq(branches.tenantId, tenantId), eq(branches.id, input.branchId)))
        .limit(1);
      if (!br) {
        throw new ApiError(422, 'INVALID_BRANCH', 'La succursale sélectionnée n\'existe pas dans cet établissement.');
      }
      targetBranchId = br.id;
    } else {
      const [defaultBranch] = await db
        .select({ id: branches.id })
        .from(branches)
        .where(and(eq(branches.tenantId, tenantId), eq(branches.isDefault, true)))
        .limit(1);
      targetBranchId = defaultBranch?.id ?? null;
    }

    // 2. Resolve Session Year
    let targetSessionYearId: string | null = null;
    const requestedSessionYearId = input.sessionYearId || input.academicYearId;
    if (requestedSessionYearId) {
      const [sy] = await db
        .select({ id: sessionYears.id })
        .from(sessionYears)
        .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.id, requestedSessionYearId)))
        .limit(1);
      if (!sy) {
        throw new ApiError(422, 'INVALID_SESSION_YEAR', 'L\'année scolaire sélectionnée n\'existe pas dans cet établissement.');
      }
      targetSessionYearId = sy.id;
    } else {
      const [defaultSession] = await db
        .select({ id: sessionYears.id })
        .from(sessionYears)
        .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
        .limit(1);
      targetSessionYearId = defaultSession?.id ?? null;
    }

    // 3. Massar Validation if provided
    let cleanMassar: string | null = null;
    if (input.nationalId?.trim()) {
      cleanMassar = input.nationalId.trim().toUpperCase();
      if (!MASSAR_CODE_REGEX.test(cleanMassar)) {
        throw new ApiError(422, 'INVALID_MASSAR_CODE', 'Format du Code Massar invalide (une lettre suivie de 9 chiffres, ex: G134567890).');
      }
    }

    // 4. Guardian Reuse & Resolution against accepted Guardians domain
    let effectiveGuardianId = input.guardianId || null;
    if (!effectiveGuardianId && (input.guardianPhone || input.guardianEmail)) {
      const existingGuardian = await GuardianResolutionService.findExistingGuardian(
        tenantId,
        input.guardianPhone,
        input.guardianEmail,
      );
      if (existingGuardian) {
        effectiveGuardianId = existingGuardian.id;
      }
    }

    // 5. Tenant-Scoped Duplicate Candidate Detection with 3-Tier Severity Policy
    // Tier 1 (Strong): Exact Massar match inside current tenant
    // Tier 2 (Medium): Exact email & phone match inside current tenant
    // Tier 3 (Advisory): Name + Date of Birth match inside current tenant
    // Every query is strictly isolated by tenantId — identical records in other tenants are never matched or revealed.
    let duplicateWarning: DuplicateWarning | null = null;

    // Tier 1: Check Exact Massar Match
    if (cleanMassar) {
      const [existingMassarApplicant] = await db
        .select({
          id: applicants.id,
          firstName: applicants.firstName,
          lastName: applicants.lastName,
          status: applicants.status,
        })
        .from(applicants)
        .where(and(eq(applicants.tenantId, tenantId), eq(applicants.nationalId, cleanMassar)))
        .limit(1);

      if (existingMassarApplicant) {
        const candidateName = `${existingMassarApplicant.firstName} ${existingMassarApplicant.lastName}`;
        if (!input.overrideDuplicate) {
          throw new ApiError(
            409,
            'MASSAR_DUPLICATE_CONFLICT',
            `Un dossier de candidature avec ce Code Massar (${cleanMassar}) existe déjà dans cet établissement (${candidateName} — Statut: ${existingMassarApplicant.status}). Une dérogation administrative explicite est requise pour créer un nouveau dossier.`,
            {
              duplicate: {
                id: existingMassarApplicant.id,
                name: candidateName,
                status: existingMassarApplicant.status,
                isEnrolledStudent: false,
                matchType: 'massar' as const,
                severity: 'strong' as const,
              },
            },
          );
        }
        duplicateWarning = {
          id: existingMassarApplicant.id,
          name: candidateName,
          status: existingMassarApplicant.status,
          isEnrolledStudent: false,
          matchType: 'massar',
          severity: 'strong',
        };
      } else {
        const [existingMassarStudent] = await db
          .select({
            id: user.id,
            name: user.name,
            matricule: user.matricule,
            userStatus: user.userStatus,
          })
          .from(user)
          .where(and(eq(user.tenantId, tenantId), eq(user.role, 'student'), eq(user.nationalId, cleanMassar)))
          .limit(1);

        if (existingMassarStudent) {
          const studentDisplayName = `${existingMassarStudent.name}${existingMassarStudent.matricule ? ` (${existingMassarStudent.matricule})` : ''}`;
          if (!input.overrideDuplicate) {
            throw new ApiError(
              409,
              'MASSAR_DUPLICATE_CONFLICT',
              `Un élève inscrit avec ce Code Massar (${cleanMassar}) existe déjà dans cet établissement (${studentDisplayName} — Statut: ${existingMassarStudent.userStatus}). Une dérogation administrative explicite est requise pour créer un nouveau dossier.`,
              {
                duplicate: {
                  id: existingMassarStudent.id,
                  name: studentDisplayName,
                  status: existingMassarStudent.userStatus,
                  isEnrolledStudent: true,
                  matchType: 'massar' as const,
                  severity: 'strong' as const,
                },
              },
            );
          }
          duplicateWarning = {
            id: existingMassarStudent.id,
            name: studentDisplayName,
            status: existingMassarStudent.userStatus,
            isEnrolledStudent: true,
            matchType: 'massar',
            severity: 'strong',
          };
        }
      }
    }

    // Tier 2: Check Exact Email + Phone Match (Medium severity advisory)
    if (!duplicateWarning && input.email.trim() && input.phone.trim()) {
      const [existingContactApplicant] = await db
        .select({
          id: applicants.id,
          firstName: applicants.firstName,
          lastName: applicants.lastName,
          status: applicants.status,
        })
        .from(applicants)
        .where(
          and(
            eq(applicants.tenantId, tenantId),
            eq(applicants.email, input.email.trim()),
            eq(applicants.phone, input.phone.trim()),
          ),
        )
        .limit(1);

      if (existingContactApplicant) {
        duplicateWarning = {
          id: existingContactApplicant.id,
          name: `${existingContactApplicant.firstName} ${existingContactApplicant.lastName}`,
          status: existingContactApplicant.status,
          isEnrolledStudent: false,
          matchType: 'contact',
          severity: 'medium',
        };
      } else {
        const [existingContactStudent] = await db
          .select({
            id: user.id,
            name: user.name,
            matricule: user.matricule,
            userStatus: user.userStatus,
          })
          .from(user)
          .where(
            and(
              eq(user.tenantId, tenantId),
              eq(user.role, 'student'),
              eq(user.email, input.email.trim()),
              eq(user.phone, input.phone.trim()),
            ),
          )
          .limit(1);

        if (existingContactStudent) {
          duplicateWarning = {
            id: existingContactStudent.id,
            name: `${existingContactStudent.name}${existingContactStudent.matricule ? ` (${existingContactStudent.matricule})` : ''}`,
            status: existingContactStudent.userStatus,
            isEnrolledStudent: true,
            matchType: 'contact',
            severity: 'medium',
          };
        }
      }
    }

    // Tier 3: Check Name + Date of Birth Match (Advisory weak match)
    if (!duplicateWarning && input.firstName.trim() && input.lastName.trim() && input.dateOfBirth) {
      const [existingIdentityApplicant] = await db
        .select({
          id: applicants.id,
          firstName: applicants.firstName,
          lastName: applicants.lastName,
          status: applicants.status,
        })
        .from(applicants)
        .where(
          and(
            eq(applicants.tenantId, tenantId),
            ilike(applicants.firstName, input.firstName.trim()),
            ilike(applicants.lastName, input.lastName.trim()),
            eq(applicants.dateOfBirth, input.dateOfBirth),
          ),
        )
        .limit(1);

      if (existingIdentityApplicant) {
        duplicateWarning = {
          id: existingIdentityApplicant.id,
          name: `${existingIdentityApplicant.firstName} ${existingIdentityApplicant.lastName}`,
          status: existingIdentityApplicant.status,
          isEnrolledStudent: false,
          matchType: 'identity',
          severity: 'advisory',
        };
      } else {
        const [existingIdentityStudent] = await db
          .select({
            id: user.id,
            name: user.name,
            matricule: user.matricule,
            userStatus: user.userStatus,
          })
          .from(user)
          .where(
            and(
              eq(user.tenantId, tenantId),
              eq(user.role, 'student'),
              ilike(user.firstName, input.firstName.trim()),
              ilike(user.lastName, input.lastName.trim()),
              eq(user.dateOfBirth, input.dateOfBirth),
            ),
          )
          .limit(1);

        if (existingIdentityStudent) {
          duplicateWarning = {
            id: existingIdentityStudent.id,
            name: `${existingIdentityStudent.name}${existingIdentityStudent.matricule ? ` (${existingIdentityStudent.matricule})` : ''}`,
            status: existingIdentityStudent.userStatus,
            isEnrolledStudent: true,
            matchType: 'identity',
            severity: 'advisory',
          };
        }
      }
    }

    // 6. Insert Application (Strictly creates an admission request, not an official student)
    const [inserted] = await db
      .insert(applicants)
      .values({
        tenantId,
        branchId: targetBranchId,
        sessionYearId: targetSessionYearId,
        academicYearId: input.academicYearId || null,
        nationalId: cleanMassar,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        dateOfBirth: input.dateOfBirth || null,
        gender: input.gender || null,
        nationality: input.nationality?.trim() || null,
        motherTongue: input.motherTongue?.trim() || null,
        city: input.city?.trim() || null,
        bloodGroup: input.bloodGroup?.trim() || null,
        guardianName: input.guardianName?.trim() || null,
        guardianPhone: input.guardianPhone?.trim() || null,
        guardianEmail: input.guardianEmail?.trim() || null,
        occupation: input.occupation?.trim() || null,
        address: input.address?.trim() || null,
        emailOptIn: input.emailOptIn ?? true,
        smsOptIn: input.smsOptIn ?? true,
        preferredLanguage: input.preferredLanguage?.trim() || null,
        guardianId: effectiveGuardianId,
        status: 'applied',
      })
      .returning();

    // 7. Persist Law 09-08 (CNDP) and Accuracy Consent Evidence
    if (input.consentAccuracy || input.consentCndp) {
      const consents: string[] = [];
      if (input.consentAccuracy) {
        consents.push('Exactitude des renseignements certifiée');
      }
      if (input.consentCndp) {
        consents.push('Consentement Loi 09-08 (CNDP) accordé pour le traitement des données scolaires');
      }
      await db.insert(admissionComments).values({
        tenantId,
        applicantId: inserted!.id,
        authorId: context.userId ?? null,
        body: `[Consentement & Conformité Réglementaire] ${consents.join(' | ')}. Enregistré le ${new Date().toISOString()}.`,
      });
    }

    if (input.guardianRelation?.trim()) {
      await db.insert(admissionComments).values({
        tenantId,
        applicantId: inserted!.id,
        authorId: context.userId ?? null,
        body: `[Tuteur / Relation] Lien de parenté déclaré : ${input.guardianRelation.trim()}`,
      });
    }

    if (input.overrideDuplicate && duplicateWarning?.severity === 'strong') {
      await db.insert(admissionComments).values({
        tenantId,
        applicantId: inserted!.id,
        authorId: context.userId ?? null,
        body: `[DÉROGATION ADMINISTRATIVE] Dossier créé malgré le doublon Code Massar (${cleanMassar}) avec le dossier existant (${duplicateWarning.name}, statut: ${duplicateWarning.status}). Raison: ${input.overrideReason || 'Autorisation administrative explicite'}`,
      });
    }

    recordAudit(context, 'create', 'admission_request', inserted!.id, {
      branchId: targetBranchId,
      sessionYearId: targetSessionYearId,
      academicYearId: input.academicYearId || null,
      hasDuplicateWarning: !!duplicateWarning,
      duplicateSeverity: duplicateWarning?.severity || null,
      duplicateMatchType: duplicateWarning?.matchType || null,
      overrideDuplicate: !!input.overrideDuplicate,
      consentAccuracy: !!input.consentAccuracy,
      consentCndp: !!input.consentCndp,
      cndpTimestamp: new Date().toISOString(),
    });

    return {
      applicant: inserted!,
      hasDuplicateWarning: !!duplicateWarning,
      duplicateWarning,
    };
  }

  /**
   * Update pending applicant details. Enforces decision lock (frozen once approved, rejected, or enrolled).
   */
  static async updateAdmission(context: RequestContext, applicantId: string, input: UpdateAdmissionInput) {
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');

    const [existing] = await db
      .select({ id: applicants.id, status: applicants.status, branchId: applicants.branchId })
      .from(applicants)
      .where(and(eq(applicants.id, applicantId), eq(applicants.tenantId, tenantId)))
      .limit(1);

    if (!existing) {
      throw new ApiError(404, 'ADMISSION_NOT_FOUND', 'Demande d\'admission introuvable.');
    }

    if (context.branchId && existing.branchId && existing.branchId !== context.branchId) {
      throw new ApiError(403, 'BRANCH_ACCESS_DENIED', 'Accès interdit à cette succursale.');
    }

    // Decision Lock: approved, rejected, and enrolled applications cannot be mutated
    if (existing.status !== 'applied' && existing.status !== 'in_review') {
      throw new ApiError(409, 'ALREADY_DECIDED', 'Cette demande a déjà fait l\'objet d\'une décision et ne peut plus être modifiée.');
    }

    const { guardianRelation, consentAccuracy, consentCndp, ...fieldsToUpdate } = input;

    let effectiveGuardianId = fieldsToUpdate.guardianId;
    if (!effectiveGuardianId && (fieldsToUpdate.guardianPhone || fieldsToUpdate.guardianEmail)) {
      const existingGuardian = await GuardianResolutionService.findExistingGuardian(
        tenantId,
        fieldsToUpdate.guardianPhone,
        fieldsToUpdate.guardianEmail,
      );
      if (existingGuardian) {
        effectiveGuardianId = existingGuardian.id;
      }
    }

    if (effectiveGuardianId) {
      const [g] = await db.select({ id: guardians.id }).from(guardians).where(and(eq(guardians.id, effectiveGuardianId), eq(guardians.tenantId, tenantId))).limit(1);
      if (!g) {
        throw new ApiError(422, 'INVALID_GUARDIAN', 'Le tuteur spécifié n\'existe pas dans cet établissement.');
      }
    }

    let cleanMassar: string | undefined;
    if (fieldsToUpdate.nationalId !== undefined) {
      if (fieldsToUpdate.nationalId?.trim()) {
        cleanMassar = fieldsToUpdate.nationalId.trim().toUpperCase();
        if (!MASSAR_CODE_REGEX.test(cleanMassar)) {
          throw new ApiError(422, 'INVALID_MASSAR_CODE', 'Format du Code Massar invalide (une lettre suivie de 9 chiffres, ex: G134567890).');
        }
      }
    }

    const updatePayload: Record<string, any> = { ...fieldsToUpdate };
    if (effectiveGuardianId !== undefined) {
      updatePayload.guardianId = effectiveGuardianId;
    }
    if (cleanMassar !== undefined) {
      updatePayload.nationalId = cleanMassar;
    }

    const [updated] = await db
      .update(applicants)
      .set(updatePayload)
      .where(and(eq(applicants.id, applicantId), eq(applicants.tenantId, tenantId)))
      .returning();

    // Persist consent and relationship evidence
    if (consentAccuracy || consentCndp) {
      const consents: string[] = [];
      if (consentAccuracy) {
        consents.push('Exactitude des renseignements certifiée');
      }
      if (consentCndp) {
        consents.push('Consentement Loi 09-08 (CNDP) accordé');
      }
      await db.insert(admissionComments).values({
        tenantId,
        applicantId,
        authorId: context.userId ?? null,
        body: `[Mise à jour Consentement] ${consents.join(' | ')}. Enregistré le ${new Date().toISOString()}.`,
      });
    }

    if (guardianRelation?.trim()) {
      await db.insert(admissionComments).values({
        tenantId,
        applicantId,
        authorId: context.userId ?? null,
        body: `[Tuteur / Relation] Lien de parenté mis à jour : ${guardianRelation.trim()}`,
      });
    }

    recordAudit(context, 'update', 'admission_request', applicantId, {
      hasGuardian: !!effectiveGuardianId,
      hasConsent: consentAccuracy || consentCndp,
    });
    return updated!;
  }

  /**
   * Move application to in_review status.
   */
  static async startReview(context: RequestContext, applicantId: string) {
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');

    const [applicant] = await db
      .select({ id: applicants.id, status: applicants.status, branchId: applicants.branchId })
      .from(applicants)
      .where(and(eq(applicants.id, applicantId), eq(applicants.tenantId, tenantId)))
      .limit(1);

    if (!applicant) {
      throw new ApiError(404, 'ADMISSION_NOT_FOUND', 'Demande d\'admission introuvable.');
    }

    if (context.branchId && applicant.branchId && applicant.branchId !== context.branchId) {
      throw new ApiError(403, 'BRANCH_ACCESS_DENIED', 'Accès interdit à cette succursale.');
    }

    if (applicant.status !== 'applied') {
      throw new ApiError(409, 'INVALID_TRANSITION', `Seule une demande au statut "reçue" peut être mise en revue (statut actuel: ${applicant.status}).`);
    }

    const [updated] = await db
      .update(applicants)
      .set({ status: 'in_review' })
      .where(and(eq(applicants.id, applicantId), eq(applicants.tenantId, tenantId)))
      .returning();

    recordAudit(context, 'update', 'admission_request', applicantId, { action: 'start_review' });
    return updated!;
  }

  /**
   * APPROVE ADMISSION (Decision Only).
   * Records the school's acceptance of the applicant.
   * INVARIANT: Does NOT create student user, does NOT reserve matricule, does NOT create placement.
   */
  static async approveAdmission(context: RequestContext, applicantId: string) {
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');

    const [applicant] = await db
      .select({ id: applicants.id, status: applicants.status, branchId: applicants.branchId })
      .from(applicants)
      .where(and(eq(applicants.id, applicantId), eq(applicants.tenantId, tenantId)))
      .limit(1);

    if (!applicant) {
      throw new ApiError(404, 'ADMISSION_NOT_FOUND', 'Demande d\'admission introuvable.');
    }

    if (context.branchId && applicant.branchId && applicant.branchId !== context.branchId) {
      throw new ApiError(403, 'BRANCH_ACCESS_DENIED', 'Accès interdit à cette succursale.');
    }

    if (applicant.status !== 'applied' && applicant.status !== 'in_review') {
      throw new ApiError(409, 'ALREADY_DECIDED', `Cette demande est déjà traitée (statut actuel: ${applicant.status}).`);
    }

    const now = new Date().toISOString();
    const [updated] = await db
      .update(applicants)
      .set({
        status: 'approved',
        approvedAt: now,
        approvedById: context.userId,
      })
      .where(and(eq(applicants.id, applicantId), eq(applicants.tenantId, tenantId)))
      .returning();

    recordAudit(context, 'update', 'admission_request', applicantId, {
      action: 'approve_decision_only',
      approvedAt: now,
    });

    return updated!;
  }

  /**
   * REJECT ADMISSION.
   * Records the rejection decision with mandatory reason.
   */
  static async rejectAdmission(context: RequestContext, applicantId: string, reason?: string) {
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');

    const [applicant] = await db
      .select({ id: applicants.id, status: applicants.status, branchId: applicants.branchId })
      .from(applicants)
      .where(and(eq(applicants.id, applicantId), eq(applicants.tenantId, tenantId)))
      .limit(1);

    if (!applicant) {
      throw new ApiError(404, 'ADMISSION_NOT_FOUND', 'Demande d\'admission introuvable.');
    }

    if (context.branchId && applicant.branchId && applicant.branchId !== context.branchId) {
      throw new ApiError(403, 'BRANCH_ACCESS_DENIED', 'Accès interdit à cette succursale.');
    }

    if (applicant.status === 'enrolled') {
      throw new ApiError(409, 'ALREADY_ENROLLED', 'Impossible de rejeter un élève déjà inscrit.');
    }
    if (applicant.status === 'rejected') {
      throw new ApiError(409, 'ALREADY_REJECTED', 'Cette demande est déjà rejetée.');
    }

    const now = new Date().toISOString();
    const [updated] = await db
      .update(applicants)
      .set({
        status: 'rejected',
        rejectedAt: now,
        rejectedById: context.userId,
        rejectionReason: reason || null,
      })
      .where(and(eq(applicants.id, applicantId), eq(applicants.tenantId, tenantId)))
      .returning();

    recordAudit(context, 'update', 'admission_request', applicantId, {
      action: 'reject',
      reason,
      rejectedAt: now,
    });

    return updated!;
  }

  /**
   * ENROLL CANDIDATE (Transactional Conversion).
   * Creates the student account, reserves official matricule, links guardian,
   * creates authoritative studentPlacement, and copies documents.
   */
  static async enrollApplicant(context: RequestContext, applicantId: string, input: EnrollApplicantInput = {}) {
    const tenantId = requireTenant(context);
    await requireCapability(context, 'admissions.manage');

    // Execute in a database transaction with row-level locking
    const conversionResult = await db.transaction(async (tx) => {
      // 1. Lock applicant row
      const [applicant] = await tx
        .select()
        .from(applicants)
        .where(and(eq(applicants.id, applicantId), eq(applicants.tenantId, tenantId)))
        .for('update')
        .limit(1);

      if (!applicant) {
        throw new ApiError(404, 'ADMISSION_NOT_FOUND', 'Demande d\'admission introuvable.');
      }

      // Branch authorization check
      if (context.branchId && applicant.branchId && applicant.branchId !== context.branchId) {
        throw new ApiError(403, 'BRANCH_ACCESS_DENIED', 'Accès interdit à cette succursale.');
      }

      // 2. Idempotency: already enrolled candidate
      if (applicant.status === 'enrolled' && applicant.convertedUserId) {
        const [existingStudent] = await tx
          .select({ id: user.id, matricule: user.matricule, name: user.name })
          .from(user)
          .where(and(eq(user.id, applicant.convertedUserId), eq(user.tenantId, tenantId)))
          .limit(1);

        const [existingPlacement] = await tx
          .select({ id: studentPlacements.id, classSectionId: studentPlacements.classSectionId })
          .from(studentPlacements)
          .where(and(eq(studentPlacements.studentId, applicant.convertedUserId), eq(studentPlacements.isCurrent, true)))
          .limit(1);

        return {
          alreadyEnrolled: true,
          student: existingStudent ?? { id: applicant.convertedUserId },
          matricule: existingStudent?.matricule ?? null,
          placementId: existingPlacement?.id ?? null,
        };
      }

      // 3. Status Guard: Must be approved
      if (applicant.status !== 'approved') {
        throw new ApiError(
          409,
          'NOT_APPROVED',
          `La demande doit être approuvée avant de finaliser l'inscription (statut actuel: ${applicant.status}).`,
        );
      }

      // 4. Resolve Target Branch & Session Year
      let targetBranchId = input.branchId || applicant.branchId;
      if (!targetBranchId) {
        const [defaultBranch] = await tx
          .select({ id: branches.id })
          .from(branches)
          .where(and(eq(branches.tenantId, tenantId), eq(branches.isDefault, true)))
          .limit(1);
        targetBranchId = defaultBranch?.id ?? null;
      }
      if (!targetBranchId) {
        throw new ApiError(422, 'BRANCH_REQUIRED', 'Une succursale cible est requise pour finaliser l\'inscription.');
      }

      let targetSessionYearId = input.sessionYearId || applicant.sessionYearId;
      if (!targetSessionYearId) {
        const [defaultSession] = await tx
          .select({ id: sessionYears.id })
          .from(sessionYears)
          .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
          .limit(1);
        targetSessionYearId = defaultSession?.id ?? null;
      }
      if (!targetSessionYearId) {
        throw new ApiError(422, 'SESSION_YEAR_REQUIRED', 'Une année scolaire cible est requise pour finaliser l\'inscription.');
      }

      // 5. Duplicate Student Detection in Existing Student Domain (P0)
      const duplicateStudentFilters = [];
      if (applicant.nationalId) {
        duplicateStudentFilters.push(eq(user.nationalId, applicant.nationalId));
      }
      if (applicant.email) {
        duplicateStudentFilters.push(eq(user.email, applicant.email));
      }
      if (applicant.firstName && applicant.lastName && applicant.dateOfBirth) {
        duplicateStudentFilters.push(
          and(
            ilike(user.name, `${applicant.firstName} ${applicant.lastName}`.trim()),
            eq(user.dateOfBirth, applicant.dateOfBirth),
          ),
        );
      }

      if (duplicateStudentFilters.length > 0) {
        const [matchedStudent] = await tx
          .select({
            id: user.id,
            name: user.name,
            matricule: user.matricule,
            nationalId: user.nationalId,
            role: user.role,
          })
          .from(user)
          .where(
            and(
              eq(user.tenantId, tenantId),
              inArray(user.role, ['student', 'alumni']),
              or(...duplicateStudentFilters)!,
            ),
          )
          .limit(1);

        if (matchedStudent) {
          throw new ApiError(
            409,
            'POSSIBLE_EXISTING_STUDENT',
            `Un élève correspondant existe déjà dans l'établissement (${matchedStudent.name}, Matricule: ${matchedStudent.matricule ?? 'N/A'}, ID: ${matchedStudent.id}).`,
          );
        }
      }

      // 6. Class Section Validation & Capacity Guard (P0)
      const classSectionId = input.classSectionId !== undefined ? input.classSectionId : null;
      if (classSectionId) {
        const [secRow] = await tx
          .select({
            id: classSections.id,
            maxStudents: classSections.maxStudents,
            tenantId: classSections.tenantId,
            branchId: classes.branchId,
            className: classes.name,
          })
          .from(classSections)
          .leftJoin(classes, eq(classSections.classId, classes.id))
          .where(and(eq(classSections.id, classSectionId), eq(classSections.tenantId, tenantId)))
          .limit(1);

        if (!secRow) {
          throw new ApiError(404, 'CLASS_SECTION_NOT_FOUND', 'La classe sélectionnée est introuvable.');
        }

        // Branch match guard
        if (secRow.branchId && secRow.branchId !== targetBranchId) {
          throw new ApiError(422, 'SECTION_BRANCH_MISMATCH', 'La classe sélectionnée n\'appartient pas à la succursale de la candidature.');
        }

        // Capacity guard: maxStudents cannot be null
        if (secRow.maxStudents == null) {
          throw new ApiError(422, 'CAPACITY_NOT_CONFIGURED', 'La capacité maximale de cette classe n\'est pas configurée.');
        }

        // Check active occupancy in target session year
        const [occupancyResult] = await tx
          .select({ c: count() })
          .from(studentPlacements)
          .where(
            and(
              eq(studentPlacements.tenantId, tenantId),
              eq(studentPlacements.classSectionId, classSectionId),
              eq(studentPlacements.sessionYearId, targetSessionYearId),
              eq(studentPlacements.isCurrent, true),
            ),
          );

        const currentOccupancy = occupancyResult?.c ?? 0;
        if (currentOccupancy >= secRow.maxStudents) {
          throw new ApiError(
            409,
            'SECTION_CAPACITY_FULL',
            `La classe "${secRow.className}" est complète (${currentOccupancy}/${secRow.maxStudents} élèves).`,
          );
        }
      }

      // 7. Check Subscription Plan Student Capacity
      await assertStudentCapacity(tenantId, 1);

      // 8. Reserve Official Sequential Matricule
      const matricule = await reserveMatricule(tx, tenantId);

      // 9. Insert Student Record into User table
      const studentId = `STD-${Date.now().toString().slice(-8)}`;
      const fullName = `${applicant.firstName} ${applicant.lastName}`.trim();

      const [newStudent] = await tx
        .insert(user)
        .values({
          id: studentId,
          tenantId,
          branchId: targetBranchId,
          matricule,
          nationalId: applicant.nationalId || null,
          name: fullName,
          firstName: applicant.firstName,
          lastName: applicant.lastName,
          email: applicant.email,
          phone: applicant.phone,
          dateOfBirth: applicant.dateOfBirth,
          gender: applicant.gender,
          nationality: applicant.nationality,
          motherTongue: applicant.motherTongue,
          city: applicant.city,
          bloodGroup: applicant.bloodGroup,
          role: 'student',
          userStatus: 'active',
          paymentStatus: 'À jour',
          classSectionId: classSectionId || null,
        })
        .returning();

      // 10. Authoritative Student Placement in studentPlacements
      let placementId: string | null = null;
      if (classSectionId) {
        const placement = await recordStudentPlacement(
          {
            tenantId,
            studentId: newStudent!.id,
            sessionYearId: targetSessionYearId,
            classSectionId,
            startDate: new Date().toISOString().slice(0, 10),
            status: 'enrolled',
          },
          tx,
        );
        placementId = placement.id;
      }

      // 11. Guardian Resolution & Relational Linking
      let guardianId = applicant.guardianId;
      if (!guardianId && (applicant.guardianPhone || applicant.guardianEmail)) {
        const parts = (applicant.guardianName || '').trim().split(/\s+/);
        const gFirst = parts[0] || applicant.guardianName || 'Tuteur';
        const gLast = parts.slice(1).join(' ') || '-';

        const result = await GuardianResolutionService.resolveOrCreateGuardian(
          tenantId,
          {
            firstName: gFirst,
            lastName: gLast,
            phone: applicant.guardianPhone,
            email: applicant.guardianEmail,
            occupation: applicant.occupation,
            address: applicant.address,
            emailOptIn: applicant.emailOptIn ?? true,
            smsOptIn: applicant.smsOptIn ?? true,
            preferredLanguage: applicant.preferredLanguage,
            defaultRelation: 'Parent',
          },
          tx,
        );
        guardianId = result.id;
      }

      if (guardianId) {
        await tx.insert(guardianStudents).values({
          tenantId,
          guardianId,
          studentId: newStudent!.id,
          relationshipType: 'Parent',
          isPrimaryContact: true,
          status: 'active',
        });
      }

      // 12. Copy Documents from applicantDocuments to studentDocuments
      const uploadedDocs = await tx
        .select()
        .from(applicantDocuments)
        .where(and(eq(applicantDocuments.tenantId, tenantId), eq(applicantDocuments.applicantId, applicant.id)));

      let photoUrl: string | null = null;
      for (const doc of uploadedDocs) {
        const destSubpath = doc.documentType === 'photo'
          ? `students/${newStudent!.id}/profile.${doc.fileExt}`
          : `${newStudent!.id}/${doc.documentType}.${doc.fileExt}`;

        try {
          await copyUploadedFile(
            tenantId,
            `applicant-documents/${applicant.id}/${doc.documentType}.${doc.fileExt}`,
            destSubpath,
          );
        } catch {
          // Non-blocking: physical file may be absent on development or disk volumes
        }

        await tx.insert(studentDocuments).values({
          tenantId,
          studentId: newStudent!.id,
          documentType: doc.documentType,
          fileExt: doc.fileExt,
        });

        if (doc.documentType === 'photo') {
          photoUrl = destSubpath;
          await tx.insert(studentPhotos).values({
            tenantId,
            studentId: newStudent!.id,
            url: photoUrl,
            uploadedBy: context.userId,
          });
        }
      }

      if (photoUrl) {
        await tx.update(user).set({ photoUrl }).where(eq(user.id, newStudent!.id));
        newStudent!.photoUrl = photoUrl;
      }

      // 13. Account Provisioning (Setup Token)
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await tx.insert(accountSetupTokens).values({
        tenantId,
        userId: newStudent!.id,
        token: hashSetupToken(token),
        expiresAt,
      });

      // Best effort SMS invite with absolute/clean link
      if (applicant.guardianPhone) {
        await tx.insert(smsMessages).values({
          tenantId,
          recipientPhone: applicant.guardianPhone,
          studentId: newStudent!.id,
          body: `Bienvenue chez SchoolOS ! Activez le compte élève de ${fullName} : /setup-account?token=${token}`,
          status: 'sent',
          sentAt: new Date().toISOString(),
          createdById: context.userId,
        });
      }

      // 14. Mark Applicant ENROLLED
      const now = new Date().toISOString();
      const [updatedApplicant] = await tx
        .update(applicants)
        .set({
          status: 'enrolled',
          convertedUserId: newStudent!.id,
          enrolledAt: now,
          enrolledById: context.userId,
          branchId: targetBranchId,
          sessionYearId: targetSessionYearId,
        })
        .where(and(eq(applicants.id, applicantId), eq(applicants.tenantId, tenantId)))
        .returning();

      return {
        alreadyEnrolled: false,
        student: newStudent,
        applicant: updatedApplicant,
        matricule,
        placementId,
        guardianId,
      };
    });

    // Post-transaction best-effort student card issue
    if (!conversionResult.alreadyEnrolled && conversionResult.student?.id) {
      try {
        await autoIssueStudentCardOnAdmission(tenantId, conversionResult.student.id, context.userId);
      } catch {
        // Non-blocking
      }
    }

    recordAudit(context, 'create', 'student_from_admission', conversionResult.student!.id, {
      applicantId,
      matricule: conversionResult.matricule,
      placementId: conversionResult.placementId,
      branchId: input.branchId,
      classSectionId: input.classSectionId,
    });

    return conversionResult;
  }
}
