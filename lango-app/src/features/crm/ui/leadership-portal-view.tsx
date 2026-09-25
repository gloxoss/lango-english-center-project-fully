// leadership-portal-view.tsx
// CLIENT ISLAND — fetches /api/analytics on mount and renders the school's real
// strategic data. Every figure comes from the tenant's database; empty domains
// render an explicit "données insuffisantes" empty state, never invented numbers.
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, BookOpen, Calendar, CheckCircle2, DollarSign, Download, Info,
  Plus, RefreshCw, ShieldCheck, Users,
} from 'lucide-react';
import { openDocumentPreview } from '@/features/documents/ui/pdf-preview';

type RiskItem = { level: 'Critique' | 'Importante' | 'Modérée'; count: number; label: string };
type PriorityAction = { task: string; priority: 'Critique' | 'Haute' | 'Moyenne' };
type Insight = { icon: 'green' | 'blue' | 'orange'; title: string; desc: string };
type Announcement = { id: string; title: string; body: string; author: string; date: string };
type Meeting = { id: string; date: string; time: string; title: string; owner: string; status: string };

type AnalyticsData = {
  totalStudents: number;
  totalTeachers: number;
  activeClasses: number;
  attendanceRate30d: number | null;
  enrollmentTrend: { month: string; newStudents: number }[];
  revenueTrend: { month: string; invoiced: number; collected: number; expenses: number }[];
  studentsThisMonth: number;
  totalStaff: number;
  staffPresenceRate: number | null;
  finance: {
    invoicedTotal: number;
    collectedTotal: number;
    outstandingTotal: number;
    discountsTotal: number;
    collectionRate: number | null;
  };
  averageGrade: number | null;
  igpTrend: { month: string; igp: number }[];
  igpLatest: number | null;
  igpDelta: number | null;
  alerts: {
    criticalCount: number;
    importantCount: number;
    moderateCount: number;
    total: number;
    risks: RiskItem[];
    priorityActions: PriorityAction[];
  };
  insights: Insight[];
  announcements: Announcement[];
  meetings: Meeting[];
  period: { from: string; to: string };
};

const riskColor: Record<RiskItem['level'], string> = {
  Critique: 'bg-rose-100 text-rose-700',
  Importante: 'bg-amber-100 text-amber-700',
  Modérée: 'bg-[#DCEBF4] text-[#1B6C93]',
};
const priorityColor: Record<PriorityAction['priority'], string> = {
  Critique: 'bg-rose-100 text-rose-700',
  Haute: 'bg-amber-100 text-amber-700',
  Moyenne: 'bg-[#DCEBF4] text-[#1B6C93]',
};
const insightColor: Record<Insight['icon'], string> = {
  green: 'bg-[#17A673]',
  blue: 'bg-[#2487B8]',
  orange: 'bg-amber-500',
};
const meetingStatusColor = (status: string) => (status === 'Réservé' ? 'bg-amber-100 text-amber-700' : 'bg-[#DCEBF4] text-[#1B6C93]');

function PortalSkeleton() {
  return (
    <div className="space-y-6 max-w-[1800px] mx-auto animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-slate-100 border border-slate-200/80" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 h-56 rounded-2xl bg-slate-100 border border-slate-200/80" />
        <div className="xl:col-span-4 h-56 rounded-2xl bg-slate-100 border border-slate-200/80" />
        <div className="xl:col-span-3 h-56 rounded-2xl bg-slate-100 border border-slate-200/80" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-4 h-48 rounded-2xl bg-slate-100 border border-slate-200/80" />
        <div className="xl:col-span-4 h-48 rounded-2xl bg-slate-100 border border-slate-200/80" />
        <div className="xl:col-span-4 h-48 rounded-2xl bg-slate-100 border border-slate-200/80" />
      </div>
    </div>
  );
}

export function LeadershipPortalView() {
  const t = useTranslations('Leadership');
  const tCommon = useTranslations('Common');
  const pathname = usePathname();
  const localeMatch = pathname.match(/^\/([a-z]{2})(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : 'fr';

  const intlLocale = locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR';
  const nf = new Intl.NumberFormat(intlLocale);
  const money = (n: number) => nf.format(Math.round(n));
  const pctLabel = (v: number | null, digits = 1) => (v == null ? '—' : `${v.toFixed(digits)}%`);
  const monthShort = (m: string) => {
    try {
      return new Date(`${m}-01`).toLocaleDateString(intlLocale, { month: 'short' });
    } catch {
      return m;
    }
  };

  const compactMAD = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString(intlLocale, { maximumFractionDigits: 2 })} M`;
    if (n >= 1_000) return `${(n / 1_000).toLocaleString(intlLocale, { maximumFractionDigits: 1 })} k`;
    return money(n);
  };

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState('6mo');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics?range=${range}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        setError(json.error?.message || json.message || tCommon('error'));
      }
    } catch {
      setError(tCommon('error'));
    } finally {
      setLoading(false);
    }
  }, [range, tCommon]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <PortalSkeleton />;

  if (error) {
    return (
      <div className="max-w-[1800px] mx-auto p-6 bg-white rounded-2xl border border-rose-200 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
        <p className="text-sm font-bold text-[#16212B]">{error}</p>
        <Button onClick={loadData} variant="outline" size="sm" className="gap-2 rounded-xl border-slate-200 text-xs font-bold">
          <RefreshCw className="w-3.5 h-3.5" /> {tCommon('refresh')}
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const hasIgp = data.igpLatest != null && data.igpTrend.some(t => t.igp > 0);

  const printLeadershipReport = () => {
    openDocumentPreview({ kind: 'leadership_report', sourceId: 'current', range: range === '30d' ? '30d' : '6mo' }, locale);
  };

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('portalTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('portalSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="h-9 text-xs rounded-xl border border-slate-200 bg-white px-3 font-bold text-[#16212B]"
          >
            <option value="6mo">{t('last6Months')}</option>
            <option value="30d">{t('last30Days')}</option>
          </select>
          <span className="h-9 flex items-center text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 rounded-xl px-3 gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {data.period.from} — {data.period.to}
          </span>
          <Button variant="outline" size="sm" onClick={printLeadershipReport} className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5 font-bold text-[#16212B]">
            <Download className="w-3.5 h-3.5" /> {t('export')}
          </Button>
        </div>
      </div>

      {/* 6 Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400">{t('enrolledStudents')}</p>
            <p className="text-base font-extrabold text-[#16212B]">{nf.format(data.totalStudents)}</p>
            <p className="text-[9px] font-semibold text-[#17A673]">{t('newThisMonth', { count: data.studentsThisMonth })}</p>
          </div>
        </Card>

        <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400">{t('attendanceRate')}</p>
            <p className="text-base font-extrabold text-[#16212B]">{pctLabel(data.attendanceRate30d)}</p>
            <p className="text-[9px] font-semibold text-slate-500">{t('last30DaysSubtitle')}</p>
          </div>
        </Card>

        <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#DCEBF4] shrink-0 flex items-center justify-center text-[#1B6C93]">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400">{t('feeCollection')}</p>
            <p className="text-base font-extrabold text-[#16212B]">{pctLabel(data.finance.collectionRate)}</p>
            <p className="text-[9px] font-semibold text-slate-500">{money(data.finance.collectedTotal)} MAD / {money(data.finance.invoicedTotal)}</p>
          </div>
        </Card>

        <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-100 shrink-0 flex items-center justify-center text-purple-700">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400">{t('generalAverage')}</p>
            <p className="text-base font-extrabold text-[#16212B]">
              {data.averageGrade != null ? `${data.averageGrade.toFixed(1)}%` : '—'}
            </p>
            <p className="text-[9px] font-semibold text-slate-500">
              {data.averageGrade != null ? t('evaluationResults') : t('insufficientData')}
            </p>
          </div>
        </Card>

        <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-100 shrink-0 flex items-center justify-center text-amber-700">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400">{t('unresolvedAlerts')}</p>
            <p className="text-base font-extrabold text-[#16212B]">{data.alerts.total}</p>
            <p className="text-[9px] font-semibold text-rose-600 font-bold">
              {t('alertsSummary', { critical: data.alerts.criticalCount, important: data.alerts.importantCount })}
            </p>
          </div>
        </Card>

        <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#DDF5EC] shrink-0 flex items-center justify-center text-[#17A673]">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold text-slate-400">{t('staffAttendance')}</p>
            <p className="text-base font-extrabold text-[#16212B]">{pctLabel(data.staffPresenceRate)}</p>
            <p className="text-[9px] font-semibold text-slate-500">
              {data.staffPresenceRate != null ? t('employeesCount', { count: data.totalStaff }) : t('insufficientData')}
            </p>
          </div>
        </Card>
      </div>

      {/* Row 1: IGP (5 cols) + Performance académique (4 cols) + Insights (3 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* IGP */}
        <div className="xl:col-span-5 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">{t('institutionPerformance')}</h2>
              {hasIgp && data.igpDelta != null ? (
                <Badge className={`border-none text-[10px] font-bold ${data.igpDelta >= 0 ? 'bg-[#DDF5EC] text-[#17A673]' : 'bg-rose-100 text-rose-700'}`}>
                  {data.igpDelta >= 0 ? `▲ +${data.igpDelta} pts` : `▼ ${data.igpDelta} pts`} {t('vsPreviousMonth')}
                </Badge>
              ) : (
                <Badge className="bg-slate-100 text-slate-500 border-none text-[10px] font-bold">{t('derivedIndexBadge')}</Badge>
              )}
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#16212B]">{hasIgp ? data.igpLatest : '—'}</span>
              <span className="text-xs font-bold text-slate-400">{t('igpScale')}</span>
            </div>
            {/* The score is a composite; say how it is built (audit S-15). */}
            <p className="text-[11px] text-slate-500 leading-snug">{t('igpSub')}</p>

            {hasIgp ? (
              <div className="flex items-end gap-3 h-32 pt-4 border-b border-slate-100">
                {data.igpTrend.map((item) => (
                  <div key={item.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-[#2487B8]">{item.igp}</span>
                    <div className="w-full bg-slate-100 rounded-t-sm flex items-end h-20">
                      <div className="w-full bg-[#2487B8] rounded-t-sm" style={{ height: `${Math.max(2, item.igp)}%` }} />
                    </div>
                    <span className="text-[9px] font-bold text-slate-400">{monthShort(item.month)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                <Info className="w-5 h-5 mx-auto mb-1 text-slate-300" />
                {t('noActivityIgp')}
              </div>
            )}
          </Card>
        </div>

        {/* Performance académique */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">{t('academicPerformance')}</h2>
            </div>

            {data.averageGrade != null ? (
              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#16212B] text-[11px]">{t('allEvaluationsAverage')}</span>
                    <span className="font-bold text-[#2487B8] text-[11px]">{data.averageGrade.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#2487B8] rounded-full" style={{ width: `${Math.min(100, data.averageGrade)}%` }} />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">
                  {t('levelDetailNote')}
                </p>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                <BookOpen className="w-5 h-5 mx-auto mb-1 text-slate-300" />
                {t('noEvaluationResults')}
              </div>
            )}

            <Link href={`/${locale}/dashboard/academics/results`} className="block text-xs font-extrabold text-[#2487B8] hover:underline w-full text-center pt-1">
              {t('viewFullAcademicReport')}
            </Link>
          </Card>
        </div>

        {/* Insights clés */}
        <div className="xl:col-span-3 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <h2 className="text-xs font-extrabold text-[#16212B]">{t('keyInsights')}</h2>

            {data.insights.length > 0 ? (
              <div className="space-y-2">
                {data.insights.map((ins, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full ${insightColor[ins.icon]} mt-1 shrink-0`} />
                    <div>
                      <p className="font-bold text-[#16212B] text-[11px]">{ins.title}</p>
                      <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{ins.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                <Info className="w-5 h-5 mx-auto mb-1 text-slate-300" />
                {t('noInsightsYet')}
              </div>
            )}

            <Link href={`/${locale}/dashboard/portals/leadership/exceptions`} className="block text-xs font-extrabold text-[#2487B8] hover:underline w-full text-center pt-1">
              {t('viewAllInsights')}
            </Link>
          </Card>
        </div>
      </div>

      {/* Row 2: Aperçu financier (4) + Risques & alertes (4) + Personnel (4) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Aperçu financier */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">{t('financialOverview')}</h2>
              <Link href={`/${locale}/dashboard/finance`} className="text-[11px] font-bold text-[#2487B8] hover:underline">{t('viewFinancialDashboard')}</Link>
            </div>

            <div className="flex items-center gap-4 py-2">
              <div className="relative w-24 h-24 rounded-full border-8 border-[#2487B8] flex flex-col items-center justify-center text-center shrink-0">
                <span className="text-xs font-extrabold text-[#16212B]">{compactMAD(data.finance.invoicedTotal)}</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase">{t('targetMad')}</span>
              </div>

              <div className="space-y-1.5 text-xs flex-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">{t('collectedLabel')}</span>
                  <span className="font-bold text-[#16212B]">{money(data.finance.collectedTotal)} MAD ({pctLabel(data.finance.collectionRate)})</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">{t('toCollectLabel')}</span>
                  <span className="font-bold text-[#16212B]">{money(data.finance.outstandingTotal)} MAD</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">{t('discountsLabel')}</span>
                  <span className="font-bold text-slate-400">{money(data.finance.discountsTotal)} MAD</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Risques & alertes */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">{t('risksAndAlerts')}</h2>
              <Badge className="bg-rose-100 text-rose-700 border-none font-bold text-[10px]">
                {t('alertsCount', { count: data.alerts.total })}
              </Badge>
            </div>

            <div className="space-y-2 text-xs">
              {data.alerts.risks.map((r, idx) => (
                <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[9px] font-bold border-none ${riskColor[r.level]}`}>{r.level}</Badge>
                    <span className="font-bold text-[#16212B] text-xs">{r.count}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium truncate max-w-[200px]">{r.label}</span>
                </div>
              ))}
            </div>

            <Link href={`/${locale}/dashboard/portals/leadership/exceptions`} className="block text-xs font-extrabold text-[#2487B8] hover:underline w-full text-center pt-1">
              {t('viewRiskRegistry')}
            </Link>
          </Card>
        </div>

        {/* Aperçu du personnel */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">{t('staffOverview')}</h2>
              <span className="text-[10px] font-bold text-slate-500">{t('realData')}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">{t('totalEmployeesLabel')}</span>
                <span className="text-base font-extrabold text-[#16212B]">{data.totalStaff}</span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">{t('avgAttendanceLabel')}</span>
                <span className="text-base font-extrabold text-[#17A673]">{pctLabel(data.staffPresenceRate)}</span>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-[9px] font-bold text-slate-400 uppercase block">{t('teachersLabel')}</span>
                <span className="text-base font-extrabold text-[#2487B8]">{data.totalTeachers}</span>
              </div>
            </div>

            <Link href={`/${locale}/dashboard/hr`} className="block text-xs font-extrabold text-[#2487B8] hover:underline w-full text-center pt-1">
              {t('viewHrDashboard')}
            </Link>
          </Card>
        </div>
      </div>

      {/* Row 3: Réunions (4) + Annonces (4) + Actions prioritaires (4) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Réunions à venir */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">{t('upcomingMeetings')}</h2>
              <Link href={`/${locale}/dashboard/academics/calendar`} className="text-[11px] font-bold text-[#2487B8] hover:underline">{t('viewCalendar')}</Link>
            </div>

            {data.meetings.length > 0 ? (
              <div className="space-y-2 text-xs">
                {data.meetings.map((m) => (
                  <div key={m.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-slate-400 font-bold">{m.date} {m.time}</span>
                      <Badge className={`text-[9px] font-bold border-none ${meetingStatusColor(m.status)}`}>{m.status}</Badge>
                    </div>
                    <p className="font-bold text-[#16212B] text-[11px]">{m.title}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{t('meetingResponsible', { owner: m.owner })}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                <Calendar className="w-5 h-5 mx-auto mb-1 text-slate-300" />
                {t('noUpcomingMeetings')}
              </div>
            )}
          </Card>
        </div>

        {/* Annonces institutionnelles */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">{t('institutionalAnnouncements')}</h2>
              <Button asChild size="sm" className="h-7 text-[10px] bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold rounded-lg gap-1">
                <Link href={`/${locale}/dashboard/communication`}>
                  <Plus className="w-3 h-3" /> {t('newAnnouncement')}
                </Link>
              </Button>
            </div>

            {data.announcements.length > 0 ? (
              <div className="space-y-2 text-xs">
                {data.announcements.map((a) => (
                  <div key={a.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-[#16212B] text-[11px]">{a.title}</p>
                      <span className="text-[9px] text-slate-400 shrink-0">{a.date}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium line-clamp-2">{a.body}</p>
                    <p className="text-[9px] text-slate-400 font-semibold">{t('publishedBy', { author: a.author })}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                <Info className="w-5 h-5 mx-auto mb-1 text-slate-300" />
                {t('noAnnouncementsYet')}
              </div>
            )}
          </Card>
        </div>

        {/* Actions prioritaires */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#16212B]">{t('priorityActionsTitle')}</h2>
              <Link href={`/${locale}/dashboard/portals/leadership/approvals`} className="text-[11px] font-bold text-[#2487B8] hover:underline">{t('viewAllActions')}</Link>
            </div>

            <div className="space-y-2 text-xs">
              {data.alerts.priorityActions.map((act, idx) => (
                <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-bold text-[#16212B] text-[11px]">{act.task}</span>
                  </div>
                  <Badge className={`text-[9px] font-bold border-none shrink-0 ${priorityColor[act.priority]}`}>{act.priority}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
