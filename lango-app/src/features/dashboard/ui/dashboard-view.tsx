'use client';

import type { FullDashboardSummary } from '../model/types';
import { AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ActionCenter } from './action-center';
import { AdmissionsCard } from './admissions-card';
import { AttendanceTrendCard } from './attendance-trend-card';
import { DailyPulseKpi } from './daily-pulse-kpi';
import { DashboardSkeleton } from './dashboard-skeleton';
import { FinanceOverviewCard } from './finance-overview-card';
import { RecentPaymentsCard } from './recent-payments-card';
import { StudentWatchlistCard } from './student-watchlist-card';
import { UpcomingEventsCard } from './upcoming-events-card';

type DashboardViewProps = {
  locale: string;
  notice?: string | null;
};

export function DashboardView({ locale, notice }: DashboardViewProps) {
  const t = useTranslations('Dashboard');
  const tCommon = useTranslations('Common');
  const th = useTranslations('DashboardHome');

  const [summary, setSummary] = useState<FullDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  async function loadSummary() {
    setLoading(true);
    setError(null);
    try {
      // Branch scope comes from the server context (ctx.branchId): the shell
      // switcher persists the choice server-side, so no branch parameter is
      // sent — and none would be trusted anyway. The dashboard never renders
      // its own selector, so there is exactly one authoritative branch control.
      const params = new URLSearchParams({ locale });
      const res = await fetch(`/api/dashboard/summary?${params}`);
      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error?.message || th('loadError'));
      }
      const json = await res.json();
      setSummary(json.data);
    } catch (err: any) {
      console.error('Failed to load dashboard summary', err);
      setError(err.message || th('loadFailedTitle'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
    // A campus switch (header-campus-switcher) persists server-side and
    // reloads the page, so no client event is needed here.
  }, []);

  if (loading && !summary) {
    return <DashboardSkeleton />;
  }

  if (error && !summary) {
    return (
      <div className="
        mx-auto flex min-h-[420px] max-w-[800px] flex-col items-center
        justify-center rounded-2xl border border-rose-200 bg-rose-50/50 p-8
        text-center shadow-xs
      "
      >
        <div className="
          flex size-12 items-center justify-center rounded-2xl bg-rose-100
          text-rose-600
        "
        >
          <AlertCircle className="size-6" />
        </div>
        <h2 className="mt-4 text-base font-extrabold text-slate-900">
          {th('loadFailedTitle')}
        </h2>
        <p className="mt-1 max-w-md text-xs font-medium text-slate-600">
          {error}
        </p>
        <Button
          onClick={() => loadSummary()}
          className="
            mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white
            shadow-xs
            hover:bg-blue-700
            active:scale-[0.99]
          "
        >
          <RefreshCw className="mr-1.5 size-3.5" />
          {th('retry')}
        </Button>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const { institution, actionCenter, dailyPulse, financeOverview, attendanceTrend, upcomingEvents, recentPayments, watchlist, admissions } = summary;

  return (
    <div className="
      mx-auto max-w-[1600px] space-y-4 pb-8
      sm:space-y-6 sm:pb-12
    "
    >
      {/* Notice Banner */}
      {notice === 'employee_portal_unavailable' && !noticeDismissed && (
        <div className="
          flex items-start justify-between gap-3 rounded-2xl border
          border-amber-200 bg-amber-50 p-4 text-sm text-amber-800
        "
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-amber-600" />
            <span>{t('employeePortalNotice')}</span>
          </div>
          <button
            onClick={() => setNoticeDismissed(true)}
            aria-label={tCommon('close')}
            className="
              text-amber-600 transition
              hover:text-amber-900
            "
          >
            ✕
          </button>
        </div>
      )}

      {/* A. PAGE HEADER - branch selection lives in the shell, not here */}
      <header className="
        flex flex-col gap-3 border-b border-slate-200/80 pb-3.5
        sm:pb-4
        lg:flex-row lg:items-center lg:justify-between
      "
      >
        <div>
          <h1 className="
            text-xl font-extrabold tracking-tight text-slate-900
            sm:text-2xl
          "
          >
            {th('title')}
          </h1>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            <span>{institution.name}</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="text-blue-600">{institution.activeBranchName}</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="capitalize">{institution.currentDateFormatted}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadSummary()}
            className="
              rounded-xl border-slate-200/80 text-xs font-bold text-slate-700
              shadow-2xs
              hover:bg-slate-50
            "
          >
            <RefreshCw className={`
              mr-1.5 size-3 text-slate-400
              ${loading
      ? `animate-spin`
      : ''}
            `}
            />
            {th('refresh')}
          </Button>
        </div>
      </header>

      {/* B. ACTION CENTER (first content: what needs me today?) */}
      <ActionCenter data={actionCenter} locale={locale} />

      {/* C. FOUR CORE KPI CARDS */}
      <DailyPulseKpi data={dailyPulse} locale={locale} />

      {/* D & E. FINANCIAL SITUATION + ATTENDANCE WEEK */}
      <div className="
        grid grid-cols-1 gap-4
        sm:gap-6
        lg:grid-cols-12 lg:items-start
      "
      >
        <div className="lg:col-span-7">
          <FinanceOverviewCard data={financeOverview} locale={locale} />
        </div>
        <div className="lg:col-span-5">
          <AttendanceTrendCard data={attendanceTrend} locale={locale} />
        </div>
      </div>

      {/* F & G. AGENDA + RECENT PAYMENTS */}
      <div className="
        grid grid-cols-1 gap-4
        sm:gap-6
        lg:grid-cols-12 lg:items-start
      "
      >
        <div className="lg:col-span-6">
          <UpcomingEventsCard
            events={upcomingEvents.events}
            todayBirthdaysCount={upcomingEvents.todayBirthdaysCount}
            birthdaysPreview={upcomingEvents.birthdaysPreview}
            locale={locale}
          />
        </div>
        <div className="lg:col-span-6">
          <RecentPaymentsCard
            payments={recentPayments}
            locale={locale}
          />
        </div>
      </div>

      {/* H & I. ABSENTEEISM + ADMISSIONS TO REVIEW */}
      <div className="
        grid grid-cols-1 gap-4
        sm:gap-6
        lg:grid-cols-12 lg:items-start
      "
      >
        <div className="lg:col-span-6">
          <StudentWatchlistCard
            students={watchlist.students}
            totalWatchlistCount={watchlist.totalWatchlistCount}
            locale={locale}
          />
        </div>
        <div className="lg:col-span-6">
          <AdmissionsCard data={admissions} locale={locale} />
        </div>
      </div>
    </div>
  );
}
