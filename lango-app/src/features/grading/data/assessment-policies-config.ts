export type EvaluationRule = {
  id: string;
  name: string;
  weight: number;
  description: string;
};

export type GradeScale = {
  letter: string;
  minScore: number;
  maxScore: number;
  label: string;
  color: string;
};

export const MOCK_WEIGHTS: EvaluationRule[] = [
  { id: '1', name: 'Examen Final de Semestre (Devoir Synthèse)', weight: 50, description: 'Épreuve écrite nationale / régionale sur table' },
  { id: '2', name: 'Contrôles Continus (CC1 & CC2)', weight: 30, description: 'Évaluations formatives régulières en classe' },
  { id: '3', name: 'Devoirs à la maison & TP Pratiques', weight: 15, description: 'Travaux personnels et séances de laboratoire' },
  { id: '4', name: 'Assiduité & Participation Orale', weight: 5, description: 'Présence effective et engagement au cours' },
];

export const MOCK_SCALES: GradeScale[] = [
  { letter: 'A+', minScore: 18, maxScore: 20, label: 'Excellent', color: 'bg-emerald-50 text-[#17A673] border-emerald-200' },
  { letter: 'A', minScore: 16, maxScore: 17.9, label: 'Très Bien', color: 'bg-[#DCEBF4] text-[#1B6C93] border-blue-200' },
  { letter: 'B', minScore: 14, maxScore: 15.9, label: 'Bien', color: 'bg-[#DCEBF4] text-[#1B6C93] border-blue-200' },
  { letter: 'C', minScore: 12, maxScore: 13.9, label: 'Assez Bien', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  { letter: 'D', minScore: 10, maxScore: 11.9, label: 'Passable (Seuil de réussite)', color: 'bg-[#FCF0DC] text-[#E8A33D] border-amber-200' },
  { letter: 'F', minScore: 0, maxScore: 9.9, label: 'Ajourné / Rattrapage', color: 'bg-[#FCE4E2] text-[#E5544B] border-rose-200' },
];
