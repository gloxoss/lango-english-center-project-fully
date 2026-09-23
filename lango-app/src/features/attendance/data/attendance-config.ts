export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

// Canonical status keys for the roll-call UI. Labels are translated at the
// render site (Status namespace) — no application-owned copy lives here, and
// no mock roster/class/subject fixtures exist in production code.
export const STATUS_OPTIONS: { key: AttendanceStatus; activeBg: string; activeText: string; dotColor: string }[] = [
  { key: 'present', activeBg: 'bg-[#DCEBF4]', activeText: 'text-[#1B6C93]', dotColor: 'bg-[#2487B8]' },
  { key: 'late', activeBg: 'bg-[#FCF0DC]', activeText: 'text-[#E8A33D]', dotColor: 'bg-amber-400' },
  { key: 'absent', activeBg: 'bg-[#FCE4E2]', activeText: 'text-[#E5544B]', dotColor: 'bg-[#E5544B]' },
  { key: 'excused', activeBg: 'bg-purple-50', activeText: 'text-purple-700', dotColor: 'bg-purple-500' },
];
