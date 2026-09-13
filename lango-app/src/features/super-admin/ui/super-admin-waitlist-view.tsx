'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
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

const STATUS_STYLES: Record<WaitlistEntry['status'], string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-amber-100 text-amber-800',
  converted: 'bg-emerald-100 text-emerald-800',
  dismissed: 'bg-slate-100 text-slate-500',
};

export function SuperAdminWaitlistView({ locale: propLocale }: { locale?: string }) {
  const t = useTranslations('SuperAdmin');
  const tCommon = useTranslations('Common');
  const hookLocale = useLocale();
  const locale = propLocale || hookLocale || 'fr';

  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, new: 0, contacted: 0, converted: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | WaitlistEntry['status']>('all');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const statusLabels: Record<WaitlistEntry['status'], string> = {
    new: t('statusNew'),
    contacted: t('statusContacted'),
    converted: t('statusConverted'),
    dismissed: t('statusDismissed'),
  };

  const studentCountLabels: Record<string, string> = {
    'under-200': locale === 'ar' ? 'أقل من 200' : locale === 'en' ? 'Under 200' : 'Moins de 200',
    '200-600': '200–600',
    'over-600': '600+',
  };

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
        setError(json.message ?? t('waitlistLoadError'));
      }
    } catch {
      setError(t('waitlistConnError'));
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, t]);

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
      else setError(json.message ?? t('waitlistUpdateFailed'));
    } catch {
      setError(t('waitlistConnError'));
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
        setResult(json.message ?? t('waitlistSchoolCreated'));
        await load();
      } else {
        setError(json.message ?? t('waitlistConvertFailed'));
      }
    } catch {
      setError(t('waitlistConnError'));
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
      header: t('schoolCol'),
      cell: (e) => (
        <div>
          <p className="font-bold text-[#0F172A]">{e.schoolName}</p>
          <p className="text-[10px] text-slate-400">{e.city ?? '—'}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      header: t('contactCol'),
      cell: (e) => (
        <div>
          <p className="text-xs font-semibold text-[#0F172A]">{e.contactName}</p>
          <p className="text-[10px] text-slate-400">{e.email || e.phone || '—'}</p>
        </div>
      ),
    },
    {
      key: 'students',
      header: t('studentsCol'),
      cell: (e) => (
        <span className="text-xs font-bold text-[#0F172A]">
          {e.studentCount ? studentCountLabels[e.studentCount] ?? e.studentCount : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: tCommon('status'),
      cell: (e) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLES[e.status]}`}>
          {statusLabels[e.status]}
        </span>
      ),
    },
    {
      key: 'date',
      header: t('receivedAtCol'),
      cell: (e) => (
        <span className="text-xs text-slate-500">
          {new Date(e.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: tCommon('actions'),
      cell: (e) => {
        const busy = busyId === e.id;
        return (
          <div className="flex items-center gap-1">
            {e.status === 'new' && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => updateStatus(e.id, 'contacted')}
                className="h-7 text-[10px] font-bold rounded-lg border-slate-200"
              >
                {t('actionContact')}
              </Button>
            )}
            {e.status !== 'converted' && e.status !== 'dismissed' && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => convert(e.id)}
                className="h-7 text-[10px] font-bold rounded-lg bg-[#0066FF] hover:bg-[#0052CC] text-white"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : t('actionConvert')}
              </Button>
            )}
            {e.status !== 'converted' && e.status !== 'dismissed' && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => updateStatus(e.id, 'dismissed')}
                className="h-7 text-[10px] font-bold rounded-lg text-slate-400"
              >
                {t('actionDismiss')}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const statusTabs: { key: 'all' | WaitlistEntry['status']; label: string }[] = [
    { key: 'all', label: t('tabAll') },
    { key: 'new', label: t('tabNew') },
    { key: 'contacted', label: t('tabContacted') },
    { key: 'converted', label: t('tabConverted') },
    { key: 'dismissed', label: t('tabDismissed') },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">{t('waitlistTitle')}</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">{t('waitlistSubtitle')}</p>
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
          <p className="text-xs font-bold text-slate-500">{t('totalRequests')}</p>
          <p className="text-2xl font-extrabold text-[#0F172A] tracking-tight">{counts.total}</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-xs font-bold text-slate-500">{t('tabNew')}</p>
          <p className="text-2xl font-extrabold text-blue-600 tracking-tight">{counts.new}</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-xs font-bold text-slate-500">{t('tabContacted')}</p>
          <p className="text-2xl font-extrabold text-amber-600 tracking-tight">{counts.contacted}</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <p className="text-xs font-bold text-slate-500">{t('tabConverted')}</p>
          <p className="text-2xl font-extrabold text-emerald-600 tracking-tight">{counts.converted}</p>
        </Card>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={t('searchWaitlist')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 rtl:pl-3 rtl:pr-9 h-9 text-xs bg-slate-50 border-none rounded-xl"
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {statusTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                  statusFilter === tab.key
                    ? 'bg-[#0066FF] text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
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
          emptyTitle={t('emptyWaitlistTitle')}
          emptyDescription={t('emptyWaitlistDesc')}
          defaultPageSize={10}
        />
      </div>
    </div>
  );
}
