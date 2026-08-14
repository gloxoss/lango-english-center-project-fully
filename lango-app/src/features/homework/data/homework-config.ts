export type HomeworkItem = {
  id: string;
  title: string;
  subject: string;
  className: string;
  teacher: string;
  dueDate: string;
  submittedCount: number;
  totalStudents: number;
  status: 'Active' | 'Closed' | 'Draft';
};

export const MOCK_HOMEWORK: HomeworkItem[] = [
  { id: '1', title: 'DM n°4 : Problème d\'analyse & logarithmes', subject: 'Mathématiques', className: '2BAC-A', teacher: 'M. Alami', dueDate: '05 juin 2026 à 23:59', submittedCount: 24, totalStudents: 32, status: 'Active' },
  { id: '2', title: 'TP de Chimie : Dosage par titrage pH-métrique', subject: 'Physique-Chimie', className: '2BAC-B', teacher: 'Mme Bennani', dueDate: '08 juin 2026 à 18:00', submittedCount: 18, totalStudents: 28, status: 'Active' },
  { id: '3', title: 'Dissertation : La liberté et la loi', subject: 'Philosophie', className: '2BAC-A', teacher: 'M. Mansouri', dueDate: '28 mai 2026 à 23:59', submittedCount: 32, totalStudents: 32, status: 'Closed' },
];
