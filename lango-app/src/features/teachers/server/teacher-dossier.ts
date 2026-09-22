/**
 * Teacher dossier completeness — the authoritative rule for the Directory's
 * "Dossiers à compléter" KPI and the Dossiers panel.
 *
 * A teacher dossier has two halves, deliberately kept apart so the UI can say
 * what* is missing rather than a vague "profil incomplet":
 *
 *   1. Compliance documents (the three flags stored on user.documents):
 *      contract, CIN, diploma.
 *   2. Required profile data on the user row: employee id, hire date and
 *      specialization. These are the minimum fields a school needs to run a
 *      teacher administratively; optional fields (address, city, gender,
 *      birth date, qualification, salary) are NOT blockers.
 *
 * The previous UI bound "Profils incomplets" to a `status = 'Incomplet'` value
 * that no server path could ever produce, so the KPI was permanently 0. This
 * module replaces that dead concept with a computed rule.
 */

export const TEACHER_DOSSIER_REQUIRED_DOCUMENTS = ['contract', 'cin', 'diploma'] as const;
export type TeacherDossierDocumentType = (typeof TEACHER_DOSSIER_REQUIRED_DOCUMENTS)[number];

export const TEACHER_DOSSIER_REQUIRED_PROFILE_FIELDS = ['employeeId', 'hireDate', 'specialization'] as const;
export type TeacherDossierProfileField = (typeof TEACHER_DOSSIER_REQUIRED_PROFILE_FIELDS)[number];

export type TeacherDocumentFlags = Partial<Record<TeacherDossierDocumentType | 'contractExt' | 'cinExt' | 'diplomaExt', unknown>>;

export type TeacherDossierInput = {
  documents: TeacherDocumentFlags | null | undefined;
  employeeId: string | null | undefined;
  hireDate: string | null | undefined;
  specialization: string | null | undefined;
};

export type TeacherDossier = {
  /** Every required document flag present AND every required profile field filled. */
  complete: boolean;
  /** At least one compliance document has been provided. */
  hasAnyDocument: boolean;
  missingDocuments: TeacherDossierDocumentType[];
  missingProfileFields: TeacherDossierProfileField[];
  /** Documents first, then profile fields — stable order for UI rendering. */
  missingItems: Array<TeacherDossierDocumentType | TeacherDossierProfileField>;
};

function isProvided(value: unknown): boolean {
  return value === true;
}

function isFilled(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function computeTeacherDossier(input: TeacherDossierInput): TeacherDossier {
  const documents = input.documents ?? {};
  const missingDocuments = TEACHER_DOSSIER_REQUIRED_DOCUMENTS.filter(type => !isProvided(documents[type]));

  const profileValues: Record<TeacherDossierProfileField, string | null | undefined> = {
    employeeId: input.employeeId,
    hireDate: input.hireDate,
    specialization: input.specialization,
  };
  const missingProfileFields = TEACHER_DOSSIER_REQUIRED_PROFILE_FIELDS.filter(field => !isFilled(profileValues[field]));

  return {
    complete: missingDocuments.length === 0 && missingProfileFields.length === 0,
    hasAnyDocument: missingDocuments.length < TEACHER_DOSSIER_REQUIRED_DOCUMENTS.length,
    missingDocuments,
    missingProfileFields,
    missingItems: [...missingDocuments, ...missingProfileFields],
  };
}

export type TeacherDossierSummary = {
  complete: number;
  /** Has at least one document but is not complete. */
  partial: number;
  /** Zero compliance documents provided. */
  noDocuments: number;
  /** partial + noDocuments — the "Dossiers à compléter" KPI. */
  toComplete: number;
};

export function summarizeTeacherDossiers(dossiers: TeacherDossier[]): TeacherDossierSummary {
  let complete = 0;
  let partial = 0;
  let noDocuments = 0;

  for (const dossier of dossiers) {
    if (dossier.complete) {
      complete += 1;
    } else if (dossier.hasAnyDocument) {
      partial += 1;
    } else {
      noDocuments += 1;
    }
  }

  return { complete, partial, noDocuments, toComplete: partial + noDocuments };
}
