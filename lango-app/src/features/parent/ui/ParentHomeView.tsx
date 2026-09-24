'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatAmount } from '@/libs/finance/format-money';
import {
  BellRing,
  CalendarClock,
  Clock,
  Home,
  MessageSquareText,
  RefreshCw,
  BookOpen,
  Wallet,
  AlertTriangle,
} from 'lucide-react';
import {
  ChildContextSwitcher,
  type LinkedChildOption,
} from '@/components/parent/ChildContextSwitcher';

type HomeWidget = { degraded: true; reason: 'not_available' | 'error' } | { degraded: false; value: number; label: string };

type ActiveChild = {
  relationshipId: string;
  studentId: string;
  name: string | null;
};

type HomeData = {
  children: LinkedChildOption[];
  activeChild: ActiveChild | null;
  widgets: {
    alerts: HomeWidget;
    attendanceToday: HomeWidget;
    balances: HomeWidget;
    upcoming: HomeWidget;
    homework: HomeWidget;
    messages: HomeWidget;
  };
};

const WIDGET_CONFIG: { key: keyof HomeData['widgets']; icon: React.ReactNode }[] = [
  { key: 'alerts', icon: <BellRing className="w-5 h-5" /> },
  { key: 'attendanceToday', icon: <Clock className="w-5 h-5" /> },
  { key: 'balances', icon: <Wallet className="w-5 h-5" /> },
  { key: 'upcoming', icon: <CalendarClock className="w-5 h-5" /> },
  { key: 'homework', icon: <BookOpen className="w-5 h-5" /> },
  { key: 'messages', icon: <MessageSquareText className="w-5 h-5" /> },
];

export function ParentHomeView() {
  const tParent = useTranslations('Parent');
  const tCommon = useTranslations('Common');
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRelationshipId, setActiveRelationshipId] = useState<string | null>(null);

  const getWidgetLabel = (key: keyof HomeData['widgets']): string => {
    switch (key) {
      case 'alerts':
        return tParent('urgentAlerts');
      case 'attendanceToday':
        return tParent('attendanceToday');
      case 'balances':
        return tParent('balancesAndPayments');
      case 'upcoming':
        return tParent('upcomingEvents');
      case 'homework':
        return tParent('homework');
      case 'messages':
        return tParent('messages');
      default:
        return key;
    }
  };

  const loadHome = useCallback(async (child?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = child ? `/api/guardian/me/home?child=${encodeURIComponent(child)}` : '/api/guardian/me/home';
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setData(json.data as HomeData);
        setActiveRelationshipId(json.data.activeChild?.relationshipId ?? null);
      } else {
        setError(json.error?.message ?? tParent('errorLoad'));
      }
    } catch {
      setError(tParent('errorConnect'));
    } finally {
      setLoading(false);
    }
  }, [tParent]);

  useEffect(() => {
    loadHome();
  }, [loadHome]);

  const handleSwitch = useCallback(
    (relationshipId: string) => {
      if (relationshipId === activeRelationshipId) return;
      loadHome(relationshipId);
    },
    [activeRelationshipId, loadHome],
  );

  const initials = (name?: string | null) =>
    (name ?? '?')
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#0066FF]/10 border border-[#0066FF]/30 flex items-center justify-center text-[#0066FF]">
            <Home className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{tParent('portalTitle')}</h1>
            <p className="text-sm text-slate-500">{tParent('portalSubtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ChildContextSwitcher
            children={data?.children ?? []}
            activeRelationshipId={activeRelationshipId}
            onChange={handleSwitch}
          />
          <button
            type="button"
            onClick={() => loadHome(activeRelationshipId ?? undefined)}
            disabled={loading}
            aria-label={tCommon('refresh')}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {tCommon('refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Active child banner */}
      {!loading && data?.activeChild?.name && (
        <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-[#0066FF]/10 to-transparent border border-[#0066FF]/20 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-[#0066FF] text-white flex items-center justify-center font-bold">
            {initials(data.activeChild.name)}
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">{tParent('activeChild')}</div>
            <div className="text-lg font-bold text-slate-900">{data.activeChild.name}</div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && data?.children.length === 0 && (
        <div className="p-10 bg-white border border-slate-200 rounded-xl text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">{tParent('noChildrenLinked')}</h2>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            {tParent('noChildrenLinkedDesc')}
          </p>
        </div>
      )}

      {/* Widget grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {WIDGET_CONFIG.map((card) => {
          const widget = data?.widgets[card.key];
          return (
            <div
              key={card.key}
              className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-[#0066FF] rounded-lg">{card.icon}</div>
                <h3 className="font-semibold text-slate-900">{getWidgetLabel(card.key)}</h3>
              </div>
              {loading ? (
                <div className="h-16 animate-pulse bg-slate-100 rounded-lg" />
              ) : widget?.degraded ? (
                <div className="text-sm text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                  {widget.reason === 'error'
                    ? tParent('dataTemporarilyUnavailable')
                    : tParent('availableSoon')}
                </div>
              ) : (
                <div><div className="text-2xl font-bold text-slate-900">{card.key === 'balances' ? formatAmount(widget?.value) : widget?.value ?? 0}</div><div className="text-sm text-slate-500">{widget?.label}</div></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
