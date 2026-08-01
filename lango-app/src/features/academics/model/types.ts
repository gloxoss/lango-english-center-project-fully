export interface OptionalSubject {
  id: string;
  name: string;
  category: string;
  teacherName: string;
  room: string;
  enrolledCount: number;
  maxCapacity: number;
  fillPercentage: number;
  color: string;
  icon: string;
  schedule: string[];
  description: string;
  prerequisites: string;
  status: 'Ouverte' | 'Fermée' | 'Liste d\'attente';
}

export interface SubjectAssignment {
  id: string;
  studentName: string;
  className: string;
  chosenOption: string;
  proposedOption: string;
  status: 'Affecté' | 'En attente' | 'Sur liste d\'attente' | 'Refusé';
  room: string;
  teacherName: string;
  hasConflict: boolean;
}
