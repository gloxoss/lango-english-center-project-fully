'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  ExternalLink,
  FileText,
  GraduationCap,
  Megaphone,
  RefreshCw,
  School,
  Users,
} from 'lucide-react';

type HomeData = {
  profile: { name: string; email: string } | null;
  placement: { classSectionId: string; name: string; medium: string | null } | null;
  today: { startTime: string; endTime: string; room: string | null; teacher: string | null }[];
  subjects: string[];
  announcements: { id: string; title: string; body: string; publishedAt: string }[];
  attendance: { present: number; absent: number; late: number; excused: number; total: number };
  todayStatus: string | null;
  widgets: { classesToday: number; mySubjects: number; present: number; late: number; absent: number };
};

type TimetableData = { days: { day: string; slots: { startTime: string; endTime: string; room: string | null; teacher: string | null }[] }[] };

type SubjectItem = {
  subjectName: string;
  teacherName: string;
  coefficient: number;
  provisionalAverage20: number | null;
  openHomework: number;
};
type SubjectsData = { subjects: SubjectItem[] };

type AttendanceData = {
  records: { date: string; status: string; period: number; note: string | null }[];
  summary: { present: number; absent: number; late: number; excused: number; total: number };
};

type ResultItem = {
  assessmentId?: string;
  assessmentResultId?: string;
  title?: string;
  assessmentPlanName?: string | null;
  criteriaName?: string;
  type?: string;
  subject?: string | null;
  subjectName?: string | null;
  score: number | null;
  maximumScore?: number | null;
  scoreOutOf?: number;
  normalizedScore20?: number | null;
  grade?: string | null;
  gradeLetter?: string | null;
  status: string;
  moderationState?: string;
  publishedAt?: string | null;
  date?: string | null;
  gradedAt?: string;
};

type SubjectSummaryItem = {
  subjectId?: string | null;
  subjectName: string;
  count: number;
  provisionalAverage20: number | null;
  coefficient: number;
};

type ResultsData = {
  results: ResultItem[];
  subjectSummary?: SubjectSummaryItem[];
  summary?: SubjectSummaryItem[];
  subjects?: SubjectSummaryItem[];
};

type ExamScheduleItem = {
  id: string;
  assessmentScheduleId?: string;
  title: string;
  subject: string | null;
  hall?: string | null;
  seatNumber?: string | null;
  deskNumber?: string | null;
  candidateNumber?: string | null;
  seat?: {
    seatNumber: string;
    deskLabel?: string | null;
    candidateNumber?: string | null;
  } | null;
  startTime: string;
  endTime: string;
  instructions?: string | null;
};

type OnlineExamItem = {
  id: string;
  title: string;
  subject: string | null;
  duration?: number | null;
  durationMinutes?: number | null;
  totalMarks?: number | string | null;
  takeUrl: string;
  isOpen: boolean;
  isExpired: boolean;
};

type ExamsData = {
  upcoming: ExamScheduleItem[];
  past: ExamScheduleItem[];
  onlineExams: OnlineExamItem[];
};

type HomeworkItem = {
  id: string;
  title: string;
  description: string | null;
  subjectName?: string;
  teacherName?: string;
  dueDate?: string;
  closeAt?: string | null;
  createdAt?: string;
  maxScore?: number | null;
  maximumScore?: string | number | null;
  submissionStatus?: 'pending' | 'submitted' | 'graded';
  isOverdue?: boolean;
  score?: number | null;
  feedback?: string | null;
  submission?: {
    id?: string;
    attemptNumber?: number;
    status: string;
    score: string | number | null;
    feedbackText: string | null;
    isLate?: boolean;
    submittedAt?: string;
  } | null;
  attachments?: { name: string; url: string; size?: number; type?: string }[];
};
type HomeworkData = HomeworkItem[];

type ReportCardItem = {
  id: string;
  termLabel: string;
  academicYear?: string;
  schoolYear?: string | null;
  generalAverage?: number | null;
  generalAverage20?: number | null;
  mention: string | null;
  decision: string | null;
  rank: number | null;
  classSize: number | null;
  issuedDate: string;
};
type ReportCardsData = ReportCardItem[];

type TabKey = 'today' | 'timetable' | 'subjects' | 'grades' | 'exams' | 'homework' | 'reportCards' | 'attendance';

const DAY_LABELS: Record<string, string> = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
};

const STATUS_LABELS: Record<string, string> = {
  present: 'Présent',
  absent: 'Absent',
  late: 'En retard',
  excused: 'Excusé',
};

const STATUS_COLORS: Record<string, string> = {
  present: 'text-[#17A673] bg-[#DDF5EC]',
  absent: 'text-red-700 bg-red-50',
  late: 'text-amber-700 bg-amber-50',
  excused: 'text-[#2487B8] bg-[#E4EDFD]',
};

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.success ? (json.data as T) : null;
  } catch {
    return null;
  }
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return d;
  }
}

function formatTimeRange(start: string, end: string): string {
  try {
    const dStart = new Date(start);
    const dEnd = new Date(end);
    if (!Number.isNaN(dStart.getTime()) && !Number.isNaN(dEnd.getTime())) {
      const timeStr = `${dStart.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}–${dEnd.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
      const dateStr = dStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      return `${dateStr} · ${timeStr}`;
    }
  } catch {
    // fallback
  }
  return `${start} – ${end}`;
}

export function StudentPortalView() {
  const tStudent = useTranslations('Student');
  const tCommon = useTranslations('Common');
  const tStatus = useTranslations('Status');

  const [home, setHome] = useState<HomeData | null>(null);
  const [timetable, setTimetable] = useState<TimetableData | null>(null);
  const [subjectsData, setSubjectsData] = useState<SubjectsData | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [resultsData, setResultsData] = useState<ResultsData | null>(null);
  const [examsData, setExamsData] = useState<ExamsData | null>(null);
  const [homeworkData, setHomeworkData] = useState<HomeworkData | null>(null);
  const [reportCardsData, setReportCardsData] = useState<ReportCardsData | null>(null);

  const [tabErrors, setTabErrors] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [tab, setTab] = useState<TabKey>('today');

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const getDayLabel = (day: string) => {
    const key = day.toLowerCase();
    try {
      return tStudent(key as any);
    } catch {
      return DAY_LABELS[key] ?? day;
    }
  };

  const getStatusLabel = (status: string) => {
    const key = status.toLowerCase();
    try {
      return tStatus(key as any);
    } catch {
      return STATUS_LABELS[key] ?? status;
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setTabErrors({});
    try {
      const [h, t, s, a, r, e, hw, rc] = await Promise.all([
        getJson<HomeData>('/api/student/me/home'),
        getJson<TimetableData>('/api/student/me/timetable'),
        getJson<SubjectsData>('/api/student/me/subjects'),
        getJson<AttendanceData>('/api/student/me/attendance'),
        getJson<ResultsData>('/api/student/me/results'),
        getJson<ExamsData>('/api/student/me/exams'),
        getJson<HomeworkData>('/api/student/me/homework'),
        getJson<ReportCardsData>('/api/student/me/report-cards'),
      ]);

      if (!h) {
        setError(tStudent('errorLoad'));
        setLoading(false);
        return;
      }

      setHome(h);
      setTimetable(t);
      setSubjectsData(s);
      setAttendanceData(a);
      setResultsData(r);
      setExamsData(e);
      setHomeworkData(hw);
      setReportCardsData(rc);

      const errors: Record<string, boolean> = {};
      if (!t) errors.timetable = true;
      if (!s) errors.subjects = true;
      if (!a) errors.attendance = true;
      if (!r) errors.grades = true;
      if (!e) errors.exams = true;
      if (!hw) errors.homework = true;
      if (!rc) errors.reportCards = true;
      setTabErrors(errors);
    } catch {
      setError(tStudent('errorLoad'));
    } finally {
      setLoading(false);
    }
  }, [tStudent]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownloadPdf = async (docId: string, termLabel: string) => {
    try {
      setDownloadingId(docId);
      setDownloadError(null);
      const res = await fetch(`/api/student/me/report-cards/${docId}/pdf`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTerm = termLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      a.download = `bulletin-${safeTerm || docId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      setDownloadError(tStudent('downloadError'));
    } finally {
      setDownloadingId(null);
    }
  };

  const groupedResults = useMemo(() => {
    if (!resultsData?.results) return {};
    const groups: Record<string, ResultItem[]> = {};
    for (const r of resultsData.results) {
      const subject = r.subjectName ?? r.subject ?? 'Autre';
      const list = groups[subject] ?? [];
      list.push(r);
      groups[subject] = list;
    }
    return groups;
  }, [resultsData]);

  const summaryBySubject = useMemo(() => {
    const list = resultsData?.subjectSummary ?? resultsData?.summary ?? resultsData?.subjects;
    if (!list) return new Map<string, SubjectSummaryItem>();
    return new Map(list.map((s) => [s.subjectName, s]));
  }, [resultsData]);

  if (error) {
    return (
      <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm flex items-center gap-2" role="alert">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
        <button
          type="button"
          onClick={() => load()}
          aria-label={tCommon('refresh')}
          className="min-h-[44px] flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" /> {tCommon('refresh')}
        </button>
      </div>
    );
  }

  if (loading || !home) {
    return (
      <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">
        <div className="h-24 animate-pulse bg-slate-100 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-20 animate-pulse bg-slate-100 rounded-2xl" />
          <div className="h-20 animate-pulse bg-slate-100 rounded-2xl" />
          <div className="h-20 animate-pulse bg-slate-100 rounded-2xl" />
        </div>
        <div className="h-64 animate-pulse bg-slate-100 rounded-2xl" />
      </div>
    );
  }

  const { profile, placement, today, announcements, attendance: att, widgets } = home;

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'today', label: tStudent('today'), icon: Clock },
    { key: 'timetable', label: tStudent('timetable'), icon: Calendar },
    { key: 'subjects', label: tStudent('mySubjects'), icon: BookOpen },
    { key: 'grades', label: tStudent('grades'), icon: Award },
    { key: 'exams', label: tStudent('exams'), icon: CalendarCheck },
    { key: 'homework', label: tStudent('homework'), icon: ClipboardList },
    { key: 'reportCards', label: tStudent('reportCards'), icon: FileText },
    { key: 'attendance', label: tStudent('myAttendance'), icon: CheckCircle2 },
  ];

  const studentName = profile?.name ?? tStudent('studentDefault');
  const placementText = placement ? ` — ${placement.name}${placement.medium ? ` (${placement.medium})` : ''}` : '';

  const renderTabError = () => (
    <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <div>
        <h3 className="text-base font-bold text-slate-800">{tStudent('errorTab')}</h3>
        <p className="text-xs text-slate-500 mt-1">{tCommon('error')}</p>
      </div>
      <button
        type="button"
        onClick={() => load()}
        className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition cursor-pointer"
      >
        <RefreshCw className="w-4 h-4" />
        <span>{tStudent('retry')}</span>
      </button>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{tStudent('portalTitle')}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {tStudent('portalSubtitle', { name: `${studentName}${placementText}` })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          aria-label={tCommon('refresh')}
          className="min-h-[44px] flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition cursor-pointer self-stretch sm:self-auto justify-center"
        >
          <RefreshCw className="w-4 h-4" /> {tCommon('refresh')}
        </button>
      </div>

      {/* Primary widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center shrink-0">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-900">{widgets.classesToday}</p>
            <p className="text-xs font-semibold text-slate-500">{tStudent('classesToday')}</p>
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] text-[#17A673] flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-900">{widgets.mySubjects}</p>
            <p className="text-xs font-semibold text-slate-500">{tStudent('subjectsProgram')}</p>
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E4EDFD] text-[#2487B8] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-900">{att.total}</p>
            <p className="text-xs font-semibold text-slate-500">{tStudent('attendancePoints')}</p>
          </div>
        </div>
      </div>

      {/* Today's status alert */}
      {home.todayStatus && (
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FBF0E4] text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {tStudent('todayStatusLabel')}{' '}
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[home.todayStatus] ?? 'text-slate-600'}`}>
                {getStatusLabel(home.todayStatus)}
              </span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{tStudent('todayStatusSub')}</p>
          </div>
        </div>
      )}

      {/* Tabs bar */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto pb-px">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={isActive}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-colors whitespace-nowrap min-h-[44px] cursor-pointer ${
                isActive
                  ? 'text-[#0066FF] border-b-2 border-[#0066FF] bg-blue-50/50'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: AUJOURD'HUI */}
      {tab === 'today' && (
        <div className="space-y-6">
          {/* 3 Compact Overview Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Next Exam */}
            <button
              type="button"
              onClick={() => setTab('exams')}
              className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-start gap-3 text-start hover:border-[#0066FF] hover:shadow-md transition-all min-h-[44px] cursor-pointer group w-full"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-slate-500">{tStudent('nextExamTitle')}</p>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0066FF] group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform" />
                </div>
                {(() => {
                  const nextExam = examsData?.upcoming?.[0];
                  if (!nextExam) {
                    return <p className="text-sm text-slate-400 mt-1">{tStudent('noUpcomingExam')}</p>;
                  }
                  const seat = nextExam.seat?.seatNumber ?? nextExam.seatNumber;
                  return (
                    <div className="mt-1">
                      <p className="text-sm font-bold text-slate-900 truncate">{nextExam.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {nextExam.subject ?? '—'}
                        {nextExam.hall ? ` · ${nextExam.hall}` : ''}
                        {seat ? ` · ${tStudent('seatNumber', { seat })}` : ''}
                      </p>
                      <p className="text-xs font-medium text-indigo-600 mt-1">
                        {formatTimeRange(nextExam.startTime, nextExam.endTime)}
                      </p>
                    </div>
                  );
                })()}
              </div>
            </button>

            {/* Card 2: Latest Published Grade */}
            <button
              type="button"
              onClick={() => setTab('grades')}
              className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-start gap-3 text-start hover:border-[#0066FF] hover:shadow-md transition-all min-h-[44px] cursor-pointer group w-full"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Award className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-slate-500">{tStudent('latestGradeTitle')}</p>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0066FF] group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform" />
                </div>
                {(() => {
                  const latestGrade = resultsData?.results?.[0];
                  if (!latestGrade) {
                    return <p className="text-sm text-slate-400 mt-1">{tStudent('noPublishedGrade')}</p>;
                  }
                  const subj = latestGrade.subjectName ?? latestGrade.subject ?? '—';
                  const title = latestGrade.title ?? latestGrade.assessmentPlanName ?? latestGrade.criteriaName ?? 'Évaluation';
                  const max = latestGrade.maximumScore ?? latestGrade.scoreOutOf ?? 20;
                  return (
                    <div className="mt-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900 truncate">{subj}</p>
                        <span className="text-sm font-extrabold text-[#17A673]">
                          {latestGrade.status === 'exempted'
                            ? tStudent('statusExempted')
                            : latestGrade.status === 'absent'
                            ? tStudent('statusAbsent')
                            : `${latestGrade.score} / ${max}`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{title}</p>
                    </div>
                  );
                })()}
              </div>
            </button>

            {/* Card 3: Homework Due Next */}
            <button
              type="button"
              onClick={() => setTab('homework')}
              className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-start gap-3 text-start hover:border-[#0066FF] hover:shadow-md transition-all min-h-[44px] cursor-pointer group w-full"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-slate-500">{tStudent('nextHomeworkTitle')}</p>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0066FF] group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform" />
                </div>
                {(() => {
                  const nextHw = homeworkData?.find((hw) => {
                    const isSubmitted = hw.submission
                      ? hw.submission.status === 'submitted' || hw.submission.status === 'graded'
                      : hw.submissionStatus === 'submitted' || hw.submissionStatus === 'graded';
                    return !isSubmitted;
                  });
                  if (!nextHw) {
                    return <p className="text-sm text-slate-400 mt-1">{tStudent('noPendingHomework')}</p>;
                  }
                  const due = nextHw.closeAt || nextHw.dueDate;
                  return (
                    <div className="mt-1">
                      <p className="text-sm font-bold text-slate-900 truncate">{nextHw.title}</p>
                      {nextHw.subjectName && <p className="text-xs text-slate-500 mt-0.5 truncate">{nextHw.subjectName}</p>}
                      {due && (
                        <p className="text-xs font-medium text-emerald-700 mt-1">
                          {tStudent('dueAt', { date: formatDate(due) })}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0066FF]" />
                <h2 className="font-semibold text-slate-900">{tStudent('todaySessions')}</h2>
              </div>
              {today.length === 0 ? (
                <p className="px-5 py-8 text-sm text-slate-500">{tStudent('noSessionsToday')}</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {today.map((s, i) => (
                    <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-[#0066FF]">{s.startTime}–{s.endTime}</span>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{s.teacher ?? tStudent('teacherDefault')}</p>
                          <p className="text-xs text-slate-500">{s.room ?? '—'}</p>
                        </div>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-slate-300 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-[#0066FF]" />
                  <h2 className="font-semibold text-slate-900">{tStudent('announcements')}</h2>
                </div>
                {announcements.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-slate-500">{tStudent('noAnnouncements')}</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {announcements.map((a) => (
                      <div key={a.id} className="px-5 py-3">
                        <p className="text-sm font-semibold text-slate-800">{a.title}</p>
                        <p className="text-xs text-slate-500 line-clamp-2">{a.body}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <School className="w-4 h-4 text-[#0066FF]" />
                  <h2 className="font-semibold text-slate-900">{tStudent('myClass')}</h2>
                </div>
                <div className="px-5 py-3">
                  <p className="text-sm font-semibold text-slate-800">{placement?.name ?? tStudent('unassigned')}</p>
                  <p className="text-xs text-slate-500">{placement?.medium ?? '—'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EMPLOI DU TEMPS */}
      {tab === 'timetable' && (
        tabErrors.timetable ? renderTabError() : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(timetable?.days ?? []).map((d) => (
              <div key={d.day} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-900">{getDayLabel(d.day)}</h2>
                </div>
                {d.slots.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-slate-400">—</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {d.slots.map((s, i) => (
                      <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{s.teacher ?? tStudent('teacherDefault')}</p>
                          <p className="text-xs text-slate-500">{s.room ?? '—'}</p>
                        </div>
                        <span className="font-mono text-xs font-bold text-slate-600">{s.startTime}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* TAB 3: MATIÈRES */}
      {tab === 'subjects' && (
        tabErrors.subjects ? renderTabError() : (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#0066FF]" />
              <h2 className="font-semibold text-slate-900">{tStudent('subjectsCurriculum')}</h2>
            </div>
            {(subjectsData?.subjects ?? []).length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">{tStudent('noSubjectsAssigned')}</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {(subjectsData?.subjects ?? []).map((s, i) => (
                  <div key={i} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-slate-900">{s.subjectName}</p>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                            {tStudent('coefficient', { coef: s.coefficient })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{s.teacherName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#0066FF]">
                        {s.provisionalAverage20 !== null
                          ? tStudent('provisionalAverage', { avg: s.provisionalAverage20 })
                          : tStudent('noGradeYet')}
                      </span>
                      {s.openHomework > 0 && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                          {tStudent('openHomeworkCount', { count: s.openHomework })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {/* TAB 4: NOTES */}
      {tab === 'grades' && (
        tabErrors.grades ? renderTabError() : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-[#0066FF]" />
                <span>{tStudent('gradesTitle')}</span>
              </h2>
            </div>

            {Object.keys(groupedResults).length === 0 ? (
              <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
                <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">{tStudent('noGradesPublished')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedResults).map(([subject, list]) => {
                  const summary = summaryBySubject.get(subject);
                  return (
                    <div key={subject} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                      <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{subject}</h3>
                          {summary && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-600">
                              {tStudent('coefficient', { coef: summary.coefficient })}
                            </span>
                          )}
                        </div>
                        {summary && summary.provisionalAverage20 !== null && (
                          <span className="text-xs font-bold text-[#0066FF] bg-blue-50 px-2.5 py-1 rounded-full self-start sm:self-auto">
                            {tStudent('provisionalAverage', { avg: summary.provisionalAverage20 })}
                          </span>
                        )}
                      </div>

                      <div className="divide-y divide-slate-100">
                        {list.map((r, rIdx) => {
                          const max = r.maximumScore ?? r.scoreOutOf ?? 20;
                          const title = r.title ?? r.assessmentPlanName ?? r.criteriaName ?? 'Évaluation';
                          const subLabel = r.criteriaName ?? r.type ?? '';
                          const dateVal = r.gradedAt || r.date || r.publishedAt;
                          return (
                            <div key={r.assessmentId ?? r.assessmentResultId ?? rIdx} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-slate-800">{title}</p>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                                  {subLabel && <span>{subLabel}</span>}
                                  {dateVal && (
                                    <>
                                      {subLabel && <span>·</span>}
                                      <span>{formatDate(dateVal)}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 self-start sm:self-auto">
                                {r.status === 'exempted' ? (
                                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700">
                                    {tStudent('statusExempted')}
                                  </span>
                                ) : r.status === 'absent' ? (
                                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700">
                                    {tStudent('statusAbsent')}
                                  </span>
                                ) : (
                                  <div className="text-end">
                                    <span className="text-sm font-extrabold text-slate-900">
                                      {r.score !== null ? `${r.score} / ${max}` : '—'}
                                    </span>
                                    {r.normalizedScore20 !== null && max !== 20 && (
                                      <span className="text-xs text-slate-500 ms-1.5 font-medium">
                                        ({r.normalizedScore20} / 20)
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      )}

      {/* TAB 5: EXAMENS */}
      {tab === 'exams' && (
        tabErrors.exams ? renderTabError() : (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-[#0066FF]" />
              <span>{tStudent('examsTitle')}</span>
            </h2>

            {/* Upcoming exams */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0066FF]" />
                <h3 className="font-semibold text-slate-900 text-sm">{tStudent('upcomingExams')}</h3>
              </div>
              {(examsData?.upcoming ?? []).length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-500">{tStudent('noUpcomingExams')}</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {examsData!.upcoming.map((s) => {
                    const seat = s.seat?.seatNumber ?? s.seatNumber;
                    const desk = s.seat?.deskLabel ?? s.deskNumber;
                    const cand = s.seat?.candidateNumber ?? s.candidateNumber;
                    return (
                      <div key={s.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-900">{s.title}</p>
                            {s.subject && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                                {s.subject}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-slate-500 mt-1">
                            {formatTimeRange(s.startTime, s.endTime)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          {s.hall && (
                            <span className="px-2.5 py-1 bg-slate-100 rounded-lg font-medium">
                              {tStudent('hall', { hall: s.hall })}
                            </span>
                          )}
                          {seat && (
                            <span className="px-2.5 py-1 bg-blue-50 text-[#0066FF] rounded-lg font-bold">
                              {tStudent('seatNumber', { seat })}
                            </span>
                          )}
                          {desk && (
                            <span className="px-2.5 py-1 bg-slate-100 rounded-lg">
                              {tStudent('desk', { desk })}
                            </span>
                          )}
                          {cand && (
                            <span className="px-2.5 py-1 bg-slate-100 rounded-lg">
                              {tStudent('candidateNumber', { cand })}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Online exams */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-[#0066FF]" />
                <h3 className="font-semibold text-slate-900 text-sm">{tStudent('onlineExams')}</h3>
              </div>
              {(examsData?.onlineExams ?? []).length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-500">{tStudent('noOnlineExams')}</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {examsData!.onlineExams.map((oe) => {
                    const duration = oe.durationMinutes ?? oe.duration;
                    return (
                      <div key={oe.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-900">{oe.title}</p>
                            {oe.subject && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                                {oe.subject}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                            {duration && <span>{tStudent('duration', { min: duration })}</span>}
                            {oe.totalMarks && <span>· {tStudent('marks', { marks: oe.totalMarks })}</span>}
                          </div>
                        </div>
                        <div className="self-start sm:self-auto">
                          {oe.isOpen ? (
                            <a
                              href={oe.takeUrl}
                              className="min-h-[44px] px-4 py-2 bg-[#0066FF] hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition"
                            >
                              <span>{tStudent('startExam')}</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : oe.isExpired ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                              {tStudent('examExpired')}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                              {tStudent('examNotOpen')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Past exams */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <h3 className="font-semibold text-slate-900 text-sm">{tStudent('pastExams')}</h3>
              </div>
              {(examsData?.past ?? []).length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-500">{tStudent('noPastExams')}</p>
              ) : (
                <div className="divide-y divide-slate-100 opacity-80">
                  {examsData!.past.map((s) => (
                    <div key={s.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{s.title}</p>
                        <p className="text-xs text-slate-500">{s.subject ? `${s.subject} · ` : ''}{formatTimeRange(s.startTime, s.endTime)}</p>
                      </div>
                      {s.hall && (
                        <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded self-start sm:self-auto">
                          {tStudent('hall', { hall: s.hall })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* TAB 6: DEVOIRS */}
      {tab === 'homework' && (
        tabErrors.homework ? renderTabError() : (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#0066FF]" />
              <span>{tStudent('homeworkTitle')}</span>
            </h2>

            {(homeworkData ?? []).length === 0 ? (
              <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
                <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">{tStudent('noHomework')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {homeworkData!.map((hw) => {
                  const isSubmitted = hw.submission
                    ? hw.submission.status === 'submitted' || hw.submission.status === 'graded'
                    : hw.submissionStatus === 'submitted' || hw.submissionStatus === 'graded';
                  const due = hw.closeAt || hw.dueDate;
                  const isOverdue = hw.isOverdue ?? (due && !isSubmitted ? new Date(due).getTime() < Date.now() : false);
                  const max = hw.maximumScore ?? hw.maxScore;
                  const score = hw.submission?.score ?? hw.score;
                  return (
                    <div key={hw.id} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {hw.subjectName && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                              {hw.subjectName}
                            </span>
                          )}
                          {hw.teacherName && <span className="text-xs text-slate-500">{hw.teacherName}</span>}
                        </div>
                        <div className="self-start sm:self-auto">
                          {isSubmitted ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#DDF5EC] text-[#17A673]">
                              {tStudent('statusSubmitted')}
                            </span>
                          ) : isOverdue ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700">
                              {tStudent('statusOverdue')}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700">
                              {tStudent('statusPending')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-slate-900">{hw.title}</h3>
                        {hw.description && (
                          <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{hw.description}</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                        <span className="font-medium text-slate-500">
                          {due ? tStudent('dueAt', { date: formatDate(due) }) : '—'}
                        </span>
                        {max !== undefined && max !== null && (
                          <span className="font-semibold text-slate-700">
                            {score !== null && score !== undefined ? `${score} / ${max}` : `${max} pts`}
                          </span>
                        )}
                      </div>

                      {hw.attachments && hw.attachments.length > 0 && (
                        <div className="pt-2">
                          <p className="text-xs font-semibold text-slate-500 mb-1">{tStudent('attachments')}</p>
                          <div className="flex flex-wrap gap-2">
                            {hw.attachments.map((attItem, idx) => (
                              <a
                                key={idx}
                                href={attItem.url}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-[#0066FF] flex items-center gap-1.5 transition"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>{attItem.name}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      )}

      {/* TAB 7: BULLETINS */}
      {tab === 'reportCards' && (
        tabErrors.reportCards ? renderTabError() : (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#0066FF]" />
              <span>{tStudent('reportCardsTitle')}</span>
            </h2>

            {downloadError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2" role="alert">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{downloadError}</span>
              </div>
            )}

            {(reportCardsData ?? []).length === 0 ? (
              <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">{tStudent('noReportCards')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {reportCardsData!.map((rc) => {
                  const avg = rc.generalAverage20 ?? rc.generalAverage;
                  const year = rc.academicYear || rc.schoolYear;
                  return (
                    <div key={rc.id} className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col justify-between gap-5">
                      <div>
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">{rc.termLabel}</h3>
                            {year && <p className="text-xs text-slate-500 mt-0.5">{year}</p>}
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#0066FF]">
                            {tStudent('issuedOn', { date: formatDate(rc.issuedDate) })}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-4">
                          <div className="p-3 bg-slate-50 rounded-xl">
                            <p className="text-xs text-slate-500 font-medium">{tStudent('generalAverageLabel', { avg: '' }).replace(/:.*$/, '').trim()}</p>
                            <p className="text-xl font-extrabold text-[#0066FF] mt-0.5">
                              {avg !== null && avg !== undefined ? `${avg} / 20` : '—'}
                            </p>
                          </div>
                          {rc.rank !== null && rc.classSize !== null && (
                            <div className="p-3 bg-slate-50 rounded-xl">
                              <p className="text-xs text-slate-500 font-medium">{tStudent('rankLabel', { rank: '', total: '' }).replace(/:.*$/, '').trim()}</p>
                              <p className="text-xl font-extrabold text-slate-800 mt-0.5">
                                {rc.rank} / {rc.classSize}
                              </p>
                            </div>
                          )}
                          {rc.mention && (
                            <div className="p-3 bg-slate-50 rounded-xl">
                              <p className="text-xs text-slate-500 font-medium">{tStudent('mentionLabel', { mention: '' }).replace(/:.*$/, '').trim()}</p>
                              <p className="text-sm font-bold text-slate-800 mt-0.5">{rc.mention}</p>
                            </div>
                          )}
                          {rc.decision && (
                            <div className="p-3 bg-slate-50 rounded-xl">
                              <p className="text-xs text-slate-500 font-medium">{tStudent('decisionLabel', { decision: '' }).replace(/:.*$/, '').trim()}</p>
                              <p className="text-sm font-bold text-emerald-700 mt-0.5">{rc.decision}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(rc.id, rc.termLabel)}
                        disabled={downloadingId === rc.id}
                        className="min-h-[44px] w-full px-4 py-2.5 bg-[#0066FF] text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
                      >
                        {downloadingId === rc.id ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>{tStudent('downloadingPdf')}</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            <span>{tStudent('downloadPdf')}</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      )}

      {/* TAB 8: PRÉSENCES */}
      {tab === 'attendance' && (
        tabErrors.attendance ? renderTabError() : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#0066FF]" />
                <h2 className="font-semibold text-slate-900">{tStudent('attendanceHistory')}</h2>
              </div>
              {(attendanceData?.records ?? []).length === 0 ? (
                <p className="px-5 py-8 text-sm text-slate-500">{tStudent('noAttendanceRecorded')}</p>
              ) : (
                <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                  {(attendanceData?.records ?? []).map((r, i) => (
                    <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-800">{r.date}</span>
                        {r.period > 1 && <span className="text-xs text-slate-400">{tStudent('periodNumber', { period: r.period })}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {r.note && <span className="text-xs text-slate-400 italic">{r.note}</span>}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[r.status] ?? 'text-slate-600 bg-slate-100'}`}>
                          {getStatusLabel(r.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden self-start">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#0066FF]" />
                <h2 className="font-semibold text-slate-900">{tStudent('summary')}</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {(['present', 'absent', 'late', 'excused'] as const).map((k) => (
                  <div key={k} className="px-5 py-3 flex items-center justify-between">
                    <span className="text-sm text-slate-600">{getStatusLabel(k)}</span>
                    <span className="text-sm font-bold text-slate-800">{attendanceData?.summary?.[k] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
