'use client';

import type { UpcomingEventItem } from '../model/types';
import { ArrowUpRight, Cake, Calendar, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import React from 'react';

type UpcomingEventsCardProps = {
  events: UpcomingEventItem[];
  todayBirthdaysCount: number;
  birthdaysPreview: string[];
  locale: string;
};

export function UpcomingEventsCard({
  events,
  todayBirthdaysCount,
  birthdaysPreview,
  locale,
}: UpcomingEventsCardProps) {
  const th = useTranslations('DashboardHome');
  const timingGroupLabels: Record<UpcomingEventItem['timingGroup'], string> = {
    today: th('today'),
    tomorrow: th('tomorrow'),
    this_week: th('thisWeek'),
  };

  const operational = events;
  const showBirthdaysLine = todayBirthdaysCount > 0;

  return (
    <div className="
      flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4
      shadow-2xs
      sm:p-5
    "
    >
      <div>
        {/* Header */}
        <div className="
          flex items-center justify-between border-b border-slate-100 pb-3
        "
        >
          <div className="flex items-center gap-2">
            <div className="
              flex size-7 items-center justify-center rounded-lg bg-blue-50
              text-blue-600
            "
            >
              <Calendar className="size-4" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">{th('agendaTitle')}</h3>
          </div>
          <Link
            href={`/${locale}/dashboard/events`}
            className="
              flex items-center gap-1 text-xs font-bold text-blue-600 transition
              hover:text-blue-800 hover:underline
            "
          >
            <span>{th('seeCalendar')}</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {/* Operational Events List */}
        <div className="mt-3.5 space-y-2">
          {operational.length === 0 && !showBirthdaysLine
            ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  {th('noUpcomingEvents')}
                </div>
              )
            : operational.length === 0
              ? (
                  <div className="py-2 text-center text-xs text-slate-400">
                    {th('noOperationalEvents')}
                  </div>
                )
              : (
                  operational.slice(0, 5).map(event => (
                    <div
                      key={event.id}
                      className="
                        flex items-center justify-between rounded-xl border
                        border-slate-100 bg-slate-50/70 p-3 transition
                        hover:bg-slate-50
                      "
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="truncate text-xs font-bold text-slate-900">
                          {event.title}
                        </p>
                        <div className="
                          mt-0.5 flex items-center gap-2 text-[11px] font-medium
                          text-slate-400
                        "
                        >
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {event.startDate}
                          </span>
                          {event.location && (
                            <span>
                              ·
                              {event.location}
                            </span>
                          )}
                        </div>
                      </div>

                      <span
                        className={`
                          shrink-0 rounded-full px-2 py-0.5 text-[10px]
                          font-extrabold
                          ${
                    event.timingGroup === 'today'
                      ? 'bg-blue-100 text-blue-800'
                      : event.timingGroup === 'tomorrow'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200/80 text-slate-700'
                    }
                        `}
                      >
                        {timingGroupLabels[event.timingGroup]}
                      </span>
                    </div>
                  ))
                )}
        </div>
      </div>

      {/* Birthdays: one quiet line, never dominating the agenda */}
      {showBirthdaysLine && (
        <div className="
          mt-3 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px]
          text-slate-500
        "
        >
          <Cake className="size-3.5 shrink-0 text-purple-400" />
          <span className="truncate">
            <strong className="font-bold text-slate-600">{th('birthdaysCount', { count: todayBirthdaysCount })}</strong>
            {birthdaysPreview.length > 0 && (
              <span className="font-medium text-slate-400">
                {' '}
                ·
                {birthdaysPreview.join(', ')}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <Link
          href={`/${locale}/dashboard/events`}
          className="
            block text-center text-xs font-bold text-blue-600
            hover:underline
          "
        >
          {th('seeFullCalendar')}
          {' '}
          →
        </Link>
      </div>
    </div>
  );
}
