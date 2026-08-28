'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';

export type MonthlyFeePoint = {
  month: string;
  total: number;
  collected: number;
  remaining: number;
};

function formatMadShort(val: number): string {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${Math.round(val / 1000)}k`;
  return `${Math.round(val)}`;
}

export function AnnualFeeSummaryChart({ data }: { data: MonthlyFeePoint[] }) {
  const t = useTranslations('Dashboard');
  const hasData = data.some(d => d.total > 0 || d.collected > 0);

  return (
    <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
        <div>
          <h3 className="text-xs font-extrabold tracking-wide text-[#16212B] uppercase">
            {t('annualFeeTitle')}
          </h3>
          <p className="text-[11px] text-slate-400 font-medium">{t('annualFeeSubtitle')}</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E11D48]" />
            <span className="text-slate-600 font-semibold text-[11px]">{t('annualFeeTotal')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2487B8]" />
            <span className="text-slate-600 font-semibold text-[11px]">{t('annualFeeCollected')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
            <span className="text-slate-600 font-semibold text-[11px]">{t('incomeRemainingDue')}</span>
          </div>
        </div>
      </div>

      <div className="my-3 min-h-[220px]">
        {!hasData ? (
          <div className="flex h-[220px] items-center justify-center text-center">
            <p className="text-xs font-semibold text-slate-400">
              {t('annualFeeEmpty')}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E11D48" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#E11D48" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2487B8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2487B8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRemaining" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={val => formatMadShort(Number(val))}
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(val: unknown) => [`${Math.round(Number(val)).toLocaleString('fr-FR')} MAD`, '']}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E2E8F0',
                  borderRadius: 12,
                  color: '#16212B',
                  fontSize: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                }}
              />
              <Area type="monotone" dataKey="total" name={t('annualFeeTotal')} stroke="#E11D48" strokeWidth={2} fill="url(#colorTotal)" />
              <Area type="monotone" dataKey="collected" name={t('annualFeeCollected')} stroke="#2487B8" strokeWidth={2} fill="url(#colorCollected)" />
              <Area type="monotone" dataKey="remaining" name={t('incomeRemainingDue')} stroke="#F59E0B" strokeWidth={2} fill="url(#colorRemaining)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
