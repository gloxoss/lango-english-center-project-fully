export type Invigilator = {
  name: string;
  avatar: string;
};

export type ExamSession = {
  id: string;
  subject: string;
  className: string;
  date: string;
  time: string;
  room: string;
  invigilators: Invigilator[];
  totalCandidates: number;
  maxCapacity: number;
  status: 'Scheduled' | 'In Progress' | 'Completed';
  seatingGrid: { desk: string; studentName: string; matricule: string; isOccupied: boolean }[];
};

export const MOCK_EXAMS: ExamSession[] = [
  {
    id: '1',
    subject: 'Examen National : Mathématiques (Baccalauréat)',
    className: '2BAC-A',
    date: '18 juin 2026',
    time: '08:00 - 12:00',
    room: 'Amphithéâtre Ibno Kholdoun',
    invigilators: [
      { name: 'M. Omar Alami', avatar: 'OA' },
      { name: 'Mme Khadija Bennani', avatar: 'KB' },
    ],
    totalCandidates: 28,
    maxCapacity: 30,
    status: 'Scheduled',
    seatingGrid: [
      { desk: 'A-01', studentName: 'Yassine Alami', matricule: '2026-0014', isOccupied: true },
      { desk: 'A-02', studentName: 'Sami Alami', matricule: '2026-0015', isOccupied: true },
      { desk: 'A-03', studentName: 'Lina Bennani', matricule: '2026-0016', isOccupied: true },
      { desk: 'A-04', studentName: 'Mehdi Chraibi', matricule: '2026-0017', isOccupied: true },
      { desk: 'B-01', studentName: 'Aya Chraibi', matricule: '2026-0018', isOccupied: true },
      { desk: 'B-02', studentName: 'Nora El Idrissi', matricule: '2026-0019', isOccupied: true },
      { desk: 'B-03', studentName: 'Tarik Bouzidi', matricule: '2026-0020', isOccupied: true },
      { desk: 'B-04', studentName: 'Table réservée (PMR)', matricule: '—', isOccupied: false },
    ],
  },
  {
    id: '2',
    subject: 'Examen Régional : Français & Instruction Islamique',
    className: '1BAC-A & B',
    date: '20 juin 2026',
    time: '08:30 - 11:30',
    room: 'Grande Salle de Conférence',
    invigilators: [
      { name: 'M. Driss Chraibi', avatar: 'DC' },
      { name: 'Mme Souad El Fassi', avatar: 'SF' },
    ],
    totalCandidates: 45,
    maxCapacity: 50,
    status: 'Scheduled',
    seatingGrid: [
      { desk: 'A-01', studentName: 'Karim Lahlou', matricule: '2026-0101', isOccupied: true },
      { desk: 'A-02', studentName: 'Sara Tazi', matricule: '2026-0102', isOccupied: true },
    ],
  },
  {
    id: '3',
    subject: 'Épreuve Pratique : Physique-Chimie',
    className: '2BAC-B',
    date: '15 juin 2026',
    time: '14:00 - 16:00',
    room: 'Labo Phys 1 & 2',
    invigilators: [
      { name: 'M. Rachid Berrada', avatar: 'RB' },
    ],
    totalCandidates: 26,
    maxCapacity: 28,
    status: 'Scheduled',
    seatingGrid: [
      { desk: 'L-01', studentName: 'Amine Berrada', matricule: '2026-0201', isOccupied: true },
    ],
  },
];
