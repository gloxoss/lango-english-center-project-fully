'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, ArrowUpRight, AlertCircle } from 'lucide-react';
import { DataTable, Column } from '@/components/shared/data-table';
import { exportToCsv } from '@/libs/csv-export';

type ApiSchool = { id: string; name: string; slug: string; planTier: string; subscriptionStatus: string; isActive: boolean; userCount: number };

const PLAN_LABELS: Record<string, string> = { trial: 'Essai', basic: 'Basique', standard: 'Standard', premium: 'Premium' };
const STATUS_LABELS: Record<string, string> = { active: 'Actif', suspended: 'Suspendu', cancelled: 'Annulé' };

type StatusFilter = 'all' | 'active' | 'suspended' | 'cancelled';

function normalizeStatus(value?: string): StatusFilter {
  if (value === 'active' || value === 'suspended' || value === 'cancelled') return value;
  return 'all';
}

export function SuperAdminSchoolsView({ locale, initialStatus }: { locale: string; initialStatus?: string }) {
  const [schools, setSchools] = useState<ApiSchool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(normalizeStatus(initialStatus));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/super-admin/schools')
      .then(r => r.json())
      .then((json) => { if (json.success) setSchools(json.data); else setError(json.message); })
      .catch(err => { console.error('Failed loading schools', err); setError('Connexion impossible.'); })
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = schools.filter(s => {
    const matchSearch = (s.name ?? '').toLowerCase().includes(searchTerm.trim().toLowerCase());
    const matchStatus = statusFilter === 'all' || s.subscriptionStatus === statusFilter;
    return matchSearch && matchStatus;
  });
  const activeCount = schools.filter(s => s.subscriptionStatus === 'active' && s.isActive).length;
  const suspendedCount = schools.filter(s => s.subscriptionStatus === 'suspended' || s.subscriptionStatus === 'cancelled' || !s.isActive).length;

  const columns: Column<ApiSchool>[] = [
    {
      key: 'name',
      header: 'École',
      cell: (school) => (
        <div>
          <Link href={`/${locale}/dashboard/super-admin/schools/${school.id}`} className="font-bold text-[#0F172A] hover:text-[#0066FF]">
            {school.name}
          </Link>
          <p className="text-[10px] text-slate-400 font-mono">{school.slug}</p>
        </div>
      ),
    },
    {
      key: 'planTier',
      header: 'Plan',
      cell: (school) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
          {PLAN_LABELS[school.planTier] ?? school.planTier}
        </span>
      ),
    },
    {
      key: 'userCount',
      header: 'Utilisateurs',
      cell: (school) => <span className="font-bold text-[#0F172A]">{school.userCount}</span>,
    },
    {
      key: 'status',
      header: 'Statut',
      cell: (school) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${!school.isActive || school.subscriptionStatus !== 'active' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
          {!school.isActive ? 'Désactivée' : STATUS_LABELS[school.subscriptionStatus] ?? school.subscriptionStatus}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (school) => (
        <Link href={`/${locale}/dashboard/super-admin/schools/${school.id}`}>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <ArrowUpRight className="w-3.5 h-3.5 text-[#0066FF]" />
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">Écoles Clientes</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Gérez toutes les écoles de la plateforme.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToCsv(filtered, 'ecoles-clientes')} className="gap-2 text-xs font-bold h-9 rounded-xl border-slate-200">
            Exporter CSV
          </Button>
          <Link href={`/${locale}/dashboard/super-admin/schools/create`}>
            <Button className="bg-[#0066FF] hover:bg-[#0052CC] text-white gap-2 text-xs font-bold h-9 rounded-xl">
              <Plus className="w-3.5 h-3.5" />
              <span>Nouvelle école</span>
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-xs font-bold text-slate-500">Total des écoles</p>
          <p className="text-2xl font-extrabold text-[#0F172A] tracking-tight">{schools.length}</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-xs font-bold text-slate-500">Abonnements actifs</p>
          <p className="text-2xl font-extrabold text-emerald-600 tracking-tight">{activeCount}</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-xs font-bold text-slate-500">Suspendues / inactives</p>
          <p className="text-2xl font-extrabold text-rose-600 tracking-tight">{suspendedCount}</p>
        </Card>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Rechercher une école..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9 text-xs bg-slate-50 border-none rounded-xl" />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actives</option>
            <option value="suspended">Suspendues</option>
            <option value="cancelled">Annulées</option>
          </select>
        </div>

        <DataTable
          data={filtered}
          columns={columns}
          isLoading={isLoading}
          emptyTitle="Aucune école trouvée"
          emptyDescription="Aucune école ne correspond à vos critères."
          defaultPageSize={10}
        />
      </div>
    </div>
  );
}
