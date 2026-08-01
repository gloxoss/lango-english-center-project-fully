export interface Student {
  id: string;
  userId?: string;
  matricule: string; // admission_no in ESchool
  fullName: string;
  firstName?: string;
  lastName?: string;
  gender?: 'Masculin' | 'Féminin';
  dob?: string;
  level: string;
  className: string;
  classId?: string;
  classSectionId?: string;
  guardianId?: string;
  guardianName: string;
  phone: string;
  address?: string;
  status: 'Actif' | 'En attente' | 'Inactif' | 'Transféré';
  paymentStatus: 'À jour' | 'En retard' | 'Impayé' | 'Exonéré';
  avatarUrl?: string;
  schoolId?: string;
  sessionYearId?: string;
  applicationType?: 'Nouvelle admission' | 'Transfert' | 'Réinscription';
  applicationStatus?: 'Soumis' | 'En étude' | 'Validé' | 'Rejeté';
  admissionDate?: string;
  rollNumber?: number;
}

export interface AdmissionRequest {
  id: string;
  candidateName: string;
  appliedLevel: string;
  guardianName: string;
  phone: string;
  email: string;
  submissionDate: string;
  stage: 'Nouveau' | 'En étude' | 'Entretien' | 'Admis' | 'Rejeté';
  documentsStatus: string;
  schoolId?: string;
  sessionYearId?: string;
}

export interface Guardian {
  id: string;
  userId?: string;
  name: string;
  relation: string;
  phone: string;
  email: string;
  linkedStudents: string[];
  address: string;
  portalAccess: boolean;
  schoolId?: string;
}

export interface StudentTransfer {
  id: string;
  studentName: string;
  studentId?: string;
  level: string;
  transferType: 'Changement de classe' | 'Changement de campus' | 'Sortie définitive';
  typeColor?: string;
  fromClass: string;
  toClassOrSchool: string;
  effectiveDate: string;
  motif: string;
  status: 'En cours' | 'Validé' | 'En attente de documents' | 'Rejeté';
  financialClearance: boolean;
  academicApproval: boolean;
  schoolId?: string;
}

export interface PromotionRecord {
  id: string;
  studentId?: string;
  studentName: string;
  currentClass: string;
  gpa: number;
  rank: string;
  attendanceRate: string;
  financialStatus: 'À jour' | 'Retard' | 'Impayé' | 'Départ volontaire';
  proposedDecision: 'Admis' | 'Rattrapage' | 'Redoublement' | 'Départ';
  nextClass: string;
  schoolId?: string;
  sessionYearId?: string;
}

export interface MatriculeAssignment {
  id: string;
  studentName: string;
  className: string;
  proposedMatricule: string;
  callNumber: string;
  status: 'OK' | 'Manquant' | 'Doublon' | 'Non généré';
  conflictInfo: string;
  highlight?: boolean;
  matHighlight?: boolean;
  schoolId?: string;
}

export interface StudentPhotoRecord {
  id: string;
  studentName: string;
  className: string;
  photoUrl?: string;
  associationStatus: 'Associée' | 'À vérifier' | 'Non reconnue';
  matchConfidence?: number;
  schoolId?: string;
}
