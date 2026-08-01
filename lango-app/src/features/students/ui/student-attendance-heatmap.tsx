'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

type HeatmapRecord = { date: string; status: 'present' | 'absent' | 'late' | 'excused'; lateMinutes: number | null };

const STATUS_STYLES: Record<HeatmapRecord['status'], string> = {
  present: 'bg-[#DCEBF4] text-[#1B6C93]',
  late: 'bg-[#FCF0DC] text-[#E8A33D]',
  absent: 'bg-[#FCE4E2] text-[#E5544B]',
  excused: 'bg-[#F3E8FF] text-purple-700',
};

const STATUS_LABELS: Record<HeatmapRecord['status'], string> = {
  present: 'Présent',
  late: 'Retard',
  absent: 'Absent',
  excused: 'Excusé',
};

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(year, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number) as [number, number];
  return new Date(year, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export function StudentAttendanceHeatmap({ studentId }: { studentId: string }) {
  const [month, setMonth] = useState(currentMonth());
  const [records, setRecords] = useState<HeatmapRecord[]>([]);
  const [daysInMonth, setDaysInMonth] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/attendance/heatmap?studentId=${studentId}&month=${month}`);
        const json = await res.json();
        if (!cancelled && json.success) {
          setRecords(json.data.records);
          setDaysInMonth(json.data.daysInMonth);
        }
      } catch (err) {
        console.error('Failed loading attendance heatmap', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [studentId, month]);

  const [year, m] = month.split('-').map(Number) as [number, number];
  const recordByDate = new Map(records.map(r => [r.date, r]));
  const firstDayOffset = (new Date(year, m - 1, 1).getDay() + 6) % 7; // Monday-first grid
  const cells: { date: string | null; status: HeatmapRecord['status'] | null; lateMinutes: number | null; isWeekend: boolean }[] = [];

  for (let i = 0; i < firstDayOffset; i++) {
    cells.push({ date: null, status: null, lateMinutes: null, isWeekend: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`;
    const dow = new Date(year, m - 1, day).getDay();
    const record = recordByDate.get(dateStr);
    cells.push({ date: dateStr, status: record?.status ?? null, lateMinutes: record?.lateMinutes ?? null, isWeekend: dow === 0 || dow === 6 });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setMonth(prev => shiftMonth(prev, -1))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-xs font-bold text-[#16212B] capitalize">{monthLabel(month)}</p>
        <button type="button" onClick={() => setMonth(prev => shiftMonth(prev, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {loading
        ? <p className="text-xs text-slate-400 text-center py-6">Chargement...</p>
        : (
            <>
              <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-slate-400">
                {WEEKDAY_LABELS.map((d, i) => <span key={`${d}-${i}`}>{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {cells.map((cell, i) => (
                  <div
                    key={cell.date ?? `empty-${i}`}
                    title={cell.date && cell.status ? `${cell.date}: ${STATUS_LABELS[cell.status]}${cell.status === 'late' && cell.lateMinutes ? ` (${cell.lateMinutes} min)` : ''}` : (cell.date ?? undefined)}
                    className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold ${
                      !cell.date
                        ? ''
                        : cell.status
                          ? STATUS_STYLES[cell.status]
                          : cell.isWeekend
                            ? 'bg-[#F1F5F9] text-slate-300'
                            : 'bg-slate-50 text-slate-300'
                    }`}
                  >
                    {cell.date ? Number(cell.date.slice(-2)) : ''}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] font-semibold text-slate-500">
                {(['present', 'late', 'absent', 'excused'] as const).map(status => (
                  <span key={status} className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${STATUS_STYLES[status]}`} />
                    {STATUS_LABELS[status]}
                  </span>
                ))}
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F1F5F9]" />
                  Weekend
                </span>
              </div>
            </>
          )}
    </div>
  );
}
