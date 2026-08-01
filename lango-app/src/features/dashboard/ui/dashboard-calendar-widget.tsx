'use client';

import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Card } from '@/components/ui/card';

export type CalendarEventItem = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  type: 'vacation' | 'holiday' | 'exam' | 'event';
};

const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const WEEKDAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function DashboardCalendarWidget({
  events = [],
}: {
  events?: CalendarEventItem[];
}) {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const handleToday = () => setCurrentDate(new Date());

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startingDayOfWeek === -1) startingDayOfWeek = 6;

  const totalDaysInMonth = lastDayOfMonth.getDate();
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const days: { dayNumber: number; isCurrentMonth: boolean; iso: string }[] = [];

  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const prevDate = new Date(year, month - 1, d);
    days.push({
      dayNumber: d,
      isCurrentMonth: false,
      iso: prevDate.toISOString().slice(0, 10),
    });
  }

  for (let d = 1; d <= totalDaysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({
      dayNumber: d,
      isCurrentMonth: true,
      iso,
    });
  }

  const remainingCells = (7 - (days.length % 7)) % 7;
  for (let d = 1; d <= remainingCells; d++) {
    const nextDate = new Date(year, month + 1, d);
    days.push({
      dayNumber: d,
      isCurrentMonth: false,
      iso: nextDate.toISOString().slice(0, 10),
    });
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  const activeEvents: CalendarEventItem[] = events.length > 0
    ? events
    : [
        {
          id: 'v1',
          title: 'Vacances d\'Été',
          startDate: `${year}-07-01`,
          endDate: `${year}-08-31`,
          type: 'vacation',
        },
        {
          id: 'h1',
          title: 'Fête du Trône',
          startDate: `${year}-07-30`,
          endDate: `${year}-07-30`,
          type: 'holiday',
        },
      ];

  const getEventForDay = (iso: string) => {
    return activeEvents.find(e => iso >= e.startDate && iso <= e.endDate);
  };

  return (
    <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between h-full">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#DCEBF4] text-[#1B6C93]">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold text-[#16212B] uppercase tracking-wider">
              {MONTH_NAMES_FR[month]} {year}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">Calendrier Scolaire & Événements</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePrevMonth}
            type="button"
            className="p-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleToday}
            type="button"
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-bold text-slate-700 transition-colors"
          >
            Aujourd&apos;hui
          </button>
          <button
            onClick={handleNextMonth}
            type="button"
            className="p-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mt-3 text-center">
        {WEEKDAYS_FR.map(day => (
          <div key={day} className="text-[10px] font-extrabold text-slate-400 uppercase py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 gap-1 my-2">
        {days.map((item, idx) => {
          const isToday = item.iso === todayIso;
          const evt = getEventForDay(item.iso);

          return (
            <div
              key={idx}
              className={`
                min-h-[48px] p-1.5 rounded-xl border flex flex-col justify-between transition-colors
                ${item.isCurrentMonth ? 'bg-slate-50/60 border-slate-200/60' : 'bg-slate-50/20 border-slate-100 opacity-40'}
                ${isToday ? 'ring-2 ring-[#2487B8] border-transparent font-bold bg-blue-50/50' : ''}
              `}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isToday ? 'text-[#2487B8] font-extrabold' : 'text-slate-700'}`}>
                  {item.dayNumber}
                </span>
              </div>

              {evt && (
                <div
                  className={`
                    mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded truncate
                    ${evt.type === 'vacation' ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}
                  `}
                  title={evt.title}
                >
                  🌴 {evt.title}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer legend */}
      <div className="flex items-center gap-4 pt-3 border-t border-slate-100 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
          <span className="text-slate-600 font-medium">Vacances scolaires</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="text-slate-600 font-medium">Jours fériés</span>
        </div>
      </div>
    </Card>
  );
}
