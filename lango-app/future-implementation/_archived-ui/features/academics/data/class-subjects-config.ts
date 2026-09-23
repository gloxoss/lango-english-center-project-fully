export type SubjectAssignmentItem = {
  id: string;
  subjectName: string;
  code: string;
  coefficient: number;
  weeklyHours: number;
  teacherName: string;
  teacherAvatar: string;
  roomName: string;
  type: 'compulsory' | 'elective';
  status: 'assigned' | 'conflict' | 'unassigned';
};

export const MOCK_ASSIGNMENTS: SubjectAssignmentItem[] = [
  { id: '1', subjectName: 'Mathématiques', code: 'MATH-2BAC', coefficient: 7, weeklyHours: 6, teacherName: 'M. Omar Alami', teacherAvatar: 'OA', roomName: 'Salle 104', type: 'compulsory', status: 'assigned' },
  { id: '2', subjectName: 'Physique-Chimie', code: 'PHYS-2BAC', coefficient: 5, weeklyHours: 5, teacherName: 'Mme Khadija Bennani', teacherAvatar: 'KB', roomName: 'Labo Physique 2', type: 'compulsory', status: 'assigned' },
  { id: '3', subjectName: 'Sciences de la Vie et de la Terre', code: 'SVT-2BAC', coefficient: 5, weeklyHours: 4, teacherName: 'M. Driss Chraibi', teacherAvatar: 'DC', roomName: 'Labo SVT 1', type: 'compulsory', status: 'assigned' },
  { id: '4', subjectName: 'Philosophie', code: 'PHIL-2BAC', coefficient: 2, weeklyHours: 2, teacherName: 'Non assigné', teacherAvatar: '?', roomName: 'Non définie', type: 'compulsory', status: 'unassigned' },
  { id: '5', subjectName: 'Anglais renforcé', code: 'ANG-2BAC', coefficient: 2, weeklyHours: 3, teacherName: 'M. John Smith', teacherAvatar: 'JS', roomName: 'Salle 202', type: 'elective', status: 'conflict' },
  { id: '6', subjectName: 'Français & Langue', code: 'FR-2BAC', coefficient: 4, weeklyHours: 4, teacherName: 'Mme Souad El Fassi', teacherAvatar: 'SF', roomName: 'Salle 104', type: 'compulsory', status: 'assigned' },
];
