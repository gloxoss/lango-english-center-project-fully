// Types for the exam planning workspace. Every value the planning screen shows
// comes from the API (exam_schedules + exam_seats + exam_supervisors joined to
// staff) — the previous module-level MOCK_EXAMS array is gone for good
// (audit 2026-09-22, P0-2): a school must never see exams it did not create or
// supervisors who do not exist.

export type Invigilator = {
  name: string;
  avatar: string;
  /** Real exam_supervisors.staffId this row came from. */
  staffKey: string;
  /** True when the stored staffId resolves to no tenant staff member (legacy free-text rows). */
  unassigned?: boolean;
};

/** Real schedule status values (exam_schedules.status). */
export type ExamScheduleStatus = 'draft' | 'published' | 'cancelled';

export type ExamSession = {
  id: string;
  subject: string;
  className: string;
  date: string;
  time: string;
  room: string;
  invigilators: Invigilator[];
  totalCandidates: number;
  /** null when the schedule has no hall — displayed as "—", never a default. */
  maxCapacity: number | null;
  status: ExamScheduleStatus;
  seatingGrid: { desk: string; studentName: string; matricule: string; isOccupied: boolean }[];
};
