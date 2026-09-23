'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Calendar, Cake, Clock } from 'lucide-react';
import type { UpcomingEventItem } from '../model/types';

interface UpcomingEventsCardProps {
  events: UpcomingEventItem[];
  todayBirthdaysCount: number;
  birthdaysPreview: string[];
  locale: string;
}

export function UpcomingEventsCard({
  events,
  todayBirthdaysCount,
  birthdaysPreview,
  locale,
}: UpcomingEventsCardProps) {
  const timingGroupLabels: Record<UpcomingEventItem['timingGroup'], string> = {
    today: "Aujourd'hui",
    tomorrow: 'Demain',
    this_week: 'Cette semaine',
  };

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Calendar className="size-4" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">À venir</h3>
          </div>
          <Link
            href={`/${locale}/dashboard/events`}
            className="flex items-center gap-1 text-xs font-bold text-blue-600 transition hover:text-blue-800 hover:underline"
          >
            <span>Voir calendrier</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {/* Compact Birthday Pill */}
        {todayBirthdaysCount > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-purple-100 bg-purple-50/60 p-2.5 text-xs text-purple-900">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-lg bg-purple-200 text-purple-700">
                <Cake className="size-3.5" />
              </span>
              <span>
                <strong className="font-bold">{todayBirthdaysCount} anniversaire{todayBirthdaysCount > 1 ? 's' : ''}</strong> aujourd’hui
                {birthdaysPreview.length > 0 && (
                  <span className="text-purple-700 font-medium"> ({birthdaysPreview.join(', ')})</span>
                )}
              </span>
            </div>
            <span className="rounded-full bg-purple-200/80 px-2 py-0.5 text-[10px] font-extrabold text-purple-800">
              Fête
            </span>
          </div>
        )}

        {/* Events List */}
        <div className="mt-3.5 space-y-2">
          {events.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-400">
              Aucun événement planifié pour les prochains jours
            </div>
          ) : (
            events.slice(0, 5).map(event => (
              <div
                key={event.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3 transition hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <p className="truncate text-xs font-bold text-slate-900">
                    {event.title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {event.startDate}
                    </span>
                    {event.location && <span>• {event.location}</span>}
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                    event.timingGroup === 'today'
                      ? 'bg-blue-100 text-blue-800'
                      : event.timingGroup === 'tomorrow'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200/80 text-slate-700'
                  }`}
                >
                  {timingGroupLabels[event.timingGroup]}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <Link
          href={`/${locale}/dashboard/events`}
          className="block text-center text-xs font-bold text-blue-600 hover:underline"
        >
          Voir le calendrier complet →
        </Link>
      </div>
    </div>
  );
}
