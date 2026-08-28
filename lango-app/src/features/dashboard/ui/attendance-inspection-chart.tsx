'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';

export type AttendanceInspectionPoint = {
  date: string;
  studentRate: number | null;
  employeeRate: number | null;
};

export function AttendanceInspectionChart({ data }: { data: AttendanceInspectionPoint[] }) {
  const t = useTranslations('Dashboard');
  const hasData = data.some(d => d.studentRate !== null || d.employeeRate !== null);

  return (
    <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
        <div>
          <h3 className="text-xs font-extrabold tracking-wide text-[#16212B] uppercase">
            {t('attendanceInspectionTitle')}
          </h3>
          <p className="text-[11px] text-slate-400 font-medium">{t('attendanceInspectionSubtitle')}</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0EA5C4]" />
            <span className="text-slate-600 font-semibold text-[11px]">{t('attendanceInspectionStudents')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F43F5E]" />
            <span className="text-slate-600 font-semibold text-[11px]">{t('attendanceInspectionStaff')}</span>
          </div>
        </div>
      </div>

      <div className="my-3 min-h-[200px]">
        {!hasData ? (
          <div className="flex h-[200px] items-center justify-center text-center">
            <p className="text-xs font-semibold text-slate-400">
              {t('attendanceInspectionEmpty')}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(val: unknown) => [val != null ? `${val}%` : 'N/A', '']}
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: '#E2E8F0',
                  borderRadius: 12,
                  color: '#16212B',
                  fontSize: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                }}
              />
              <Bar dataKey="studentRate" name={t('attendanceInspectionStudents')} fill="#0EA5C4" radius={[4, 4, 0, 0]} />
              <Bar dataKey="employeeRate" name={t('attendanceInspectionStaff')} fill="#F43F5E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
