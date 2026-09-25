'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, ArrowUpRight, AlertCircle } from 'lucide-react';
import { DataTable, Column } from '@/components/shared/data-table';
import { exportToCsv } from '@/libs/csv-export';

type ApiSchool = { id: string; name: string; slug: string; planTier: string; subscriptionStatus: string; isActive: boolean; userCount: number };

type StatusFilter = 'all' | 'active' | 'suspended' | 'cancelled';

function normalizeStatus(value?: string): StatusFilter {
  if (value === 'active' || value === 'suspended' || value === 'cancelled') return value;
  return 'all';
}

export function SuperAdminSchoolsView({ locale, initialStatus }: { locale: string; initialStatus?: string }) {
  const t = useTranslations('SuperAdmin');
  const tCommon = useTranslations('Common');

  const [schools, setSchools] = useState<ApiSchool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(normalizeStatus(initialStatus));
  const [error, setError] = useState<string | null>(null);

  const planLabels: Record<string, string> = {
    trial: t('planLimitsTitle') ? (locale === 'ar' ? 'تجريبي' : locale === 'en' ? 'Trial' : 'Essai') : 'Trial',
    basic: locale === 'ar' ? 'أساسي' : locale === 'en' ? 'Basic' : 'Basique',
    standard: locale === 'ar' ? 'قياسي' : 'Standard',
    premium: locale === 'ar' ? 'مميز' : 'Premium',
  };

  const statusLabels: Record<string, string> = {
    active: t('statusActive'),
    suspended: t('statusSuspended'),
    cancelled: t('statusCancelled'),
  };

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/super-admin/schools')
      .then(r => r.json())
      .then((json) => { if (json.success) setSchools(json.data); else setError(json.message); })
      .catch(err => { console.error('Failed loading schools', err); setError(tCommon('error')); })
      .finally(() => setIsLoading(false));
  }, [tCommon]);

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
      header: t('schoolCol'),
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
      header: t('planCol'),
      cell: (school) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
          {planLabels[school.planTier] ?? school.planTier}
        </span>
      ),
    },
    {
      key: 'userCount',
      header: t('usersCol'),
      cell: (school) => <span className="font-bold text-[#0F172A]">{school.userCount}</span>,
    },
    {
      key: 'status',
      header: t('statusCol'),
      cell: (school) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${!school.isActive || school.subscriptionStatus !== 'active' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
          {!school.isActive ? t('statusDeactivated') : statusLabels[school.subscriptionStatus] ?? school.subscriptionStatus}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('actionsCol'),
      cell: (school) => (
        <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0">
          <Link href={`/${locale}/dashboard/super-admin/schools/${school.id}`}>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#0066FF]" />
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">{t('clientSchoolsTitle')}</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">{t('clientSchoolsSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToCsv(filtered, 'ecoles-clientes')} className="gap-2 text-xs font-bold h-9 rounded-xl border-slate-200">
            {t('exportCsv')}
          </Button>
          <Button asChild className="bg-[#0066FF] hover:bg-[#0052CC] text-white gap-2 text-xs font-bold h-9 rounded-xl">
            <Link href={`/${locale}/dashboard/super-admin/schools/create`}>
              <Plus className="w-3.5 h-3.5" />
              <span>{t('newSchool')}</span>
            </Link>
          </Button>
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
          <p className="text-xs font-bold text-slate-500">{t('totalSchools')}</p>
          <p className="text-2xl font-extrabold text-[#0F172A] tracking-tight">{schools.length}</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-xs font-bold text-slate-500">{t('activeSubscriptions')}</p>
          <p className="text-2xl font-extrabold text-emerald-600 tracking-tight">{activeCount}</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-xs font-bold text-slate-500">{t('suspendedInactive')}</p>
          <p className="text-2xl font-extrabold text-rose-600 tracking-tight">{suspendedCount}</p>
        </Card>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input placeholder={t('searchSchools')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9 text-xs bg-slate-50 border-none rounded-xl" />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="h-9 px-3 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium"
          >
            <option value="all">{t('filterAll')}</option>
            <option value="active">{t('filterActive')}</option>
            <option value="suspended">{t('filterSuspended')}</option>
            <option value="cancelled">{t('filterCancelled')}</option>
          </select>
        </div>

        <DataTable
          data={filtered}
          columns={columns}
          isLoading={isLoading}
          emptyTitle={t('noSchoolsFound')}
          emptyDescription={t('noSchoolsFound')}
          defaultPageSize={10}
        />
      </div>
    </div>
  );
}
