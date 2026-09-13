'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/card';
import { DataTable, Column } from '@/components/shared/data-table';
import { AlertCircle, RefreshCw, FileBarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IncomeExpenseDonut } from '@/features/dashboard/ui/income-expense-donut';

type SchoolReport = {
  id: string;
  name: string;
  slug: string;
  planTier: string;
  subscriptionStatus: string;
  isActive: boolean;
  students: number;
  teachers: number;
  invoicesCount: number;
  invoiced: number;
  collected: number;
  outstanding: number;
  collectionRate: number | null;
};

type ReportTotals = {
  schools: number;
  activeSchools: number;
  students: number;
  teachers: number;
  invoices: number;
  invoiced: number;
  collected: number;
  outstanding: number;
  collectionRate: number | null;
};

type ReportsData = { generatedAt: string; totals: ReportTotals; schools: SchoolReport[] };

function fmtMad(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' MAD';
}

export function SuperAdminReportsView({ locale: propLocale }: { locale?: string } = {}) {
  const currentLocale = useLocale();
  const locale = propLocale || currentLocale;
  const t = useTranslations('SuperAdmin');
  const tCommon = useTranslations('Common');

  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const planLabels: Record<string, string> = {
    trial: locale === 'ar' ? 'تجريبي' : locale === 'en' ? 'Trial' : 'Essai',
    basic: locale === 'ar' ? 'أساسي' : locale === 'en' ? 'Basic' : 'Basique',
    standard: locale === 'ar' ? 'قياسي' : 'Standard',
    premium: locale === 'ar' ? 'مميز' : 'Premium',
  };

  useEffect(() => {
    setLoading(true);
    fetch('/api/super-admin/reports')
      .then(r => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
        else setError(json.message || (locale === 'ar' ? 'حدث خطأ أثناء تحميل البيانات.' : 'Erreur.'));
      })
      .catch(() => setError(locale === 'ar' ? 'تعذر الاتصال بالخادم.' : locale === 'en' ? 'Unable to connect.' : 'Connexion impossible.'))
      .finally(() => setLoading(false));
  }, [locale]);

  const totals = data?.totals;

  const columns: Column<SchoolReport>[] = [
    {
      key: 'name',
      header: t('institutionCol'),
      cell: s => (
        <div>
          <p className="text-xs font-bold text-[#0F172A]">{s.name}</p>
          <p className="text-[10px] text-slate-400 font-mono">{s.slug}</p>
        </div>
      ),
    },
    {
      key: 'plan',
      header: t('formulaCol'),
      cell: s => (
        <span className="text-xs font-bold text-[#0066FF]">
          {planLabels[s.planTier] ?? s.planTier}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('statusCol'),
      cell: s => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
          {s.isActive ? t('statusActiveSchool') : t('statusDisabledSchool')}
        </span>
      ),
    },
    {
      key: 'students',
      header: t('studentsKpi'),
      cell: s => <span className="text-xs font-semibold text-slate-700">{s.students}</span>,
    },
    {
      key: 'teachers',
      header: t('teachersKpi'),
      cell: s => <span className="text-xs text-slate-600">{s.teachers}</span>,
    },
    {
      key: 'invoices',
      header: t('invoicesKpi'),
      cell: s => <span className="text-xs text-slate-600">{s.invoicesCount}</span>,
    },
    {
      key: 'invoiced',
      header: t('invoicedCol'),
      cell: s => <span className="text-xs font-semibold text-slate-700">{fmtMad(s.invoiced)}</span>,
    },
    {
      key: 'collected',
      header: t('collectedCol'),
      cell: s => <span className="text-xs font-semibold text-emerald-700">{fmtMad(s.collected)}</span>,
    },
    {
      key: 'outstanding',
      header: t('outstandingCol'),
      cell: s => <span className="text-xs text-rose-600">{fmtMad(s.outstanding)}</span>,
    },
    {
      key: 'rate',
      header: t('collectionRateKpi'),
      cell: s => (
        <span className={`text-xs font-bold ${s.collectionRate == null ? 'text-slate-400' : s.collectionRate >= 90 ? 'text-emerald-600' : s.collectionRate >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
          {s.collectionRate == null ? '—' : `${s.collectionRate}%`}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">{t('platformReportsTitle')}</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">{t('platformReportsSubtitle')}</p>
        </div>
        {error && (
          <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="h-8 text-xs rounded-xl border-slate-200 gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> {tCommon('retry')}
          </Button>
        )}
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3 bg-white rounded-xl border border-slate-200/80 text-center">
          <p className="text-[10px] text-slate-400 font-medium">{t('schoolsKpi')}</p>
          <p className="text-lg font-extrabold text-[#0F172A]">{totals?.schools ?? 0}</p>
        </Card>
        <Card className="p-3 bg-white rounded-xl border border-slate-200/80 text-center">
          <p className="text-[10px] text-slate-400 font-medium">{t('activeSchoolsKpi')}</p>
          <p className="text-lg font-extrabold text-emerald-600">{totals?.activeSchools ?? 0}</p>
        </Card>
        <Card className="p-3 bg-white rounded-xl border border-slate-200/80 text-center">
          <p className="text-[10px] text-slate-400 font-medium">{t('studentsKpi')}</p>
          <p className="text-lg font-extrabold text-[#0F172A]">{totals?.students ?? 0}</p>
        </Card>
        <Card className="p-3 bg-white rounded-xl border border-slate-200/80 text-center">
          <p className="text-[10px] text-slate-400 font-medium">{t('teachersKpi')}</p>
          <p className="text-lg font-extrabold text-[#0F172A]">{totals?.teachers ?? 0}</p>
        </Card>
        <Card className="p-3 bg-white rounded-xl border border-slate-200/80 text-center">
          <p className="text-[10px] text-slate-400 font-medium">{t('invoicesKpi')}</p>
          <p className="text-lg font-extrabold text-[#0F172A]">{totals?.invoices ?? 0}</p>
        </Card>
        <Card className="p-3 bg-white rounded-xl border border-slate-200/80 text-center">
          <p className="text-[10px] text-slate-400 font-medium">{t('collectionRateKpi')}</p>
          <p className="text-lg font-extrabold text-[#0066FF]">{totals?.collectionRate == null ? '—' : `${totals.collectionRate}%`}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 min-h-[320px]">
          <IncomeExpenseDonut
            data={{ collected: totals?.collected ?? 0, remaining: totals?.outstanding ?? 0, invoiced: totals?.invoiced ?? 0 }}
            monthName={t('allSchoolsMonth')}
          />
        </div>
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 space-y-4">
          <div className="pb-3 border-b border-slate-100 flex items-center gap-2">
            <FileBarChart2 className="w-4 h-4 text-[#0066FF]" />
            <h3 className="text-sm font-extrabold text-[#0F172A]">{t('reportBySchool')}</h3>
          </div>
          <DataTable
            data={data?.schools ?? []}
            columns={columns}
            isLoading={loading}
            emptyTitle={t('emptySchoolsTitle')}
            emptyDescription={t('emptyReportsDesc')}
            defaultPageSize={10}
            exportFilename={locale === 'ar' ? 'تقارير-المنصة' : 'rapports-plateforme'}
          />
        </div>
      </div>
    </div>
  );
}

