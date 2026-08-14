export type Resource = {
  id: string;
  name: string;
  type: 'pdf' | 'video' | 'link';
  size?: string;
  url?: string;
};

export type Chapter = {
  id: string;
  number: number;
  title: string;
  status: 'Completed' | 'In Progress' | 'Upcoming';
  hoursAllocated: number;
  resources: Resource[];
};

export const MOCK_CHAPTERS: Chapter[] = [
  {
    id: '1',
    number: 1,
    title: 'Chapitre 1 : Limites et Continuité des Fonctions Numériques',
    status: 'Completed',
    hoursAllocated: 12,
    resources: [
      { id: 'r1', name: 'Cours_Complet_Limites_2026.pdf', type: 'pdf', size: '2.4 MB' },
      { id: 'r2', name: 'Exercices_Corriges_Chapitre1.pdf', type: 'pdf', size: '1.8 MB' },
      { id: 'r3', name: 'Video_Explicative_Theoreme_Valeurs_Intermediaires.mp4', type: 'video', size: '45 MB' },
    ],
  },
  {
    id: '2',
    number: 2,
    title: 'Chapitre 2 : Dérivabilité et Étude des Fonctions Logarithmes',
    status: 'In Progress',
    hoursAllocated: 16,
    resources: [
      { id: 'r4', name: 'Fiche_Resume_Ln_et_Proprietes.pdf', type: 'pdf', size: '950 KB' },
    ],
  },
  {
    id: '3',
    number: 3,
    title: 'Chapitre 3 : Suites Numériques & Raisonnement par Récurrence',
    status: 'Upcoming',
    hoursAllocated: 14,
    resources: [],
  },
];
