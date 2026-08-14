'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Activity, LogIn, XCircle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { DataTable, Column } from '@/components/shared/data-table';
import { exportToCsv } from '@/libs/csv-export';

type LoginEventItem = {
  id: string;
  email: string | null;
  userId: string | null;
  method: string;
  success: boolean;
  failureReason: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

type ApiResponse = {
  success: boolean;
  rows: LoginEventItem[];
  total: number;
  summary: { total: number; failed: number; success: number };
  page: number;
  limit: number;
};

function describeDevice(userAgent: string | null): string {
  if (!userAgent) return '—';
  const ua = userAgent.toLowerCase();
  const browser = /edg\//.test(ua) ? 'Edge' : /opr\//.test(ua) ? 'Opera' : /firefox/.test(ua) ? 'Firefox' : /safari/.test(ua) ? 'Safari' : /chrome/.test(ua) ? 'Chrome' : 'Navigateur';
  const os = /windows/.test(ua) ? 'Windows' : /mac os|macintosh/.test(ua) ? 'macOS' : /android/.test(ua) ? 'Android' : /iphone|ipad/.test(ua) ? 'iOS' : /linux/.test(ua) ? 'Linux' : '';
  return [browser, os].filter(Boolean).join(' · ');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

export function LoginEventsView() {
  const [rows, setRows] = useState<LoginEventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ total: 0, failed: 0, success: 0 });
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (statusFilter !== 'all') params.set('success', statusFilter === 'success' ? 'true' : 'false');
    try {
      const res = await fetch(`/api/settings/security/login-events?${params}`);
      const json: ApiResponse = await res.json();
      if (json.success) {
        setRows(json.rows);
        setTotal(json.total);
        setSummary(json.summary);
      } else {
        setError((json as { message?: string }).message ?? 'Erreur lors du chargement.');
      }
    } catch {
      setError('Connexion impossible. Vérifiez votre réseau.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const successRate = summary.total > 0 ? Math.round((summary.success / summary.total) * 100) : 0;
  const selected = rows.find(r => r.id === selectedId) ?? null;

  const columns: Column<LoginEventItem>[] = [
    {
      key: 'createdAt',
      header: 'Date et heure',
      cell: (e) => <span className="font-mono text-[11px] text-slate-500">{formatDate(e.createdAt)}</span>,
    },
    {
      key: 'email',
      header: 'Utilisateur',
      cell: (e) => <span className="font-bold text-[#16212B]">{e.email ?? e.userId ?? '—'}</span>,
    },
    {
      key: 'method',
      header: 'Méthode',
      cell: (e) => <span className="uppercase text-[10px] font-bold text-slate-400">{e.method}</span>,
    },
    {
      key: 'success',
      header: 'Statut',
      cell: (e) => e.success
        ? <Badge className="bg-emerald-100 text-emerald-800">Réussie</Badge>
        : <Badge className="bg-rose-100 text-rose-800">Échouée</Badge>,
    },
    {
      key: 'ip',
      header: 'Adresse IP',
      cell: (e) => <span className="text-slate-500 font-mono text-[11px]">{e.ip ?? '—'}</span>,
    },
    {
      key: 'userAgent',
      header: 'Appareil',
      cell: (e) => <span className="text-slate-500">{describeDevice(e.userAgent)}</span>,
    },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Journal de connexion</h1>
          <p className="text-xs text-slate-500 mt-1">
            Toutes les tentatives d&apos;authentification email/mot de passe — réussites et échecs — attribuées à l&apos;établissement.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => exportToCsv(rows, 'journal-connexion-export')} className="gap-2 h-9 rounded-full px-4 text-xs font-bold border-slate-200">
          Exporter CSV
        </Button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">Tentatives enregistrées</p>
            <p className="text-2xl font-extrabold text-[#16212B]">{summary.total}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">Échecs</p>
            <p className="text-2xl font-extrabold text-rose-600">{summary.failed}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
            <XCircle className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400">Taux de réussite</p>
            <p className="text-2xl font-extrabold text-emerald-600">{successRate}%</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <LogIn className="w-5 h-5" />
          </div>
        </Card>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-2xs border border-slate-200/80 flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as 'all' | 'success' | 'failed'); setPage(1); }}>
          <SelectTrigger className="w-[180px] rounded-full h-9 bg-white">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="success">Réussies</SelectItem>
            <SelectItem value="failed">Échouées</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 rounded-full px-3" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-4 h-4" /> Précédent
          </Button>
          <span className="text-xs font-bold text-slate-500">Page {page} / {totalPages}</span>
          <Button variant="outline" size="sm" className="h-9 rounded-full px-3" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Suivant <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        <div className="lg:col-span-2">
          <DataTable
            data={rows}
            columns={columns}
            isLoading={isLoading}
            emptyTitle="Aucune connexion enregistrée"
            emptyDescription="Les tentatives de connexion apparaîtront ici dès qu'un utilisateur se connecte."
            defaultPageSize={limit}
            selectedRowId={selectedId}
            onRowClick={(row) => setSelectedId(row.id)}
          />
        </div>

        <div className="space-y-4">
          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-[#16212B]">Détail de l&apos;événement</h3>
              {selected && (
                <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
              )}
            </div>

            {!selected && <p className="text-slate-400">Sélectionnez une ligne pour voir le détail.</p>}

            {selected && (
              <div className="space-y-2 font-medium">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Date et heure</span>
                  <span className="font-mono text-slate-700">{formatDate(selected.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Utilisateur</span>
                  <span className="font-bold text-[#16212B]">{selected.email ?? selected.userId ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Statut</span>
                  <span className={selected.success ? 'font-bold text-emerald-700' : 'font-bold text-rose-700'}>
                    {selected.success ? 'Réussie' : 'Échouée'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Méthode</span>
                  <span className="font-bold text-slate-800 uppercase">{selected.method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Adresse IP</span>
                  <span className="font-mono text-slate-700">{selected.ip ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold">Appareil</span>
                  <span className="text-slate-700">{describeDevice(selected.userAgent)}</span>
                </div>
                {selected.failureReason && (
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-rose-700">
                    <p className="font-sans font-bold text-[10px] uppercase mb-1">Motif</p>
                    <p className="font-mono text-[11px]">{selected.failureReason}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
