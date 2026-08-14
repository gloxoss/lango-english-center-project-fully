export type AwardNomination = {
  id: string;
  nomineeName: string;
  role: string;
  department: string;
  avatar: string;
  awardTitle: string;
  nominator: string;
  date: string;
  status: 'Approuvé' | 'En cours d\'évaluation';
};

export const AWARD_NOMINATIONS: AwardNomination[] = [
  { id: '1', nomineeName: 'Samir El Amrani', role: 'Enseignant SVT', department: 'Secondaire', avatar: 'SA', awardTitle: 'Professeur de l\'Année 2025', nominator: 'Direction des Écoles', date: '15 mai 2025', status: 'Approuvé' },
  { id: '2', nomineeName: 'Karima Bennani', role: 'Responsable Bibliothécaire', department: 'Services Généraux', avatar: 'KB', awardTitle: 'Prix de l\'Innovation Pédagogique', nominator: 'Conseil d\'Établissement', date: '18 mai 2025', status: 'En cours d\'évaluation' },
  { id: '3', nomineeName: 'Tariq Berrada', role: 'Professeur Informatique', department: 'Lycée', avatar: 'TB', awardTitle: 'Excellence Numérique', nominator: 'Équipe IT', date: '12 mai 2025', status: 'Approuvé' },
];
