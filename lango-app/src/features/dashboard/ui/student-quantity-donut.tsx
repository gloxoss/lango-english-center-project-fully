'use client';

import { School } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card } from '@/components/ui/card';

export type StudentDistributionItem = {
  name: string;
  count: number;
};

const CYCLE_COLORS = ['#2487B8', '#0EA5C4', '#F59E0B', '#8B5CF6', '#EC4899', '#10B981'];

export function StudentQuantityDonut({
  data,
  title = 'Répartition des Élèves (Student Quantity)',
}: {
  data: StudentDistributionItem[];
  title?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between h-full">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-xs font-extrabold tracking-wide text-[#16212B] uppercase">
            {title}
          </h3>
          <p className="text-[11px] text-slate-400 font-medium">Distribution par classe / niveau</p>
        </div>
        <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center">
          <School className="w-4 h-4" />
        </div>
      </div>

      <div className="relative my-4 flex items-center justify-center min-h-[200px]">
        {total > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="count"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CYCLE_COLORS[index % CYCLE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(val: unknown) => [`${val} Élèves`, '']}
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
            <p className="text-xs font-semibold">Aucun élève répertorié.</p>
          </div>
        )}

        <div className="absolute flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Effectif</span>
          <span className="text-lg font-black text-[#16212B]">{total}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs max-h-[80px] overflow-y-auto">
        {data.map((item, idx) => (
          <div key={item.name} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: CYCLE_COLORS[idx % CYCLE_COLORS.length] }}
            />
            <div className="truncate">
              <p className="text-[10px] text-slate-400 font-medium truncate">{item.name}</p>
              <p className="text-xs font-bold text-[#16212B]">{item.count}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
