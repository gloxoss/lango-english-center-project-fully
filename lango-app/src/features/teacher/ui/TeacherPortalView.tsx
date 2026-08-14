'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  GraduationCap,
  RefreshCw,
  Users,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';

type HomeData = {
  profile: { name: string; email: string } | null;
  today: { startTime: string; endTime: string; group: string; room: string }[];
  classes: { classSectionId: string; name: string; subjects: string[]; students: number }[];
  widgets: { classesToday: number; myClasses: number; students: number };
};

type TimetableData = { days: { day: string; slots: { startTime: string; endTime: string; group: string; room: string }[] }[] };
type ClassesData = { classes: { classSectionId: string; name: string; subjects: string[]; students: string[] }[] };

const DAY_LABELS: Record<string, string> = {
  sunday: 'Dimanche',
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
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

export function TeacherPortalView() {
  const [home, setHome] = useState<HomeData | null>(null);
  const [timetable, setTimetable] = useState<TimetableData | null>(null);
  const [classesData, setClassesData] = useState<ClassesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'today' | 'timetable' | 'classes'>('today');

  const load = useCallback(async () => {
    setError(null);
    const [h, t, c] = await Promise.all([
      getJson<HomeData>('/api/teacher/me/home'),
      getJson<TimetableData>('/api/teacher/me/timetable'),
      getJson<ClassesData>('/api/teacher/me/classes'),
    ]);
    if (!h) {
      setError('Impossible de charger vos données.');
      return;
    }
    setHome(h);
    setTimetable(t);
    setClassesData(c);
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

  const { profile, today, classes: myClasses, widgets } = home;

  const tabs = [
    { key: 'today' as const, label: 'Aujourd’hui', icon: Clock },
    { key: 'timetable' as const, label: 'Emploi du temps', icon: Calendar },
    { key: 'classes' as const, label: 'Mes classes', icon: GraduationCap },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Espace Enseignant</h1>
          <p className="text-sm text-slate-500">{profile?.name ?? 'Enseignant'} — vos classes, votre emploi du temps et vos présences au même endroit.</p>
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
            <p className="text-2xl font-extrabold text-slate-900">{widgets.myClasses}</p>
            <p className="text-xs font-semibold text-slate-500">classe(s) assignée(s)</p>
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E4EDFD] text-[#2487B8] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-slate-900">{widgets.students}</p>
            <p className="text-xs font-semibold text-slate-500">élève(s) au total</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors cursor-pointer ${
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
                        <p className="text-sm font-semibold text-slate-800">{s.group}</p>
                        <p className="text-xs text-slate-500">{s.room}</p>
                      </div>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-slate-300" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[#0066FF]" />
              <h2 className="font-semibold text-slate-900">Mes classes</h2>
            </div>
            {myClasses.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">Aucune classe assignée.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {myClasses.map((c) => (
                  <div key={c.classSectionId} className="px-5 py-3">
                    <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-500">
                      {c.subjects.join(' · ') || '—'} · {c.students} élève(s)
                    </p>
                  </div>
                ))}
              </div>
            )}
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
                        <p className="text-sm font-semibold text-slate-800">{s.group}</p>
                        <p className="text-xs text-slate-500">{s.room}</p>
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

      {tab === 'classes' && (
        <div className="space-y-6">
          {(classesData?.classes ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">Aucune classe assignée.</p>
          ) : (
            (classesData?.classes ?? []).map((c) => (
              <div key={c.classSectionId} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-900">{c.name}</h2>
                    <p className="text-xs text-slate-500">{c.subjects.join(' · ') || '—'}</p>
                  </div>
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" /> {c.students.length} élève(s)
                  </span>
                </div>
                {c.students.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-slate-400">Aucun élève inscrit.</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {c.students.map((name, i) => (
                      <div key={i} className="px-5 py-2 text-sm text-slate-700">{name}</div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
