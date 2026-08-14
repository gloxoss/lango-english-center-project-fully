export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

export type RosterStudent = {
  id: string;
  name: string;
  avatar: string;
  matricule: string;
  defaultStatus: AttendanceStatus;
  attendanceRate: number;
};

export const INITIAL_ROSTER: RosterStudent[] = [
  { id: '1', name: 'Yassine Alami', avatar: 'YA', matricule: '2026-0014', defaultStatus: 'present', attendanceRate: 98 },
  { id: '2', name: 'Sami Alami', avatar: 'SA', matricule: '2026-0015', defaultStatus: 'present', attendanceRate: 96 },
  { id: '3', name: 'Lina Bennani', avatar: 'LB', matricule: '2026-0016', defaultStatus: 'late', attendanceRate: 91 },
  { id: '4', name: 'Mehdi Chraibi', avatar: 'MC', matricule: '2026-0017', defaultStatus: 'absent', attendanceRate: 84 },
  { id: '5', name: 'Aya Chraibi', avatar: 'AC', matricule: '2026-0018', defaultStatus: 'excused', attendanceRate: 95 },
  { id: '6', name: 'Nora El Idrissi', avatar: 'NE', matricule: '2026-0019', defaultStatus: 'present', attendanceRate: 100 },
];

export const CLASSES = [
  { id: 'cl-1', name: '2BAC-A Sc. Maths' },
  { id: 'cl-2', name: '1BAC-B Sc. Exp.' },
  { id: 'cl-3', name: '3AC-A' },
];

export const SUBJECTS = [
  { id: 'sub-1', name: 'Mathématiques' },
  { id: 'sub-2', name: 'Physique-Chimie' },
  { id: 'sub-3', name: 'Français' },
];

export const STATUS_OPTIONS: { key: AttendanceStatus; label: string; activeBg: string; activeText: string; dotColor: string }[] = [
  { key: 'present', label: 'Présent', activeBg: 'bg-[#DCEBF4]', activeText: 'text-[#1B6C93]', dotColor: 'bg-[#2487B8]' },
  { key: 'late', label: 'Retard', activeBg: 'bg-[#FCF0DC]', activeText: 'text-[#E8A33D]', dotColor: 'bg-amber-400' },
  { key: 'absent', label: 'Absent', activeBg: 'bg-[#FCE4E2]', activeText: 'text-[#E5544B]', dotColor: 'bg-[#E5544B]' },
  { key: 'excused', label: 'Excusé', activeBg: 'bg-purple-50', activeText: 'text-purple-700', dotColor: 'bg-purple-500' },
];
