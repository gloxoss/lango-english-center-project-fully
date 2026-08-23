'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { DataTable, Column } from '@/components/shared/data-table';

type WaitlistEntry = {
  id: string;
  schoolName: string;
  contactName: string;
  city: string | null;
  studentCount: string | null;
  phone: string | null;
  email: string | null;
  status: 'new' | 'contacted' | 'converted' | 'dismissed';
  notes: string | null;
  convertedTenantId: string | null;
  createdAt: string;
};

type Counts = { total: number; new: number; contacted: number; converted: number };

const STATUS_LABELS: Record<WaitlistEntry['status'], string> = {
  new: 'Nouvelle',
  contacted: 'Contactée',
  converted: 'Convertie',
  dismissed: 'Ignorée',
};

const STATUS_STYLES: Record<WaitlistEntry['status'], string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-amber-100 text-amber-800',
  converted: 'bg-emerald-100 text-emerald-800',
  dismissed: 'bg-slate-100 text-slate-500',
};

const STUDENT_COUNT_LABELS: Record<string, string> = {
  'under-200': 'Moins de 200',
  '200-600': '200–600',
  'over-600': '600+',
};

export function SuperAdminWaitlistView() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, new: 0, contacted: 0, converted: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | WaitlistEntry['status']>('all');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const qs = new URLSearchParams();
    if (statusFilter !== 'all') qs.set('status', statusFilter);
    try {
      const res = await fetch(`/api/super-admin/waitlist?${qs.toString()}`);
      const json = await res.json();
      if (json.success) {
        setEntries(json.data);
        setCounts(json.counts ?? { total: json.data.length, new: 0, contacted: 0, converted: 0 });
      } else {
        setError(json.message ?? 'Erreur de chargement.');
      }
    } catch {
      setError('Connexion impossible.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: WaitlistEntry['status']) => {
    setBusyId(id);
    setResult(null);
    try {
      const res = await fetch(`/api/super-admin/waitlist?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.success) await load();
      else setError(json.message ?? 'Échec de la mise à jour.');
    } catch {
      setError('Connexion impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const convert = async (id: string) => {
    setBusyId(id);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/waitlist/convert?id=${id}`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setResult(json.message ?? 'École créée.');
        await load();
      } else {
        setError(json.message ?? 'Échec de la conversion.');
      }
    } catch {
      setError('Connexion impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = entries.filter(e =>
    (e.schoolName ?? '').toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
    (e.contactName ?? '').toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
    (e.city ?? '').toLowerCase().includes(searchTerm.trim().toLowerCase()),
  );

  const columns: Column<WaitlistEntry>[] = [
    {
      key: 'school',
      header: 'École',
      cell: (e) => (
        <div>
          <p className="font-bold text-[#0F172A]">{e.schoolName}</p>
          <p className="text-[10px] text-slate-400">{e.city ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      cell: (e) => (
        <div>
          <p className="text-xs font-semibold text-[#0F172A]">{e.contactName}</p>
          <p className="text-[10px] text-slate-400">{e.email || e.phone || '—'}</p>
        </div>
      ),
    },
    {
      key: 'students',
      header: 'Élèves',
      cell: (e) => <span className="text-xs font-bold text-[#0F172A]">{e.studentCount ? STUDENT_COUNT_LABELS[e.studentCount] ?? e.studentCount : '—'}</span>,
    },
    {
      key: 'status',
      header: 'Statut',
      cell: (e) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLES[e.status]}`}>
          {STATUS_LABELS[e.status]}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Reçue le',
      cell: (e) => <span className="text-xs text-slate-500">{new Date(e.createdAt).toLocaleDateString('fr-FR')}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (e) => {
        const busy = busyId === e.id;
        return (
          <div className="flex items-center gap-1">
            {e.status === 'new' && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => updateStatus(e.id, 'contacted')} className="h-7 text-[10px] font-bold rounded-lg border-slate-200">
                Contacter
              </Button>
            )}
            {e.status !== 'converted' && e.status !== 'dismissed' && (
              <Button size="sm" disabled={busy} onClick={() => convert(e.id)} className="h-7 text-[10px] font-bold rounded-lg bg-[#0066FF] hover:bg-[#0052CC] text-white">
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Convertir'}
              </Button>
            )}
            {e.status !== 'converted' && e.status !== 'dismissed' && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => updateStatus(e.id, 'dismissed')} className="h-7 text-[10px] font-bold rounded-lg text-slate-400">
                Ignorer
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const statusTabs: { key: 'all' | WaitlistEntry['status']; label: string }[] = [
    { key: 'all', label: 'Toutes' },
    { key: 'new', label: 'Nouvelles' },
    { key: 'contacted', label: 'Contactées' },
    { key: 'converted', label: 'Converties' },
    { key: 'dismissed', label: 'Ignorées' },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Liste d&apos;accès prioritaire</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Écoles ayant demandé un accès anticipé à la plateforme.</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {result && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{result}</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-xs font-bold text-slate-500">Total des demandes</p>
          <p className="text-2xl font-extrabold text-[#0F172A] tracking-tight">{counts.total}</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-xs font-bold text-slate-500">Nouvelles</p>
          <p className="text-2xl font-extrabold text-blue-600 tracking-tight">{counts.new}</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-xs font-bold text-slate-500">Contactées</p>
          <p className="text-2xl font-extrabold text-amber-600 tracking-tight">{counts.contacted}</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-xs font-bold text-slate-500">Converties</p>
          <p className="text-2xl font-extrabold text-emerald-600 tracking-tight">{counts.converted}</p>
        </Card>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Rechercher une école ou un contact..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9 text-xs bg-slate-50 border-none rounded-xl" />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {statusTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${statusFilter === tab.key ? 'bg-[#0066FF] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <DataTable
          data={filtered}
          columns={columns}
          isLoading={isLoading}
          emptyTitle="Aucune demande"
          emptyDescription="Aucune école n'a encore demandé un accès anticipé."
          defaultPageSize={10}
        />
      </div>
    </div>
  );
}
