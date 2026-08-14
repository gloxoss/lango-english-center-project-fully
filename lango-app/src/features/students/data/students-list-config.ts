export type StudentItem = {
  id: string;
  name: string;
  matricule: string;
  gradeLevel: string;
  classSection: string;
  attendancePct: number;
  status: 'Actif' | 'Inactif' | 'Suspendu';
  financialStatus: 'À jour' | 'En retard' | 'Partiel';
  gpa: string;
  dob: string;
  address: string;
  guardianName: string;
  guardianPhone: string;
  guardianRelation: string;
  tuitionTotal: string;
  tuitionPaid: string;
  tuitionBalance: string;
  tuitionStatus: string;
  absencesUnexcused: number;
  latesTotal: number;
  recentDocuments: { name: string; date: string }[];
};

export const MOCK_STUDENTS: StudentItem[] = [
  {
    id: 'STU-2026-0042',
    name: 'Yassine Alami',
    matricule: '#2026-0042',
    gradeLevel: '2nde A',
    classSection: '2BAC-A',
    attendancePct: 96,
    status: 'Actif',
    financialStatus: 'À jour',
    gpa: '16,2 / 20',
    dob: '14 Mars 2010',
    address: 'Res. Al Massira, Apt 12, Casablanca',
    guardianName: 'Omar Alami',
    guardianPhone: '+212 6 61 23 45 67',
    guardianRelation: 'Père',
    tuitionTotal: '45 000 MAD',
    tuitionPaid: '45 000 MAD',
    tuitionBalance: '0 MAD',
    tuitionStatus: 'Réglé à 100%',
    absencesUnexcused: 1,
    latesTotal: 2,
    recentDocuments: [
      { name: 'Certificat de scolarité 2025-2026.pdf', date: '12 Jan 2026' },
      { name: 'Relevé de notes - Semestre 1.pdf', date: '20 Fév 2026' },
    ],
  },
  {
    id: 'STU-2026-0043',
    name: 'Lina Bennani',
    matricule: '#2026-0043',
    gradeLevel: '2nde A',
    classSection: '2BAC-A',
    attendancePct: 98,
    status: 'Actif',
    financialStatus: 'À jour',
    gpa: '17,8 / 20',
    dob: '02 Juin 2010',
    address: '15 Bd Anfa, Casablanca',
    guardianName: 'Salma Bennani',
    guardianPhone: '+212 6 62 88 99 00',
    guardianRelation: 'Mère',
    tuitionTotal: '45 000 MAD',
    tuitionPaid: '45 000 MAD',
    tuitionBalance: '0 MAD',
    tuitionStatus: 'Réglé à 100%',
    absencesUnexcused: 0,
    latesTotal: 0,
    recentDocuments: [
      { name: 'Fiche d\'inscription 2025-2026.pdf', date: '05 Sep 2025' },
    ],
  },
  {
    id: 'STU-2026-0044',
    name: 'Mehdi Chraibi',
    matricule: '#2026-0044',
    gradeLevel: '1ère B',
    classSection: '1BAC-B',
    attendancePct: 88,
    status: 'Actif',
    financialStatus: 'En retard',
    gpa: '13,5 / 20',
    dob: '22 Nov 2009',
    address: 'Californie 2, Villa 4, Casablanca',
    guardianName: 'Driss Chraibi',
    guardianPhone: '+212 6 63 11 22 33',
    guardianRelation: 'Père',
    tuitionTotal: '48 000 MAD',
    tuitionPaid: '30 000 MAD',
    tuitionBalance: '18 000 MAD',
    tuitionStatus: 'Échéance dépassée',
    absencesUnexcused: 4,
    latesTotal: 5,
    recentDocuments: [],
  },
];
