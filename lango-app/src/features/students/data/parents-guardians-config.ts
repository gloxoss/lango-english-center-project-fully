export type HouseholdItem = {
  id: string;
  familyName: string;
  householdCode: string;
  address: string;
  city: string;
  financialStatus: 'À jour' | 'En retard';
  portalAccess?: boolean;
  primaryTutorName: string;
  primaryAvatar: string;
  primaryTutorPhone: string;
  primaryTutorEmail: string;
  primaryTutorRelation: string;
  secondaryTutorName?: string;
  secondaryAvatar?: string;
  secondaryTutorPhone?: string;
  secondaryTutorRelation?: string;
  children: { name: string; gradeLevel: string; classSection: string }[];
};

export const MOCK_HOUSEHOLDS: HouseholdItem[] = [
  {
    id: 'FAM-2026-014',
    familyName: 'Famille Alami',
    householdCode: '#FAM-2026-014',
    address: 'Res. Al Massira, Apt 12, Bd Anfa',
    city: 'Casablanca',
    financialStatus: 'À jour',
    primaryTutorName: 'Omar Alami',
    primaryAvatar: 'OA',
    primaryTutorPhone: '+212 6 61 23 45 67',
    primaryTutorEmail: 'omar.alami@email.ma',
    primaryTutorRelation: 'Père (Tuteur principal)',
    secondaryTutorName: 'Khadija Alami',
    secondaryAvatar: 'KA',
    secondaryTutorPhone: '+212 6 61 99 88 77',
    secondaryTutorRelation: 'Mère (Tuteur secondaire)',
    children: [
      { name: 'Yassine Alami', gradeLevel: '2nde', classSection: '2BAC-A' },
      { name: 'Sami Alami', gradeLevel: '6ème', classSection: '6COL-B' },
    ],
  },
  {
    id: 'FAM-2026-015',
    familyName: 'Famille Bennani',
    householdCode: '#FAM-2026-015',
    address: '15 Bd Massira, Californie',
    city: 'Casablanca',
    financialStatus: 'À jour',
    primaryTutorName: 'Salma Bennani',
    primaryAvatar: 'SB',
    primaryTutorPhone: '+212 6 62 88 99 00',
    primaryTutorEmail: 'salma.bennani@email.ma',
    primaryTutorRelation: 'Mère (Tuteur principal)',
    children: [
      { name: 'Lina Bennani', gradeLevel: '2nde', classSection: '2BAC-A' },
    ],
  },
  {
    id: 'FAM-2026-016',
    familyName: 'Famille Chraibi',
    householdCode: '#FAM-2026-016',
    address: '8 Rue des Iris, Gauthier',
    city: 'Casablanca',
    financialStatus: 'En retard',
    primaryTutorName: 'Driss Chraibi',
    primaryAvatar: 'DC',
    primaryTutorPhone: '+212 6 63 11 22 33',
    primaryTutorEmail: 'driss.chraibi@email.ma',
    primaryTutorRelation: 'Père (Tuteur principal)',
    children: [
      { name: 'Mehdi Chraibi', gradeLevel: '1ère', classSection: '1BAC-B' },
      { name: 'Aya Chraibi', gradeLevel: '4ème', classSection: '4COL-A' },
    ],
  },
];
