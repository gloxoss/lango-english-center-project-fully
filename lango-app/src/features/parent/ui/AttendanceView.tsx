'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarCheck2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ParentPageShell, type ParentPageShellContext } from './ParentPageShell';

type AttendanceRow = {
  date: string;
  status: string;
  lateMinutes: number | null;
  subjectId: string | null;
};

type AttendanceData = {
  summary: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    sessions: number;
    rate: number;
  } | null;
  today: AttendanceRow[];
  recent: AttendanceRow[];
};

const STATUS_STYLE: Record<string, string> = {
  present: 'bg-emerald-50 text-emerald-700',
  absent: 'bg-red-50 text-red-700',
  late: 'bg-amber-50 text-amber-700',
  excused: 'bg-sky-50 text-sky-700',
  unexcused: 'bg-red-50 text-red-700',
};

export function AttendanceView() {
  const tParent = useTranslations('Parent');
  return (
    <ParentPageShell
      title={tParent('attendanceTitle')}
      subtitle={tParent('attendanceSubtitle')}
      icon={<CalendarCheck2 className="w-6 h-6" />}
    >
      <AttendanceContent />
    </ParentPageShell>
  );
}

function AttendanceContent({ relationshipId, loading: shellLoading }: Partial<ParentPageShellContext>) {
  const tParent = useTranslations('Parent');
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const getStatusLabel = (status: string) => {
    const key = status.toLowerCase();
    switch (key) {
      case 'present': return tParent('present');
      case 'absent': return tParent('absent');
      case 'late': return tParent('late');
      case 'excused': return tParent('excused');
      case 'unexcused': return tParent('unexcused');
      default: return status;
    }
  };

  const load = useCallback(async (rid: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/guardian/me/children/${encodeURIComponent(rid)}/attendance`);
      const json = await res.json();
      if (json.success) {
        setData(json.data as AttendanceData);
      } else {
        setError(json.error?.message ?? tParent('errorLoadAttendance'));
      }
    } catch {
      setError(tParent('errorConnect'));
    } finally {
      setLoading(false);
    }
  }, [tParent]);

  useEffect(() => {
    if (relationshipId) load(relationshipId);
  }, [relationshipId, load]);

  const submitExcuse = useCallback(async () => {
    if (!relationshipId || !form.date || form.reason.trim().length < 3) return;
    setSubmitting(true);
    setFlash(null);
    try {
      const res = await fetch(`/api/guardian/me/children/${encodeURIComponent(relationshipId)}/excuses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: form.date, reason: form.reason }),
      });
      const json = await res.json();
      if (json.success) {
        setForm((f) => ({ ...f, reason: '' }));
        setFlash(tParent('excuseSubmitted'));
      } else {
        setFlash(json.error?.message ?? tParent('excuseFailed'));
      }
    } catch {
      setFlash(tParent('errorConnect'));
    } finally {
      setSubmitting(false);
    }
  }, [relationshipId, form.date, form.reason, tParent]);

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {(loading || shellLoading) && !data ? (
        <div className="h-40 animate-pulse bg-slate-100 rounded-xl" />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              [tParent('attendanceRate'), data.summary ? `${data.summary.rate}%` : '—'],
              [tParent('sessions'), data.summary?.sessions ?? 0],
              [tParent('present'), data.summary?.present ?? 0],
              [tParent('absent'), data.summary?.absent ?? 0],
              [tParent('late'), data.summary?.late ?? 0],
              [tParent('excused'), data.summary?.excused ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{tParent('recentHistory')}</h2>
            </div>
            {data.recent.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">{tParent('noSessionsRecorded')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-start">
                    <tr>
                      <th className="px-5 py-3 font-medium">{tParent('date')}</th>
                      <th className="px-5 py-3 font-medium">{tParent('status')}</th>
                      <th className="px-5 py-3 font-medium">{tParent('late')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recent.map((row, i) => (
                      <tr key={i}>
                        <td className="px-5 py-3">{new Date(row.date).toLocaleDateString()}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[row.status] ?? 'bg-slate-100 text-slate-700'}`}>
                            {getStatusLabel(row.status)}
                          </span>
                        </td>
                        <td className="px-5 py-3">{row.lateMinutes ? tParent('delayMinutes', { minutes: row.lateMinutes }) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">{tParent('justifyAbsenceTitle')}</h2>
            <p className="text-sm text-slate-500 mt-1">{tParent('justifyAbsenceDesc')}</p>
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-500 font-medium">{tParent('date')}</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm flex-1">
                <span className="text-slate-500 font-medium">{tParent('reason')}</span>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder={tParent('reasonPlaceholder')}
                  rows={2}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={submitExcuse}
                  disabled={submitting || !relationshipId}
                  className="px-4 py-2 bg-[#0066FF] text-white rounded-lg text-sm font-medium hover:bg-[#0052CC] transition disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? tParent('submitting') : tParent('submit')}
                </button>
              </div>
            </div>
            {flash && (
              <div className={`mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${flash === tParent('excuseSubmitted') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`} role="status">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{flash}</span>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
