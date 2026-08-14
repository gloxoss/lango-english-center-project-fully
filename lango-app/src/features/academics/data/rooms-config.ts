export type RoomItem = {
  id: string;
  name: string;
  code: string;
  building: string;
  floor: string;
  capacity: number;
  type: 'Classroom' | 'Laboratory' | 'Amphitheater' | 'Computer Lab';
  equipment: string[];
  occupancyStatus: 'Occupied' | 'Available' | 'Maintenance';
  currentClass?: string;
  schedule: { time: string; course: string }[];
};

export const MOCK_ROOMS: RoomItem[] = [
  {
    id: '1',
    name: 'Salle 104',
    code: 'A-104',
    building: 'Bâtiment Principal',
    floor: '1er Étage',
    capacity: 32,
    type: 'Classroom',
    equipment: ['Vidéoprojecteur', 'Climatisation', 'TBI'],
    occupancyStatus: 'Occupied',
    currentClass: '2BAC-A (Maths)',
    schedule: [
      { time: '08:00 - 10:00', course: '2BAC-A (Mathématiques)' },
      { time: '10:15 - 12:15', course: '1BAC-A (Français)' },
      { time: '14:00 - 16:00', course: '3AC-A (Philosophie)' },
    ],
  },
  {
    id: '2',
    name: 'Labo Physique 2',
    code: 'B-LAB2',
    building: 'Aile Scientifique',
    floor: 'Rez-de-chaussée',
    capacity: 28,
    type: 'Laboratory',
    equipment: ['Paillasses chimie', 'Hotte aspirante', 'Projecteur'],
    occupancyStatus: 'Occupied',
    currentClass: '2BAC-B (Physique)',
    schedule: [
      { time: '10:15 - 12:15', course: '2BAC-B (Physique-Chimie)' },
    ],
  },
  {
    id: '3',
    name: 'Amphithéâtre Ibno Kholdoun',
    code: 'AMPHI-1',
    building: 'Centre de Conférence',
    floor: 'Rez-de-chaussée',
    capacity: 150,
    type: 'Amphitheater',
    equipment: ['Sonorisation Pro', 'Écran géant', 'Micro sans fil'],
    occupancyStatus: 'Available',
    schedule: [
      { time: '14:00 - 18:00', course: 'Conférence Scientifique (Optionnelle)' },
    ],
  },
  {
    id: '4',
    name: 'Salle Informatique 1',
    code: 'INF-01',
    building: 'Aile Tech',
    floor: '2ème Étage',
    capacity: 30,
    type: 'Computer Lab',
    equipment: ['30 PC i7', 'Fibre 1Gbps', 'TBI'],
    occupancyStatus: 'Maintenance',
    schedule: [],
  },
];
