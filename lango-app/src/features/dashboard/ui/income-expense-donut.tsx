'use client';

import { Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/components/ui/card';

export type IncomeExpenseData = {
  collected: number;
  remaining: number;
  invoiced: number;
};

const COLORS = ['#2487B8', '#F43F5E'];

function formatMad(val: number): string {
  return `${Math.round(val).toLocaleString('fr-FR')} MAD`;
}

export function IncomeExpenseDonut({
  data,
  monthName,
}: {
  data: IncomeExpenseData;
  monthName?: string;
}) {
  const t = useTranslations('Dashboard');
  const resolvedMonth = monthName ?? t('incomeDefaultMonth');
  const chartData = [
    { name: t('incomeCollected'), value: Math.max(0, data.collected) },
    { name: t('incomeRemaining'), value: Math.max(0, data.remaining) },
  ];

  const total = data.invoiced > 0 ? data.invoiced : data.collected + data.remaining;
  const hasData = total > 0;

  return (
    <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between h-full">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-xs font-extrabold tracking-wide text-[#16212B] uppercase">
            {t('incomeTitle', { monthName: resolvedMonth })}
          </h3>
          <p className="text-[11px] text-slate-400 font-medium">{t('incomeSubtitle')}</p>
        </div>
        <div className="w-8 h-8 rounded-xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
          <Wallet className="w-4 h-4" />
        </div>
      </div>

      <div className="relative my-4 flex items-center justify-center min-h-[200px]">
        {hasData ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={82}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(val: unknown) => [formatMad(Number(val)), '']}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E2E8F0',
                  borderRadius: 12,
                  color: '#16212B',
                  fontSize: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-400">
            <p className="text-xs font-semibold">{t('incomeNoInvoices')}</p>
          </div>
        )}

        <div className="absolute flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('incomeFactured')}</span>
          <span className="text-base font-black text-[#16212B]">{formatMad(total)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#2487B8]" />
          <div>
            <p className="text-[10px] text-slate-400 font-medium">{t('incomeCollectedShort')}</p>
            <p className="text-xs font-bold text-[#16212B]">{formatMad(data.collected)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F43F5E]" />
          <div>
            <p className="text-[10px] text-slate-400 font-medium">{t('incomeRemainingDue')}</p>
            <p className="text-xs font-bold text-[#16212B]">{formatMad(data.remaining)}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
