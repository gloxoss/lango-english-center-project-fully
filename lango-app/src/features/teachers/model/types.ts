export interface Teacher {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  subjects: string[];
  cycle: string;
  assignedClasses: string[];
  status: 'active' | 'leave' | 'inactive' | 'Actif' | 'Congé' | 'Incomplet';
  workloadHours: number;
  avatarUrl?: string;
  hireDate?: string;
  documents?: {
    contract: boolean;
    cin: boolean;
    diploma: boolean;
  };
}

export interface TeacherWorkload {
  teacherId: string;
  teacherName: string;
  subject: string;
  classCount: number;
  weeklyHours: number;
  maxCapacity: number;
}

export interface TeacherImportRow {
  id: number;
  initials: string;
  name: string;
  matricule: string;
  phone: string;
  email: string;
  specialty: string;
  subject: string;
  cycles: string;
  charge: number;
  status: 'Valide' | 'Téléphone invalide' | 'Champ manquant' | 'Email en double';
}
