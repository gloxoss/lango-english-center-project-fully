'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertCircle,
  RefreshCw,
  FileBarChart2,
  Download,
  School,
  GraduationCap,
  Users,
  Receipt,
  Banknote,
  Search,
  ChevronRight,
  TrendingUp,
  CreditCard,
  Building,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { IncomeExpenseDonut } from '@/features/dashboard/ui/income-expense-donut';
import { format } from 'date-fns';

type SchoolReport = {
  id: string;
  name: string;
  slug: string;
  planTier: string;
  subscriptionStatus: string;
  isActive: boolean;
  createdAt: string;
  students: number;
  teachers: number;
  parents: number;
  studentTeacherRatio: number;
  invoicesCount: number;
  invoiced: number;
  collected: number;
  outstanding: number;
  collectionRate: number | null;
};

type MonthlyTrend = {
  month: string;
  collected: number;
  count: number;
};

type PaymentMethodBreakdown = {
  method: string;
  label: string;
  amount: number;
  count: number;
  percentage: number;
};

type InvoiceStatusBreakdown = {
  status: string;
  label: string;
  amount: number;
  count: number;
};

type ReportTotals = {
  schools: number;
  activeSchools: number;
  students: number;
  teachers: number;
  parents: number;
  globalRatio: number;
  invoices: number;
  invoiced: number;
  collected: number;
  outstanding: number;
  collectionRate: number | null;
  averageFeePerStudent: number;
};

type ReportsData = {
  generatedAt: string;
  totals: ReportTotals;
  monthlyTrends: MonthlyTrend[];
  paymentMethods: PaymentMethodBreakdown[];
  invoiceStatuses: InvoiceStatusBreakdown[];
  planDistribution: Record<string, number>;
  schools: SchoolReport[];
};

export function SuperAdminReportsView({ locale: propLocale }: { locale?: string } = {}) {
  const currentLocale = useLocale();
  const locale = propLocale || currentLocale;
  const t = useTranslations('PlatformReports');
  const intlLocale = locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-FR';
  const fmtMad = (n: number) => `${n.toLocaleString(intlLocale, { maximumFractionDigits: 0 })} MAD`;

  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'default' | 'revenue' | 'students' | 'rate'>('default');

  // School Detail Modal
  const [activeSchool, setActiveSchool] = useState<SchoolReport | null>(null);

  const planLabels: Record<string, string> = {
    trial: t('plans.trial'),
    basic: t('plans.basic'),
    standard: t('plans.standard'),
    premium: t('plans.premium'),
  };

  const loadReports = () => {
    setLoading(true);
    setError(null);
    fetch('/api/super-admin/reports')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setData(json.data);
        } else {
          setError(json.message || t('loadError'));
        }
      })
      .catch(() => setError(t('connectError')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReports();
  }, []);

  const totals = data?.totals;

  // Filtered and sorted schools
  const filteredSchools = useMemo(() => {
    if (!data?.schools) return [];
    let result = data.schools.filter((s) => {
      const matchSearch =
        !search.trim() ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.slug.toLowerCase().includes(search.toLowerCase());
      const matchPlan = planFilter === 'all' || s.planTier === planFilter;
      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && s.isActive && s.subscriptionStatus === 'active') ||
        (statusFilter === 'trial' && s.planTier === 'trial') ||
        (statusFilter === 'suspended' && (!s.isActive || s.subscriptionStatus === 'suspended'));

      return matchSearch && matchPlan && matchStatus;
    });

    if (sortBy === 'revenue') {
      result = [...result].sort((a, b) => b.invoiced - a.invoiced);
    } else if (sortBy === 'students') {
      result = [...result].sort((a, b) => b.students - a.students);
    } else if (sortBy === 'rate') {
      result = [...result].sort((a, b) => (b.collectionRate || 0) - (a.collectionRate || 0));
    }

    return result;
  }, [data?.schools, search, planFilter, statusFilter, sortBy]);

  // Real CSV Export with UTF-8 BOM
  const handleExportCsv = () => {
    if (!data?.schools || data.schools.length === 0) return;

    const headers = (['school', 'slug', 'plan', 'status', 'students', 'teachers', 'parents', 'ratio', 'invoices', 'invoiced', 'collected', 'outstanding', 'rate'] as const)
      .map(key => t(`csv.${key}`));

    const rows = data.schools.map((s) => [
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.slug}"`,
      `"${planLabels[s.planTier] || s.planTier}"`,
      `"${s.isActive ? t('active') : t('inactive')}"`,
      s.students,
      s.teachers,
      s.parents,
      s.studentTeacherRatio,
      s.invoicesCount,
      s.invoiced,
      s.collected,
      s.outstanding,
      s.collectionRate != null ? `${s.collectionRate}%` : 'N/A',
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `schoolos_rapport_plateforme_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0066FF] shrink-0">
            <FileBarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
              {t('title')}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {t('subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            onClick={handleExportCsv}
            disabled={loading || !data?.schools?.length}
            size="sm"
            className="h-9 text-xs rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold gap-1.5 shadow-xs px-3.5"
          >
            <Download className="w-3.5 h-3.5" />
            {t('exportCsv')}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadReports}
            disabled={loading}
            className="h-9 text-xs rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 gap-1.5 px-3 font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0066FF]' : 'text-slate-600'}`} />
            {t('refresh')}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 6 Rich SchoolOS KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <Card className="p-3.5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-2 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('kpiSchools')}</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-[#0066FF]">
              <School className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#0F172A]">{totals?.schools ?? 0}</div>
          <p className="text-[11px] text-emerald-600 font-semibold">{t('kpiSchoolsActive', { count: totals?.activeSchools ?? 0 })}</p>
        </Card>

        <Card className="p-3.5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-2 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('kpiStudents')}</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#0F172A]">{totals?.students ?? 0}</div>
          <p className="text-[11px] text-slate-400 font-medium">{t('kpiRatio', { ratio: totals?.globalRatio ?? 0 })}</p>
        </Card>

        <Card className="p-3.5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-2 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('kpiTeachers')}</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#0F172A]">{totals?.teachers ?? 0}</div>
          <p className="text-[11px] text-slate-400 font-medium">{t('kpiTeachersHint')}</p>
        </Card>

        <Card className="p-3.5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-2 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('kpiInvoiced')}</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-[#0F172A]">{fmtMad(totals?.invoiced ?? 0)}</div>
          <p className="text-[11px] text-slate-400 font-medium">{t('kpiInvoicesCount', { count: totals?.invoices ?? 0 })}</p>
        </Card>

        <Card className="p-3.5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-2 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('kpiCollected')}</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-emerald-700">{fmtMad(totals?.collected ?? 0)}</div>
          <p className="text-[11px] text-emerald-600 font-bold">{t('kpiRate', { rate: totals?.collectionRate ?? 0 })}</p>
        </Card>

        <Card className="p-3.5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-2 hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('kpiOutstanding')}</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-rose-600">{fmtMad(totals?.outstanding ?? 0)}</div>
          <p className="text-[11px] text-slate-400 font-medium">{t('kpiOutstandingHint')}</p>
        </Card>
      </div>

      {/* Analytics Visualization Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Donut Chart (Collected vs Remaining) */}
        <div className="lg:col-span-4 min-h-[340px]">
          <IncomeExpenseDonut
            data={{
              collected: totals?.collected ?? 0,
              remaining: totals?.outstanding ?? 0,
              invoiced: totals?.invoiced ?? 0,
            }}
            monthName={t('donutLabel')}
          />
        </div>

        {/* Center: Monthly Trend Breakdown */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#0066FF]" />
                <h3 className="text-sm font-extrabold text-[#0F172A]">{t('trendTitle')}</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">{t('trendHint')}</span>
            </div>

            <div className="py-4 space-y-3">
              {data?.monthlyTrends && data.monthlyTrends.length > 0 ? (
                data.monthlyTrends.map((trend) => {
                  const maxAmt = Math.max(...data.monthlyTrends.map((t) => t.collected), 1);
                  const barWidth = Math.round((trend.collected / maxAmt) * 100);

                  return (
                    <div key={trend.month} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 font-mono">{trend.month}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-medium">{t('paymentsCount', { count: trend.count })}</span>
                          <span className="font-extrabold text-emerald-700">{fmtMad(trend.collected)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#0066FF] h-2 rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">{t('trendEmpty')}</div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span>{t('avgPerStudent')}</span>
            <span className="font-extrabold text-[#0F172A]">{t('perYear', { amount: fmtMad(totals?.averageFeePerStudent ?? 0) })}</span>
          </div>
        </div>

        {/* Right: Payment Methods Breakdown */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <CreditCard className="w-4 h-4 text-[#0066FF]" />
              <h3 className="text-sm font-extrabold text-[#0F172A]">{t('methodsTitle')}</h3>
            </div>

            <div className="py-4 space-y-3.5">
              {data?.paymentMethods && data.paymentMethods.length > 0 ? (
                data.paymentMethods.map((pm) => (
                  <div key={pm.method} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{pm.label}</span>
                      <span className="font-bold text-[#0F172A]">{pm.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full"
                        style={{ width: `${pm.percentage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{t('operationsCount', { count: pm.count })}</span>
                      <span>{fmtMad(pm.amount)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">{t('noData')}</div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 text-center">
            {t('methodsHint')}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-3.5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex flex-col md:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-slate-50/70 border-slate-200 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="h-9 px-3 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20 focus:border-[#0066FF]"
            >
              <option value="all">{t('allPlans')}</option>
              {(['trial', 'basic', 'standard', 'premium'] as const).map(p => <option key={p} value={p}>{planLabels[p]}</option>)}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20 focus:border-[#0066FF]"
            >
              <option value="all">{t('allStatuses')}</option>
              <option value="active">{t('statusActive')}</option>
              <option value="trial">{t('statusTrial')}</option>
              <option value="suspended">{t('statusSuspended')}</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-9 px-3 text-xs border border-slate-200 rounded-xl bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#0066FF]/20 focus:border-[#0066FF]"
            >
              <option value="default">{t('sortDefault')}</option>
              <option value="revenue">{t('sortRevenue')}</option>
              <option value="students">{t('sortStudents')}</option>
              <option value="rate">{t('sortRate')}</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Schools Directory Table */}
      <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 min-w-[240px]">{t('colSchool')}</th>
                <th className="py-3 px-4 min-w-[110px]">{t('colPlan')}</th>
                <th className="py-3 px-4 min-w-[110px]">{t('colStatus')}</th>
                <th className="py-3 px-4 min-w-[80px]">{t('colStudents')}</th>
                <th className="py-3 px-4 min-w-[80px]">{t('colTeachers')}</th>
                <th className="py-3 px-4 min-w-[120px]">{t('colInvoiced')}</th>
                <th className="py-3 px-4 min-w-[120px]">{t('colCollected')}</th>
                <th className="py-3 px-4 min-w-[120px]">{t('colOutstanding')}</th>
                <th className="py-3 px-4 min-w-[110px]">{t('colRate')}</th>
                <th className="py-3 px-4 w-[110px] text-right">{t('colDetails')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredSchools.map((school) => {
                const isHealthyRate = school.collectionRate != null && school.collectionRate >= 70;

                return (
                  <tr
                    key={school.id}
                    onClick={() => setActiveSchool(school)}
                    className="hover:bg-slate-50/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#0F172A] group-hover:text-[#0066FF] transition-colors">
                        {school.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{school.slug}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-bold text-[#0066FF]">
                        {planLabels[school.planTier] || school.planTier}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          school.isActive && school.subscriptionStatus === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {school.isActive ? t('active') : t('inactive')}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-700">{school.students}</td>

                    <td className="py-3.5 px-4 font-semibold text-slate-700">{school.teachers}</td>

                    <td className="py-3.5 px-4 font-bold text-slate-800">{fmtMad(school.invoiced)}</td>

                    <td className="py-3.5 px-4 font-bold text-emerald-700">{fmtMad(school.collected)}</td>

                    <td className="py-3.5 px-4 font-medium text-rose-600">{fmtMad(school.outstanding)}</td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                          isHealthyRate
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {school.collectionRate != null ? `${school.collectionRate}%` : '—'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSchool(school);
                        }}
                        className="h-7 text-xs font-bold text-[#0066FF] hover:bg-blue-50 rounded-lg gap-1 px-2.5"
                      >
                        {t('open')}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* School Detail Modal */}
      <Dialog open={!!activeSchool} onOpenChange={() => setActiveSchool(null)}>
        <DialogContent className="max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
              <Building className="w-5 h-5 text-[#0066FF]" />
              {t('detailTitle', { name: activeSchool?.name ?? '' })}
            </DialogTitle>
          </DialogHeader>

          {activeSchool && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">{t('technicalId')}</span>
                  <span className="font-mono text-slate-900 font-semibold">{activeSchool.slug}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">{t('subscribedPlan')}</span>
                  <span className="font-bold text-[#0066FF]">{planLabels[activeSchool.planTier] || activeSchool.planTier}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">{t('signupDate')}</span>
                  <span className="text-slate-600">
                    {new Date(activeSchool.createdAt).toLocaleDateString(intlLocale, { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Financial Box */}
              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
                <p className="font-extrabold text-emerald-900">{t('financeBox')}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500">{t('totalInvoiced')}</span>
                    <p className="font-bold text-[#0F172A]">{fmtMad(activeSchool.invoiced)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('totalCollected')}</span>
                    <p className="font-bold text-emerald-700">{fmtMad(activeSchool.collected)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('totalOutstanding')}</span>
                    <p className="font-bold text-rose-600">{fmtMad(activeSchool.outstanding)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('totalRate')}</span>
                    <p className="font-extrabold text-emerald-800">
                      {activeSchool.collectionRate != null ? `${activeSchool.collectionRate}%` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Demographics Box */}
              <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                <p className="font-extrabold text-blue-900">{t('peopleBox')}</p>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500">{t('studentsLabel')}</span>
                    <p className="font-bold text-[#0F172A]">{activeSchool.students}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('teachersLabel')}</span>
                    <p className="font-bold text-[#0F172A]">{activeSchool.teachers}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">{t('parentsLabel')}</span>
                    <p className="font-bold text-[#0F172A]">{activeSchool.parents}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveSchool(null)}
              className="rounded-xl border-slate-200 text-slate-700 text-xs font-bold"
            >
              {t('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
