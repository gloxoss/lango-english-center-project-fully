'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Building2, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { FullDashboardSummary } from '../model/types';
import { ActionCenter } from './action-center';
import { DailyPulseKpi } from './daily-pulse-kpi';
import { FinanceOverviewCard } from './finance-overview-card';
import { AttendanceTrendCard } from './attendance-trend-card';
import { UpcomingEventsCard } from './upcoming-events-card';
import { RecentPaymentsCard } from './recent-payments-card';
import { StudentWatchlistCard } from './student-watchlist-card';
import { StudentDistributionCard } from './student-distribution-card';
import { DashboardSkeleton } from './dashboard-skeleton';

interface DashboardViewProps {
  locale: string;
  notice?: string | null;
}

export function DashboardView({ locale, notice }: DashboardViewProps) {
  const t = useTranslations('Dashboard');
  const tCommon = useTranslations('Common');

  const [summary, setSummary] = useState<FullDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  async function loadSummary(branchIdToFetch?: string) {
    setLoading(true);
    setError(null);
    try {
      const targetBranch = branchIdToFetch ?? selectedBranchId;
      const url = targetBranch && targetBranch !== 'all'
        ? `/api/dashboard/summary?branchId=${encodeURIComponent(targetBranch)}`
        : '/api/dashboard/summary';

      const res = await fetch(url);
      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error?.message || 'Erreur lors du chargement du tableau de bord.');
      }
      const json = await res.json();
      setSummary(json.data);
    } catch (err: any) {
      console.error('Failed to load dashboard summary', err);
      setError(err.message || 'Impossible de charger le tableau de bord.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('schoolos_active_branch_id') : null;
    const initialBranch = stored || 'all';
    setSelectedBranchId(initialBranch);
    loadSummary(initialBranch);

    const onBranchChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ branchId: string | null }>;
      const newId = customEvent.detail?.branchId || 'all';
      setSelectedBranchId(newId);
      loadSummary(newId);
    };
    window.addEventListener('schoolos:branch-changed', onBranchChanged);
    return () => window.removeEventListener('schoolos:branch-changed', onBranchChanged);
  }, []);

  const handleBranchChange = (newBranchId: string) => {
    if (newBranchId && newBranchId !== 'all') {
      localStorage.setItem('schoolos_active_branch_id', newBranchId);
    } else {
      localStorage.removeItem('schoolos_active_branch_id');
    }
    setSelectedBranchId(newBranchId);
    loadSummary(newBranchId);
    window.dispatchEvent(new CustomEvent('schoolos:branch-changed', { detail: { branchId: newBranchId === 'all' ? null : newBranchId } }));
  };

  if (loading && !summary) {
    return <DashboardSkeleton />;
  }

  if (error && !summary) {
    return (
      <div className="mx-auto flex min-h-[420px] max-w-[800px] flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center shadow-xs">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
          <AlertCircle className="size-6" />
        </div>
        <h2 className="mt-4 text-base font-extrabold text-slate-900">
          Impossible de charger le tableau de bord
        </h2>
        <p className="mt-1 max-w-md text-xs text-slate-600 font-medium">
          {error}
        </p>
        <Button
          onClick={() => loadSummary()}
          className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-[0.99]"
        >
          <RefreshCw className="mr-1.5 size-3.5" />
          Réessayer
        </Button>
      </div>
    );
  }

  if (!summary) return null;

  const { institution, actionCenter, dailyPulse, financeOverview, attendanceTrend, upcomingEvents, recentPayments, watchlist, studentDistribution } = summary;

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 sm:space-y-6 pb-8 sm:pb-12">
      {/* Notice Banner */}
      {notice === 'employee_portal_unavailable' && !noticeDismissed && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0 text-amber-600" />
            <span>{t('employeePortalNotice')}</span>
          </div>
          <button
            onClick={() => setNoticeDismissed(true)}
            aria-label={tCommon('close')}
            className="text-amber-600 transition hover:text-amber-900"
          >
            ×
          </button>
        </div>
      )}

      {/* A. PAGE HEADER (Redesigned per Approved IA) */}
      <header className="flex flex-col gap-3 border-b border-slate-200/80 pb-3.5 sm:pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
            Tableau de bord
          </h1>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            <span>{institution.name}</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="text-blue-600">{institution.activeBranchName}</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span className="capitalize">{institution.currentDateFormatted}</span>
          </p>
        </div>

        {/* Global Controls: Branch Switcher & Refresh */}
        <div className="flex items-center gap-2.5">
          {institution.availableBranches.length > 1 && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 shadow-2xs">
              <Building2 className="size-3.5 text-slate-400" />
              <select
                aria-label="Sélectionner une succursale"
                value={selectedBranchId}
                onChange={e => handleBranchChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-hidden cursor-pointer"
              >
                <option value="all">Toutes les succursales</option>
                {institution.availableBranches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadSummary()}
            className="rounded-xl border-slate-200/80 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <RefreshCw className="mr-1.5 size-3 text-slate-400" />
            Actualiser
          </Button>
        </div>
      </header>

      {/* B. ACTION CENTER (First Dashboard Content) */}
      <ActionCenter data={actionCenter} locale={locale} />

      {/* C. DAILY PULSE (4 Primary KPI Cards) */}
      <DailyPulseKpi data={dailyPulse} locale={locale} />

      {/* D & E. FINANCE OVERVIEW + ATTENDANCE TREND (Bento Grid Row) */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-7">
          <FinanceOverviewCard data={financeOverview} locale={locale} />
        </div>
        <div className="lg:col-span-5">
          <AttendanceTrendCard data={attendanceTrend} locale={locale} />
        </div>
      </div>

      {/* F & G. UPCOMING EVENTS + RECENT PAYMENTS (Bento Grid Row) */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12 lg:items-start">
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

      {/* H & I. WATCHLIST + STUDENT DISTRIBUTION (Bento Grid Row) */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-6">
          <StudentWatchlistCard
            students={watchlist.students}
            totalWatchlistCount={watchlist.totalWatchlistCount}
            locale={locale}
          />
        </div>
        <div className="lg:col-span-6">
          <StudentDistributionCard
            items={studentDistribution.items}
            totalActiveStudents={studentDistribution.totalActiveStudents}
            locale={locale}
          />
        </div>
      </div>
    </div>
  );
}
