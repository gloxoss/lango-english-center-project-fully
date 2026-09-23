export type SubmissionItem = {
  id: string;
  studentName: string;
  avatar: string;
  matricule: string;
  submittedAt: string;
  fileName: string;
  fileSize: string;
  score?: number;
  maxScore: number;
  feedback?: string;
  status: 'Graded' | 'Pending' | 'Needs Revision';
};

export const MOCK_SUBMISSIONS: SubmissionItem[] = [
  { id: '1', studentName: 'Yassine Alami', avatar: 'YA', matricule: '2026-0014', submittedAt: '04 juin à 16:30', fileName: 'Copie_Yassine_Alami_DM4.pdf', fileSize: '3.2 MB', score: 18.5, maxScore: 20, feedback: 'Excellente démonstration sur le chapitre logarithmes.', status: 'Graded' },
  { id: '2', studentName: 'Lina Bennani', avatar: 'LB', matricule: '2026-0016', submittedAt: '05 juin à 11:15', fileName: 'DM4_Lina_Bennani_Maths.pdf', fileSize: '2.1 MB', maxScore: 20, status: 'Pending' },
  { id: '3', studentName: 'Mehdi Chraibi', avatar: 'MC', matricule: '2026-0017', submittedAt: '05 juin à 22:40', fileName: 'Exercice_Mehdi.pdf', fileSize: '1.4 MB', score: 11, maxScore: 20, feedback: 'Revoir la question 3b sur les dérivées.', status: 'Needs Revision' },
];
