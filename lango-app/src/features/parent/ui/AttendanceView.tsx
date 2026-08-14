'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarCheck2, AlertTriangle, CheckCircle2 } from 'lucide-react';
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

const STATUS_LABEL: Record<string, string> = {
  present: 'Présent',
  absent: 'Absent',
  late: 'En retard',
  excused: 'Justifié',
  unexcused: 'Non justifié',
};

const STATUS_STYLE: Record<string, string> = {
  present: 'bg-emerald-50 text-emerald-700',
  absent: 'bg-red-50 text-red-700',
  late: 'bg-amber-50 text-amber-700',
  excused: 'bg-sky-50 text-sky-700',
  unexcused: 'bg-red-50 text-red-700',
};

export function AttendanceView() {
  return (
    <ParentPageShell
      title="Présence"
      subtitle="Assiduité et demandes de justification de votre enfant."
      icon={<CalendarCheck2 className="w-6 h-6" />}
    >
      <AttendanceContent />
    </ParentPageShell>
  );
}

function AttendanceContent({ relationshipId, loading: shellLoading }: Partial<ParentPageShellContext>) {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async (rid: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/guardian/me/children/${encodeURIComponent(rid)}/attendance`);
      const json = await res.json();
      if (json.success) {
        setData(json.data as AttendanceData);
      } else {
        setError(json.error?.message ?? 'Erreur lors du chargement de la présence.');
      }
    } catch {
      setError('Impossible de se connecter au serveur.');
    } finally {
      setLoading(false);
    }
  }, []);

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
        setFlash('Demande de justification soumise.');
      } else {
        setFlash(json.error?.message ?? "Erreur lors de l'envoi.");
      }
    } catch {
      setFlash('Impossible de se connecter au serveur.');
    } finally {
      setSubmitting(false);
    }
  }, [relationshipId, form.date, form.reason]);

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
              ['Taux de présence', data.summary ? `${data.summary.rate}%` : '—'],
              ['Séances', data.summary?.sessions ?? 0],
              ['Présences', data.summary?.present ?? 0],
              ['Absences', data.summary?.absent ?? 0],
              ['Retards', data.summary?.late ?? 0],
              ['Justifiées', data.summary?.excused ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Historique récent</h2>
            </div>
            {data.recent.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">Aucune séance enregistrée.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-left">
                    <tr>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">Statut</th>
                      <th className="px-5 py-3 font-medium">Retard</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.recent.map((row, i) => (
                      <tr key={i}>
                        <td className="px-5 py-3">{new Date(row.date).toLocaleDateString('fr-FR')}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[row.status] ?? 'bg-slate-100 text-slate-700'}`}>
                            {STATUS_LABEL[row.status] ?? row.status}
                          </span>
                        </td>
                        <td className="px-5 py-3">{row.lateMinutes ? `${row.lateMinutes} min` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">Justifier une absence / un retard</h2>
            <p className="text-sm text-slate-500 mt-1">La demande sera transmise à l'établissement pour validation.</p>
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-500 font-medium">Date</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm flex-1">
                <span className="text-slate-500 font-medium">Motif</span>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="Raison de l'absence / du retard (3 caractères min.)"
                  rows={2}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={submitExcuse}
                  disabled={submitting || !relationshipId}
                  className="px-4 py-2 bg-[#0066FF] text-white rounded-lg text-sm font-medium hover:bg-[#0052CC] transition disabled:opacity-50"
                >
                  {submitting ? 'Envoi…' : 'Envoyer'}
                </button>
              </div>
            </div>
            {flash && (
              <div className={`mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${flash.includes('soumise') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`} role="status">
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
