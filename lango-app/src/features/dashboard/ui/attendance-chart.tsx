'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export type WeeklyTrendPoint = { date: string; rate: number | null };

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${DAY_LABELS[d.getDay()]} ${d.getDate()}`;
}

// ponytail: replaces a 295-line component that rendered three entirely fake
// datasets (7-day/30-day/quarterly, each split by a "cycle" - Primaire/Collège/
// Lycée - that isn't even a modeled column on `classes`). This renders exactly
// what src/app/api/dashboard/summary/route.ts's weeklyTrend actually computes:
// a real daily attendance rate for the last 7 days, nulls where nothing was
// marked that day.
export function AttendanceChart({ data }: { data: WeeklyTrendPoint[] }) {
  const hasAnyData = data.some(d => d.rate !== null);

  if (!hasAnyData) {
    return (
      <div className="
        flex h-[220px] items-center justify-center px-6 text-center
      "
      >
        <p className="text-xs font-medium text-slate-400">
          Aucune présence enregistrée sur les 7 derniers jours.
        </p>
      </div>
    );
  }

  const chartData = data.map(d => ({ label: formatDay(d.date), rate: d.rate }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="attendanceRate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2487B8" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#2487B8" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} width={36} />
        <Tooltip
          formatter={(value: unknown) => (value == null ? ['Aucune donnée', ''] : [`${value}%`, 'Présence'])}
          contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
        />
        <Area type="monotone" dataKey="rate" stroke="#2487B8" strokeWidth={2} fill="url(#attendanceRate)" connectNulls />
      </AreaChart>
    </ResponsiveContainer>
  );
}
