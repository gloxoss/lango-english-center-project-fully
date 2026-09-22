export type TeacherStatus = 'active' | 'inactive' | 'archived';

export type TeacherDirectorySubject = { id: string; name: string };
export type TeacherDirectoryClass = { id: string; label: string; role: string };

export type TeacherDossier = {
  complete: boolean;
  hasAnyDocument: boolean;
  missingDocuments: string[];
  missingProfileFields: string[];
  missingItems: string[];
};

export type TeacherDirectoryItem = {
  id: string;
  name: string;
  email: string;
  phone: string;
  employeeId: string;
  specialization: string;
  branchId: string | null;
  branchName: string | null;
  status: TeacherStatus;
  avatarUrl?: string;
  subjects: TeacherDirectorySubject[];
  classes: TeacherDirectoryClass[];
  weeklyScheduledHours: number | null;
  dossier: TeacherDossier;
  canHardDelete: boolean;
};

export type TeacherDossierSummary = {
  complete: number;
  partial: number;
  noDocuments: number;
  toComplete: number;
};

export type TeacherWorkloadSummary = {
  averageWeeklyHours: number | null;
  totalWeeklyHours: number;
  scheduledTeachers: number;
  activeTeachers: number;
  hasTimetable: boolean;
  source: 'published_timetable' | 'none';
};

export type TeacherAttentionItem = {
  id: string;
  name: string;
  missingItems: string[];
};

export type TeacherDirectorySummary = {
  scopedTeachers: number;
  activeTeachers: number;
  onLeave: number;
  dossiers: TeacherDossierSummary;
  workload: TeacherWorkloadSummary;
  attention: TeacherAttentionItem[];
};

export type TeacherListResponse = {
  success: boolean;
  data: TeacherDirectoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: TeacherDirectorySummary;
};

export type TeacherClassAssignmentHistoryItem = {
  id: string;
  classSectionId: string;
  label: string;
  role: string;
  status: string;
  startsOn: string | null;
  endsOn: string | null;
  isCurrent: boolean;
  studentCount: number;
};

export type TeacherSubjectAssignmentItem = {
  id: string;
  subjectId: string;
  subjectName: string;
  classSectionId: string;
  classLabel: string;
  offeringId: string | null;
  isCurrent: boolean;
};

export type TeacherEmploymentSummary = {
  contractType: string | null;
  employmentType: string | null;
  employmentStatus: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  hireDate: string | null;
};

export type TeacherSensitiveHr = {
  salary: string | null;
  nationalId: string | null;
  address: string | null;
  city: string | null;
  dateOfBirth: string | null;
  bankRib: string | null;
  cnssNumber: string | null;
  amoNumber: string | null;
};

export type TeacherDependency = { key: string; count: number };

export type TeacherDetail = TeacherDirectoryItem & {
  firstName: string | null;
  lastName: string | null;
  cycle: string;
  qualification: string | null;
  hireDate: string | null;
  createdAt: string;
  lastLogin: string | null;
  documents: { contract: boolean; cin: boolean; diploma: boolean };
  employment: TeacherEmploymentSummary | null;
  sensitiveHr: TeacherSensitiveHr | null;
  sensitiveRedacted: boolean;
  classAssignments: TeacherClassAssignmentHistoryItem[];
  subjectAssignments: TeacherSubjectAssignmentItem[];
  canHardDelete: boolean;
  dependencies: TeacherDependency[];
};

export type TeacherFilterOptions = {
  subjects: { id: string; name: string }[];
  classes: { id: string; label: string }[];
  branches: { id: string; name: string }[];
};

export type TeacherDirectoryQuery = {
  search: string;
  status: TeacherStatus | 'all';
  subjectId: string;
  classSectionId: string;
  branchId: string;
  page: number;
  pageSize: number;
};

export const EMPTY_TEACHER_QUERY: TeacherDirectoryQuery = {
  search: '',
  status: 'all',
  subjectId: '',
  classSectionId: '',
  branchId: '',
  page: 1,
  pageSize: 20,
};

export type TeacherFormValues = {
  fullName: string;
  email: string;
  phone: string;
  employeeId: string;
  specialization: string;
  cycle: string;
  hireDate: string;
  dateOfBirth: string;
  gender: string;
  nationalId: string;
  address: string;
  city: string;
  qualification: string;
  salary: string;
  branchId: string;
  contract: boolean;
  cin: boolean;
  diploma: boolean;
};

export const EMPTY_TEACHER_FORM: TeacherFormValues = {
  fullName: '',
  email: '',
  phone: '',
  employeeId: '',
  specialization: '',
  cycle: '',
  hireDate: '',
  dateOfBirth: '',
  gender: '',
  nationalId: '',
  address: '',
  city: '',
  qualification: '',
  salary: '',
  branchId: '',
  contract: false,
  cin: false,
  diploma: false,
};

export type TeacherProvisioning = {
  tokenCreated: boolean;
  deliveryStatus: 'queued' | 'no_phone';
  setupUrl: string | null;
};
