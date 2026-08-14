'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ColumnDefinition } from '../../types/reporting-types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export function ReportChart({
  columns,
  data,
}: {
  columns: ColumnDefinition[];
  data: Record<string, any>[];
}) {
  if (!data || data.length === 0) {
    return null;
  }

  const xAxisKey = columns[0]?.key || '';
  const yAxisKey =
    columns.find((c) => c.type === 'number' || c.type === 'currency' || c.type === 'percentage')?.key ||
    columns[1]?.key ||
    '';

  return (
    <Card className="hover:border-slate-300 transition-all">
      <CardHeader className="border-b-0 pb-2 flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#E4EDFD] text-[#2487B8]">
            <BarChart3 className="h-4 w-4" />
          </div>
          <CardTitle className="text-xs font-bold text-slate-800">
            Visualisation Graphique Interactive
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey={xAxisKey} tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  fontSize: '11px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  fontFamily: 'Inter, sans-serif',
                }}
              />
              <Bar dataKey={yAxisKey} fill="#2487B8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
