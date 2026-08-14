'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Download, AlertTriangle, Video, Users, Clock, CircleCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getReportOverview, errorMessage } from '../data/api';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', scheduled: 'Planifiée', waiting: 'Salle prête', live: 'En direct',
  ended: 'Terminée', cancelled: 'Annulée', failed: 'Échec', expired: 'Expirée',
};

export function ReportsClient() {
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getReportOverview>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<Array<Record<string, unknown>> | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (from) params.from = from;
      if (to) params.to = to;
      setOverview(await getReportOverview(params));
      const res = await fetch(`/api/addons/live-classrooms/reports/sessions${new URLSearchParams(params).toString() ? `?${new URLSearchParams(params).toString()}` : ''}`);
      const json = await res.json();
      setRows(json.success ? json.data : []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    window.location.href = `/api/addons/live-classrooms/reports/export${qs ? `?${qs}` : ''}`;
  };

  const presencePct = overview ? Math.round((overview.presenceRate ?? 0) * 100) : 0;

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Rapports des classes en direct</h1>
          <p className="text-xs text-slate-500 mt-1">Participation, ponctualité, fiabilité des sessions virtuelles.</p>
        </div>
        <button
          onClick={handleExport}
          disabled={loading}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#16212B] shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2"
        >
          <Download className="h-3.5 w-3.5 text-slate-400" /> Exporter CSV
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Date filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold text-slate-500">Du</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-[#16212B] focus:border-[#2487B8] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/20" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold text-slate-500">Au</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-[#16212B] focus:border-[#2487B8] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/20" />
        </div>
        <button
          onClick={loadOverview}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#16212B] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2"
        >
          Appliquer
        </button>
      </div>

      {/* 4 Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Sessions</p>
            <p className="text-xl font-extrabold text-[#16212B]">{loading ? '…' : (overview?.totalSessions ?? 0)}</p>
            <p className="text-[10px] font-semibold text-slate-400">{loading ? '' : `${overview?.endedSessions ?? 0} terminées`}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Présence moyenne</p>
            <p className="text-xl font-extrabold text-[#16212B]">{loading ? '…' : `${presencePct} %`}</p>
            <p className="text-[10px] font-semibold text-slate-400">{loading ? '' : `${overview?.sessionsWithAttendance ?? 0} avec présence`}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 shrink-0 flex items-center justify-center text-purple-700">
            <CircleCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Enregistrements prêts</p>
            <p className="text-xl font-extrabold text-[#16212B]">{loading ? '…' : (overview?.readyRecordings ?? 0)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 shrink-0 flex items-center justify-center text-amber-700">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Sessions en échec</p>
            <p className="text-xl font-extrabold text-[#16212B]">{loading ? '…' : (overview?.failedSessions ?? 0)}</p>
            <p className="text-[10px] font-semibold text-slate-400">{loading ? '' : `${overview?.cancelledSessions ?? 0} annulées`}</p>
          </div>
        </div>
      </div>

      {/* Per-session table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-[#16212B]">Rapport détaillé par session</h2>
          <span className="text-[10px] font-bold text-slate-400">{rows?.length ?? 0} sessions</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-extrabold text-slate-400 uppercase">
                <th className="py-2.5 px-4">Session</th>
                <th className="py-2.5 px-3">Enseignant</th>
                <th className="py-2.5 px-3 text-center">Invités</th>
                <th className="py-2.5 px-3 text-center">Connectés</th>
                <th className="py-2.5 px-3 text-center">Présents</th>
                <th className="py-2.5 px-3 text-center">Retards</th>
                <th className="py-2.5 px-3 text-center">Reconnexions</th>
                <th className="py-2.5 px-3 text-center">Enreg.</th>
                <th className="py-2.5 px-3 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr><td colSpan={9} className="py-8 text-center text-xs font-semibold text-slate-400">Chargement…</td></tr>
              ) : (rows ?? []).length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-xs font-semibold text-slate-400">Aucune session sur la période.</td></tr>
              ) : (
                rows!.map((r: Record<string, unknown>, idx) => (
                  <tr key={(r.id as string) ?? idx} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-bold text-[#16212B] text-[11px]">{String(r.title ?? '')}</td>
                    <td className="py-2.5 px-3 text-slate-600 text-[11px]">{String(r.teacherName ?? '—')}</td>
                    <td className="py-2.5 px-3 text-center text-slate-600">{String(r.invited ?? 0)}</td>
                    <td className="py-2.5 px-3 text-center text-slate-600">{String(r.joined ?? 0)}</td>
                    <td className="py-2.5 px-3 text-center font-extrabold text-emerald-700">{String(r.present ?? 0)}</td>
                    <td className="py-2.5 px-3 text-center text-slate-600">{String(r.late ?? 0)}</td>
                    <td className="py-2.5 px-3 text-center text-slate-600">{String(r.reconnects ?? 0)}</td>
                    <td className="py-2.5 px-3 text-center text-slate-600">{String(r.recordings ?? 0)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant="info">{STATUS_LABELS[String(r.status)] ?? String(r.status)}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
