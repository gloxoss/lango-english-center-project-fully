export type AudienceSegmentItem = {
  id: string;
  segmentName: string;
  description: string;
  targetCount: number;
  conditionCount: number;
  lastUpdated: string;
  status: 'Actif' | 'Statique';
};

export const AUDIENCE_SEGMENTS: AudienceSegmentItem[] = [
  { id: '1', segmentName: 'Parents d\'élèves du Primaire', description: 'Familles avec des enfants inscrits de la 1ère à la 6ème A.P.', targetCount: 420, conditionCount: 3, lastUpdated: 'Hier à 14:30', status: 'Actif' },
  { id: '2', segmentName: 'Prospects Visite Effectuée (Non Inscrits)', description: 'Prospects ayant effectué une visite sur campus mais sans dossier finalisé.', targetCount: 156, conditionCount: 4, lastUpdated: 'Aujourd\'hui à 09:15', status: 'Actif' },
  { id: '3', segmentName: 'Élèves 2ème BAC S1 & S2', description: 'Étudiants en deuxième année du baccalauréat sciences mathématiques.', targetCount: 88, conditionCount: 2, lastUpdated: '25 mai 2025', status: 'Statique' },
  { id: '4', segmentName: 'Familles en retard de paiement (> 15j)', description: 'Contacts ayant des mensualités scolarité impayées.', targetCount: 42, conditionCount: 2, lastUpdated: 'Aujourd\'hui à 08:00', status: 'Actif' },
];
