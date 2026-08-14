'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
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
type SubjectsData = { subjects: { subjectName: string; teacherName: string }[] };
type AttendanceData = { records: { date: string; status: string; period: number; note: string | null }[]; summary: { present: number; absent: number; late: number; excused: number; total: number } };

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

export function StudentPortalView() {
  const [home, setHome] = useState<HomeData | null>(null);
  const [timetable, setTimetable] = useState<TimetableData | null>(null);
  const [subjectsData, setSubjectsData] = useState<SubjectsData | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'today' | 'timetable' | 'subjects' | 'attendance'>('today');

  const load = useCallback(async () => {
    setError(null);
    const [h, t, s, a] = await Promise.all([
      getJson<HomeData>('/api/student/me/home'),
      getJson<TimetableData>('/api/student/me/timetable'),
      getJson<SubjectsData>('/api/student/me/subjects'),
      getJson<AttendanceData>('/api/student/me/attendance'),
    ]);
    if (!h) {
      setError('Impossible de charger vos données.');
      return;
    }
    setHome(h);
    setTimetable(t);
    setSubjectsData(s);
    setAttendanceData(a);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
        >
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>
    );
  }

  if (!home) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="h-40 animate-pulse bg-slate-100 rounded-xl" />
      </div>
    );
  }

  const { profile, placement, today, subjects, announcements, attendance: att, widgets } = home;

  const tabs = [
    { key: 'today' as const, label: 'Aujourd’hui', icon: Clock },
    { key: 'timetable' as const, label: 'Emploi du temps', icon: Calendar },
    { key: 'subjects' as const, label: 'Mes matières', icon: BookOpen },
    { key: 'attendance' as const, label: 'Mes présences', icon: CheckCircle2 },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Espace Élève</h1>
          <p className="text-sm text-slate-500">
            {profile?.name ?? 'Élève'}
            {placement ? ` — ${placement.name}${placement.medium ? ` (${placement.medium})` : ''}` : ''} : votre journée, vos matières et vos présences au même endroit.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          aria-label="Actualiser"
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
        >
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {/* Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-900">{widgets.classesToday}</p>
            <p className="text-xs font-semibold text-slate-500">séance(s) aujourd’hui</p>
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] text-[#17A673] flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-900">{widgets.mySubjects}</p>
            <p className="text-xs font-semibold text-slate-500">matière(s) au programme</p>
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E4EDFD] text-[#2487B8] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-900">{att.total}</p>
            <p className="text-xs font-semibold text-slate-500">pointage(s) enregistré(s)</p>
          </div>
        </div>
      </div>

      {/* Today's status alert */}
      {home.todayStatus && (
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FBF0E4] text-amber-700 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              Aujourd’hui : <span className={STATUS_COLORS[home.todayStatus] ?? 'text-slate-600'}>{STATUS_LABELS[home.todayStatus] ?? home.todayStatus}</span>
            </p>
            <p className="text-xs text-slate-500">Votre dernier pointage du jour.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors whitespace-nowrap cursor-pointer ${
              tab === t.key ? 'text-[#0066FF] border-b-2 border-[#0066FF]' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'today' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#0066FF]" />
              <h2 className="font-semibold text-slate-900">Séances du jour</h2>
            </div>
            {today.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">Aucune séance prévue aujourd’hui.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {today.map((s, i) => (
                  <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-[#0066FF]">{s.startTime}–{s.endTime}</span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{s.teacher ?? 'Enseignant'}</p>
                        <p className="text-xs text-slate-500">{s.room ?? '—'}</p>
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-slate-300" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-[#0066FF]" />
                <h2 className="font-semibold text-slate-900">Annonces</h2>
              </div>
              {announcements.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-500">Aucune annonce publiée.</p>
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
                <h2 className="font-semibold text-slate-900">Ma classe</h2>
              </div>
              <div className="px-5 py-3">
                <p className="text-sm font-semibold text-slate-800">{placement?.name ?? 'Non assigné(e)'}</p>
                <p className="text-xs text-slate-500">{placement?.medium ?? '—'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'timetable' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(timetable?.days ?? []).map((d) => (
            <div key={d.day} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">{DAY_LABELS[d.day] ?? d.day}</h2>
              </div>
              {d.slots.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-400">—</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {d.slots.map((s, i) => (
                    <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{s.teacher ?? 'Enseignant'}</p>
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
      )}

      {tab === 'subjects' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#0066FF]" />
            <h2 className="font-semibold text-slate-900">Matières au programme</h2>
          </div>
          {(subjectsData?.subjects ?? []).length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">Aucune matière assignée à votre classe.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {(subjectsData?.subjects ?? []).map((s, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-semibold text-slate-800">{s.subjectName}</p>
                  </div>
                  <span className="text-xs text-slate-500">{s.teacherName}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'attendance' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#0066FF]" />
              <h2 className="font-semibold text-slate-900">Historique de présence</h2>
            </div>
            {(attendanceData?.records ?? []).length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">Aucun pointage enregistré.</p>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                {(attendanceData?.records ?? []).map((r, i) => (
                  <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-800">{r.date}</span>
                      {r.period > 1 && <span className="text-xs text-slate-400">période {r.period}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {r.note && <span className="text-xs text-slate-400 italic">{r.note}</span>}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[r.status] ?? 'text-slate-600 bg-slate-100'}`}>
                        {STATUS_LABELS[r.status] ?? r.status}
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
              <h2 className="font-semibold text-slate-900">Résumé</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {(['present', 'absent', 'late', 'excused'] as const).map((k) => (
                <div key={k} className="px-5 py-3 flex items-center justify-between">
                  <span className="text-sm text-slate-600">{STATUS_LABELS[k]}</span>
                  <span className="text-sm font-bold text-slate-800">{attendanceData?.summary?.[k] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
