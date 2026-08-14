'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FileText, History, Calendar, ShieldCheck, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';

const RUNS_LAST_VIEWED_KEY = 'reporting.runs.lastViewedAt';

export function ReportingNav({ currentKey }: { currentKey?: string }) {
  const pathname = usePathname();
  const [newRunsCount, setNewRunsCount] = useState(0);

  // Extract locale from pathname (e.g. /fr/dashboard/reports -> locale = 'fr')
  const localeMatch = pathname.match(/^\/([a-z]{2})(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : 'fr';
  const onRunsPage = pathname.includes('/reports/runs');

  useEffect(() => {
    if (onRunsPage) {
      localStorage.setItem(RUNS_LAST_VIEWED_KEY, new Date().toISOString());
      setNewRunsCount(0);
      return;
    }

    const lastViewedAt = localStorage.getItem(RUNS_LAST_VIEWED_KEY);
    fetch('/api/addons/reporting/runs?pageSize=50')
      .then(res => res.json())
      .then((json) => {
        if (!json?.success) return;
        const completedSinceViewed = (json.data as Array<{ status: string; finishedAt: string | null }>).filter(
          run => run.status === 'completed' && run.finishedAt && (!lastViewedAt || run.finishedAt > lastViewedAt),
        );
        setNewRunsCount(completedSinceViewed.length);
      })
      .catch(() => {});
  }, [onRunsPage]);

  const navItems = [
    {
      label: 'Centre de Rapports',
      href: `/${locale}/dashboard/reports`,
      icon: FileText,
      active: (pathname.endsWith('/reports') || pathname.endsWith('/reports/')) && !currentKey,
    },
    {
      label: 'Mes Exécutions',
      href: `/${locale}/dashboard/reports/runs`,
      icon: History,
      active: onRunsPage,
      badge: newRunsCount > 0 ? newRunsCount : undefined,
    },
    {
      label: 'Planifications',
      href: `/${locale}/dashboard/reports/schedules`,
      icon: Calendar,
      active: pathname.includes('/reports/schedules'),
    },
    {
      label: 'Console Admin',
      href: `/${locale}/dashboard/reports/admin`,
      icon: ShieldCheck,
      active: pathname.includes('/reports/admin'),
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E4EDFD] text-[#2487B8]">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-[#16212B]">
                Rapports & Analytics
              </h1>
              <span className="rounded-full bg-[#E4EDFD] px-2.5 py-0.5 text-[10px] font-bold text-[#2487B8] uppercase tracking-wider">
                Module Add-on
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Plateforme décisionnelle unifiée pour l'exploration, l'analyse et l'exportation des données SchoolOS.
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5 overflow-x-auto rounded-xl bg-slate-100/80 p-1 border border-slate-200/60">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-150 whitespace-nowrap',
                  item.active
                    ? 'bg-[#2487B8] text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
                {'badge' in item && item.badge ? (
                  <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#17A673] px-1 text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
