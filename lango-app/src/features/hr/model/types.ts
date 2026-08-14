// Shared client types for the HR module (matches directoryProjection in employees-service).

export type EmploymentStatus = 'active' | 'probation' | 'on_leave' | 'offboarded' | 'archived';
export type EmploymentType = 'permanent' | 'fixed_term' | 'part_time' | 'contractor' | 'internship' | 'substitute';
export type ContractType = 'cdi' | 'cdd' | 'vacation';

export type EmployeeRow = {
  id: string;
  userId: string | null;
  employeeId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  profilePhotoUrl: string | null;
  displayName: string;
  branchId: string | null;
  departmentId: string | null;
  designationId: string | null;
  managerEmployeeId: string | null;
  employmentType: EmploymentType | null;
  employmentStatus: EmploymentStatus;
  hireDate: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  workloadHours: number | null;
  dependantsCount: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  accountName: string | null;
  accountEmail: string | null;
  accountRole: string | null;
  accountStatus: string | null;
  photoUrl: string | null;
  departmentName: string | null;
  designationTitle: string | null;
  // Sensitive — absent from the payload unless the caller has hr.sensitive.read.
  cnssNumber?: string | null;
  amoNumber?: string | null;
  bankRib?: string | null;
  contractType?: ContractType | null;
  archivedReason?: string | null;
  nationalId?: string | null;
  salary?: string | null;
};

export type EmploymentEventRow = {
  id: string;
  eventType: string;
  actorId: string | null;
  actorName: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  effectiveAt: string;
  createdAt: string;
};

export type DepartmentRow = {
  id: string;
  branchId: string | null;
  name: string;
  code: string | null;
  headEmployeeId: string | null;
  description: string | null;
  status: string;
  employeeCount: number;
};

export type DesignationRow = {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  description: string | null;
  status: string;
  employeeCount: number;
};

export type BranchOption = {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  isDefault: boolean | null;
  isActive: boolean | null;
};

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  active: 'Actif',
  probation: 'Période d\'essai',
  on_leave: 'En congé',
  offboarded: 'Désactivé',
  archived: 'Archivé',
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  permanent: 'CDI',
  fixed_term: 'CDD',
  part_time: 'Temps partiel',
  contractor: 'Prestataire',
  internship: 'Stage',
  substitute: 'Remplaçant',
};

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  cdi: 'CDI',
  cdd: 'CDD',
  vacation: 'Vacation',
};

export const EMPLOYMENT_STATUS_STYLES: Record<EmploymentStatus, string> = {
  active: 'bg-[#D1F5E8] text-[#0b5c3a]',
  probation: 'bg-blue-50 text-blue-700',
  on_leave: 'bg-amber-50 text-amber-700',
  offboarded: 'bg-red-50 text-red-700',
  archived: 'bg-slate-100 text-slate-500',
};
