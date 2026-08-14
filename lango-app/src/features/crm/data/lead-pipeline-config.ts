export type PriorityLevel = 'Haute' | 'Moyenne' | 'Basse';

export type LeadCardItem = {
  id: string;
  name: string;
  grade: string;
  campus: string;
  source: string;
  assigned: string;
  priority: PriorityLevel;
  date: string;
  visitDate?: string;
  dossierDate?: string;
  enrollmentDate?: string;
  isSelected?: boolean;
};

export type KanbanColumn = {
  id: string;
  title: string;
  count: number;
  dotColor: string;
  leads: LeadCardItem[];
};

export const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: 'nouveau',
    title: 'Nouveau',
    count: 24,
    dotColor: 'bg-[#2487B8]',
    leads: [
      { id: '1', name: 'Yassine Bennis', grade: '6ème', campus: 'Campus Oasis', source: 'Site web', assigned: 'YE', priority: 'Haute', date: '28 mai 2025', isSelected: true },
      { id: '2', name: 'Inès Belkadi', grade: '2nde', campus: 'Campus Maarif', source: 'Facebook', assigned: 'MA', priority: 'Moyenne', date: '30 mai 2025' },
      { id: '3', name: 'Adam El Idrissi', grade: '5ème', campus: 'Campus Oasis', source: 'Recommandation', assigned: 'YE', priority: 'Basse', date: '01 juin 2025' },
      { id: '4', name: 'Yara Ait El Hajj', grade: '3ème', campus: 'Campus Maarif', source: 'Instagram', assigned: 'OA', priority: 'Moyenne', date: '02 juin 2025' },
    ]
  },
  {
    id: 'contacte',
    title: 'Contacté',
    count: 19,
    dotColor: 'bg-blue-400',
    leads: [
      { id: '5', name: 'Amine Rguibi', grade: '1ère', campus: 'Campus Maarif', source: 'Email', assigned: 'MA', priority: 'Haute', date: '27 mai 2025' },
      { id: '6', name: 'Lina Chraibi', grade: '4ème', campus: 'Campus Oasis', source: 'Téléphone', assigned: 'YE', priority: 'Moyenne', date: '29 mai 2025' },
      { id: '7', name: 'Ilyass Tahiri', grade: '6ème', campus: 'Campus Oasis', source: 'WhatsApp', assigned: 'MA', priority: 'Basse', date: '31 mai 2025' },
      { id: '8', name: 'Sara Meziane', grade: '2nde', campus: 'Campus Maarif', source: 'Email', assigned: 'OA', priority: 'Moyenne', date: '01 juin 2025' },
    ]
  },
  {
    id: 'visite',
    title: 'Visite planifiée',
    count: 12,
    dotColor: 'bg-amber-400',
    leads: [
      { id: '9', name: 'Nour El Houda Alaoui', grade: '5ème', campus: 'Campus Oasis', source: 'Visite', visitDate: '24 mai 2025 à 10:00', assigned: 'YE', priority: 'Haute', date: '24 mai 2025' },
      { id: '10', name: 'Hiba El Amrani', grade: '3ème', campus: 'Campus Maarif', source: 'Visite', visitDate: '25 mai 2025 à 11:30', assigned: 'MA', priority: 'Moyenne', date: '25 mai 2025' },
      { id: '11', name: 'Mehdi Bencharki', grade: '1ère', campus: 'Campus Oasis', source: 'Visite', visitDate: '26 mai 2025 à 14:00', assigned: 'YE', priority: 'Moyenne', date: '26 mai 2025' },
      { id: '12', name: 'Salma Lahlou', grade: '2nde', campus: 'Campus Maarif', source: 'Visite', visitDate: '27 mai 2025 à 16:00', assigned: 'OA', priority: 'Basse', date: '27 mai 2025' },
    ]
  },
  {
    id: 'dossier',
    title: 'Dossier en cours',
    count: 15,
    dotColor: 'bg-purple-500',
    leads: [
      { id: '13', name: 'Youssef El Fassi', grade: 'Terminale', campus: 'Campus Oasis', source: 'Dossier', dossierDate: '19 mai 2025', assigned: 'MA', priority: 'Haute', date: '19 mai 2025' },
      { id: '14', name: 'Kenza Mouden', grade: '1ère', campus: 'Campus Oasis', source: 'Dossier', dossierDate: '18 mai 2025', assigned: 'YE', priority: 'Moyenne', date: '18 mai 2025' },
      { id: '15', name: 'Rayan El Mansouri', grade: '4ème', campus: 'Campus Oasis', source: 'Dossier', dossierDate: '17 mai 2025', assigned: 'MA', priority: 'Moyenne', date: '17 mai 2025' },
      { id: '16', name: 'Joudia Mhamdi', grade: '3ème', campus: 'Campus Maarif', source: 'Dossier', dossierDate: '16 mai 2025', assigned: 'OA', priority: 'Basse', date: '16 mai 2025' },
    ]
  },
  {
    id: 'confirme',
    title: 'Inscription confirmée',
    count: 8,
    dotColor: 'bg-[#17A673]',
    leads: [
      { id: '17', name: 'Ibrahim Benjelloun', grade: '6ème', campus: 'Campus Oasis', source: 'Inscrit', enrollmentDate: '15 mai 2025', assigned: 'YE', priority: 'Basse', date: '15 mai 2025' },
      { id: '18', name: 'Meriem Zahraoui', grade: '2nde', campus: 'Campus Maarif', source: 'Inscrit', enrollmentDate: '14 mai 2025', assigned: 'MA', priority: 'Basse', date: '14 mai 2025' },
      { id: '19', name: 'Anas Benabbou', grade: '1ère', campus: 'Campus Oasis', source: 'Inscrit', enrollmentDate: '13 mai 2025', assigned: 'YE', priority: 'Basse', date: '13 mai 2025' },
      { id: '20', name: 'Aya El Khattabi', grade: '5ème', campus: 'Campus Oasis', source: 'Inscrit', enrollmentDate: '12 mai 2025', assigned: 'OA', priority: 'Basse', date: '12 mai 2025' },
    ]
  }
];
