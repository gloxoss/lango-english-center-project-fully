import type { DocumentDesign, DocumentKind } from '../contracts';

export interface DocumentKindConfig {
  kind: DocumentKind;
  labelKey: string;
}

export const DOCUMENT_KINDS: DocumentKindConfig[] = [
  { kind: 'invoice', labelKey: 'kindInvoice' },
  { kind: 'receipt', labelKey: 'kindReceipt' },
  { kind: 'statement', labelKey: 'kindStatement' },
  { kind: 'student_profile', labelKey: 'kindStudentProfile' },
  { kind: 'leadership_report', labelKey: 'kindLeadership' },
  { kind: 'exam_seating', labelKey: 'kindExamSeating' },
  { kind: 'exam_attendance', labelKey: 'kindExamAttendance' },
  { kind: 'timetable', labelKey: 'kindTimetable' },
];

export const SECTION_CONFIGS: Array<{ section: DocumentDesign['sectionOrder'][number]; labelKey: string }> = [
  { section: 'identity', labelKey: 'sectionIdentity' },
  { section: 'details', labelKey: 'sectionDetails' },
  { section: 'lines', labelKey: 'sectionLines' },
  { section: 'totals', labelKey: 'sectionTotals' },
  { section: 'footer', labelKey: 'sectionFooter' },
];

export const OPTIONAL_FIELD_CONFIGS: Array<{ field: DocumentDesign['optionalFields'][number]; labelKey: string }> = [
  { field: 'contact', labelKey: 'optContact' },
  { field: 'legal', labelKey: 'optLegal' },
  { field: 'note', labelKey: 'optNote' },
  { field: 'guardian', labelKey: 'optGuardian' },
  { field: 'class', labelKey: 'optClass' },
];

export interface FieldConfig {
  key: string; // Key in design.labels
  labelKey: string; // Key in DocumentSettings
}

export const FIELD_CONFIGS: Record<DocumentKind, FieldConfig[]> = {
  invoice: [
    { key: 'title', labelKey: 'fieldTitle' },
    { key: 'Élève', labelKey: 'fieldStudent' },
    { key: 'Date', labelKey: 'fieldDate' },
    { key: 'Échéance', labelKey: 'fieldDueDate' },
    { key: 'Description', labelKey: 'fieldDescription' },
    { key: 'Montant', labelKey: 'fieldAmount' },
    { key: 'Remise', labelKey: 'fieldDiscount' },
    { key: 'Total net', labelKey: 'fieldNetTotal' },
    { key: 'Payé', labelKey: 'fieldPaid' },
    { key: 'Solde', labelKey: 'fieldBalance' },
  ],
  receipt: [
    { key: 'title', labelKey: 'fieldTitle' },
    { key: 'Élève', labelKey: 'fieldStudent' },
    { key: 'Date', labelKey: 'fieldDate' },
    { key: 'Mode', labelKey: 'fieldPaymentMode' },
    { key: 'Référence paiement', labelKey: 'fieldPaymentRef' },
    { key: 'Facture', labelKey: 'fieldInvoice' },
    { key: 'Montant', labelKey: 'fieldAmount' },
    { key: 'Montant reçu', labelKey: 'fieldAmountReceived' },
  ],
  statement: [
    { key: 'title', labelKey: 'fieldTitle' },
    { key: 'Élève', labelKey: 'fieldStudent' },
    { key: 'Période', labelKey: 'fieldPeriod' },
    { key: 'Date', labelKey: 'fieldDate' },
    { key: 'Opération', labelKey: 'fieldOperation' },
    { key: 'Référence', labelKey: 'fieldReference' },
    { key: 'Débit', labelKey: 'fieldDebit' },
    { key: 'Crédit', labelKey: 'fieldCredit' },
    { key: 'Solde', labelKey: 'fieldBalance' },
    { key: 'Solde initial', labelKey: 'fieldInitialBalance' },
    { key: 'Solde final', labelKey: 'fieldFinalBalance' },
  ],
  student_profile: [
    { key: 'title', labelKey: 'fieldTitle' },
    { key: 'Nom', labelKey: 'fieldName' },
    { key: 'Matricule', labelKey: 'fieldMatricule' },
    { key: 'Classe', labelKey: 'optClass' },
    { key: 'Année scolaire', labelKey: 'fieldAcademicYear' },
    { key: 'Date de naissance', labelKey: 'fieldBirthDate' },
    { key: 'Téléphone', labelKey: 'fieldPhone' },
    { key: 'Email', labelKey: 'fieldEmail' },
    { key: 'Adresse', labelKey: 'fieldAddress' },
    { key: 'Responsable', labelKey: 'optGuardian' },
    { key: 'Lien', labelKey: 'fieldRelationship' },
  ],
  leadership_report: [
    { key: 'title', labelKey: 'fieldTitle' },
    { key: 'Période', labelKey: 'fieldPeriod' },
    { key: 'Indicateur', labelKey: 'fieldIndicator' },
    { key: 'Valeur', labelKey: 'fieldValue' },
  ],
  exam_seating: [
    { key: 'title', labelKey: 'fieldTitle' },
    { key: 'Examen', labelKey: 'fieldExam' },
    { key: 'Place', labelKey: 'fieldSeat' },
    { key: 'Candidat', labelKey: 'fieldCandidate' },
    { key: 'Matricule', labelKey: 'fieldMatricule' },
  ],
  exam_attendance: [
    { key: 'title', labelKey: 'fieldTitle' },
    { key: 'Examen', labelKey: 'fieldExam' },
    { key: 'Place', labelKey: 'fieldSeat' },
    { key: 'Candidat', labelKey: 'fieldCandidate' },
    { key: 'Matricule', labelKey: 'fieldMatricule' },
    { key: 'Signature', labelKey: 'fieldSignature' },
  ],
  timetable: [
    { key: 'title', labelKey: 'fieldTitle' },
    { key: 'Vue', labelKey: 'fieldView' },
    { key: 'Référence', labelKey: 'fieldReference' },
    { key: 'Jour', labelKey: 'fieldDay' },
    { key: 'Horaire', labelKey: 'fieldSchedule' },
    { key: 'Matière', labelKey: 'fieldSubject' },
    { key: 'Enseignant', labelKey: 'optViewTeacher' },
    { key: 'Classe', labelKey: 'optClass' },
    { key: 'Salle', labelKey: 'optViewRoom' },
    { key: 'Séances', labelKey: 'fieldSessions' },
  ],
};
