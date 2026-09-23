export type TeacherWorkloadItem = {
  id: string;
  name: string;
  avatar: string;
  specialty: string;
  phone: string;
  weeklyHours: number;
  maxHours: number;
  assignedClassesCount: number;
  status: 'overload' | 'balanced' | 'underload';
  timetablePreview: { day: string; hours: string; className: string; subject: string; room: string }[];
};

export const MOCK_TEACHERS: TeacherWorkloadItem[] = [
  {
    id: 't1',
    name: 'M. Omar Alami',
    avatar: 'OA',
    specialty: 'Mathématiques (Lycée)',
    phone: '+212 6 61 23 45 67',
    weeklyHours: 28,
    maxHours: 26,
    assignedClassesCount: 5,
    status: 'overload',
    timetablePreview: [
      { day: 'Lundi', hours: '08h-10h', className: '2BAC-A', subject: 'Maths', room: 'Salle 104' },
      { day: 'Lundi', hours: '10h-12h', className: '2BAC-B', subject: 'Maths', room: 'Salle 105' },
      { day: 'Mardi', hours: '14h-16h', className: '1BAC-A', subject: 'Maths', room: 'Salle 201' },
      { day: 'Mercredi', hours: '08h-10h', className: '2BAC-A', subject: 'Maths', room: 'Salle 104' },
      { day: 'Jeudi', hours: '10h-12h', className: '3AC-A', subject: 'Maths', room: 'Salle 302' },
      { day: 'Vendredi', hours: '14h-16h', className: '1BAC-A', subject: 'Maths', room: 'Salle 201' },
    ],
  },
  {
    id: 't2',
    name: 'Mme Khadija Bennani',
    avatar: 'KB',
    specialty: 'Physique-Chimie',
    phone: '+212 6 62 34 56 78',
    weeklyHours: 22,
    maxHours: 26,
    assignedClassesCount: 4,
    status: 'balanced',
    timetablePreview: [
      { day: 'Lundi', hours: '10h-12h', className: '2BAC-A', subject: 'Physique', room: 'Labo 1' },
      { day: 'Mercredi', hours: '08h-10h', className: '1BAC-B', subject: 'Physique', room: 'Labo 1' },
      { day: 'Jeudi', hours: '14h-16h', className: '2BAC-B', subject: 'Chimie', room: 'Labo 2' },
      { day: 'Vendredi', hours: '10h-12h', className: '1BAC-A', subject: 'Physique', room: 'Labo 1' },
    ],
  },
  {
    id: 't3',
    name: 'M. Driss Chraibi',
    avatar: 'DC',
    specialty: 'Sciences de la Vie & Terre (SVT)',
    phone: '+212 6 63 45 67 89',
    weeklyHours: 14,
    maxHours: 26,
    assignedClassesCount: 3,
    status: 'underload',
    timetablePreview: [
      { day: 'Mardi', hours: '08h-10h', className: '2BAC-B', subject: 'SVT', room: 'Labo SVT' },
      { day: 'Jeudi', hours: '08h-10h', className: '4COL-A', subject: 'SVT', room: 'Salle 301' },
      { day: 'Vendredi', hours: '08h-10h', className: '1BAC-A', subject: 'SVT', room: 'Labo SVT' },
    ],
  },
  {
    id: 't4',
    name: 'Mme Souad El Fassi',
    avatar: 'SF',
    specialty: 'Français (BIOF & Collège)',
    phone: '+212 6 64 56 78 90',
    weeklyHours: 25,
    maxHours: 26,
    assignedClassesCount: 5,
    status: 'balanced',
    timetablePreview: [
      { day: 'Lundi', hours: '14h-16h', className: '3AC-A', subject: 'Français', room: 'Salle 302' },
      { day: 'Mardi', hours: '10h-12h', className: '2BAC-A', subject: 'Français', room: 'Salle 104' },
      { day: 'Mercredi', hours: '10h-12h', className: '1BAC-A', subject: 'Français', room: 'Salle 201' },
    ],
  },
];

export const TIMETABLE_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
