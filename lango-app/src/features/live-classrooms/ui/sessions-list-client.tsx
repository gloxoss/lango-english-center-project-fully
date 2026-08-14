'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, RefreshCw, Video, Users, Calendar, AlertTriangle, Search, VideoOff, MonitorPlay } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  getSessions, errorMessage, type LiveSessionRow,
} from '../data/api';

const STATUS_STYLES: Record<string, { variant: 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'signal'; label: string }> = {
  draft: { variant: 'neutral', label: 'Brouillon' },
  scheduled: { variant: 'info', label: 'Planifiée' },
  waiting: { variant: 'warning', label: 'Salle prête' },
  live: { variant: 'success', label: 'En direct' },
  ended: { variant: 'neutral', label: 'Terminée' },
  cancelled: { variant: 'danger', label: 'Annulée' },
  failed: { variant: 'danger', label: 'Échec' },
  expired: { variant: 'neutral', label: 'Expirée' },
};

export function SessionsListClient({ locale }: { locale: string }) {
  const [rows, setRows] = useState<LiveSessionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { page: '1', pageSize: '100' };
      if (status) params.status = status;
      const data = await getSessions(params);
      setRows(data.rows);
      setTotal(data.total);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const filtered = query
    ? rows.filter(r => (r.title ?? '').toLowerCase().includes(query.toLowerCase())
      || (r.teacherName ?? '').toLowerCase().includes(query.toLowerCase())
      || (r.className ?? '').toLowerCase().includes(query.toLowerCase()))
    : rows;

  const liveCount = rows.filter(r => r.status === 'live').length;
  const scheduledCount = rows.filter(r => r.status === 'scheduled' || r.status === 'waiting').length;

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Classes virtuelles en direct</h1>
          <p className="text-xs text-slate-500 mt-1">Planifiez, animez et suivez les sessions virtuelles de l'établissement.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#16212B] shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </button>
          <Link
            href={`/${locale}/dashboard/academics/live-class/new`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#2487B8] px-3 text-xs font-bold text-white shadow-sm hover:bg-[#1B6C93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2"
          >
            <Plus className="h-3.5 w-3.5" /> Nouvelle session
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">En direct</p>
            <p className="text-xl font-extrabold text-[#16212B]">{loading ? '…' : liveCount}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Planifiées / en attente</p>
            <p className="text-xl font-extrabold text-[#16212B]">{loading ? '…' : scheduledCount}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 shrink-0 flex items-center justify-center text-[#2487B8]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">Total des sessions</p>
            <p className="text-xl font-extrabold text-[#16212B]">{loading ? '…' : total}</p>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher par titre, enseignant, classe…"
            className="w-full h-9 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-medium text-[#16212B] placeholder:text-slate-400 focus:border-[#2487B8] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/20"
          />
        </div>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#16212B] focus:border-[#2487B8] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/20"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_STYLES).map(([key, s]) => (
            <option key={key} value={key}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs font-semibold text-slate-400">Chargement des sessions…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <MonitorPlay className="mx-auto w-10 h-10 text-slate-300" />
            <p className="text-sm font-bold text-[#16212B]">Aucune session</p>
            <p className="text-xs text-slate-500">Planifiez une première classe virtuelle pour commencer.</p>
            <Link
              href={`/${locale}/dashboard/academics/live-class/new`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#2487B8] px-3 text-xs font-bold text-white hover:bg-[#1B6C93] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2"
            >
              <Plus className="h-3.5 w-3.5" /> Créer une session
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-extrabold text-slate-400 uppercase">
                  <th className="py-2.5 px-4">Session</th>
                  <th className="py-2.5 px-3">Enseignant</th>
                  <th className="py-2.5 px-3">Classe</th>
                  <th className="py-2.5 px-3">Matière</th>
                  <th className="py-2.5 px-3">Planifié</th>
                  <th className="py-2.5 px-3 text-center">Statut</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.map((r) => {
                  const st = STATUS_STYLES[r.status] ?? { variant: 'neutral', label: r.status };
                  const start = new Date(r.scheduledStart).toLocaleString('fr-FR', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  });
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4">
                        <Link href={`/${locale}/dashboard/academics/live-class/${r.id}`} className="font-bold text-[#16212B] hover:text-[#2487B8] text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2 rounded">
                          {r.title}
                        </Link>
                        <p className="text-[10px] text-slate-400 mt-0.5">{r.providerType === 'dev' ? 'Fournisseur de développement' : (r.profileName ?? '—')}</p>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">{r.teacherName ?? '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                        {r.className ? `${r.className}${r.sectionName ? ` · ${r.sectionName}` : ''}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">{r.subjectName ?? '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">{start}</td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/${locale}/dashboard/academics/live-class/${r.id}`}
                            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[10px] font-bold text-[#16212B] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2"
                          >
                            Ouvrir
                          </Link>
                          {r.status === 'live' && (
                            <Link
                              href={`/${locale}/dashboard/academics/live-class/${r.id}`}
                              className="inline-flex h-7 items-center gap-1 rounded-lg bg-rose-600 px-2 text-[10px] font-bold text-white hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2487B8] focus-visible:ring-offset-2"
                            >
                              <VideoOff className="w-3 h-3" /> Terminer
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
