'use client';

import {
  Building2,
  CalendarCheck,
  CreditCard,
  DoorOpen,
  GraduationCap,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';

export type StrengthMetricsData = {
  totalEmployees: number;
  totalStudents: number;
  totalParents: number;
  totalTeachers: number;
  admissions30Days: number;
  vouchersCount: number;
  activeClassesCount: number;
  totalSectionsCount: number;
};

export function StrengthMetricCards({ data }: { data: StrengthMetricsData }) {
  const t = useTranslations('Dashboard');
  const topMetrics = [
    {
      label: t('metricStaff'),
      count: data.totalEmployees,
      badge: t('badgeTotalCount'),
      icon: UserCheck,
      iconBg: 'bg-[#DCEBF4]',
      iconColor: 'text-[#1B6C93]',
    },
    {
      label: t('metricStudents'),
      count: data.totalStudents,
      badge: t('badgeTotalCount'),
      icon: GraduationCap,
      iconBg: 'bg-[#0EA5C4]/10',
      iconColor: 'text-[#0EA5C4]',
    },
    {
      label: t('metricParents'),
      count: data.totalParents,
      badge: t('badgeTotalCount'),
      icon: Users,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
    },
    {
      label: t('metricTeachers'),
      count: data.totalTeachers,
      badge: t('badgeTotalCount'),
      icon: Building2,
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-700',
    },
  ];

  const bottomMetrics = [
    {
      label: t('metricAdmissions'),
      count: data.admissions30Days,
      badge: t('badgeLast30Days'),
      icon: UserPlus,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: t('metricInvoices'),
      count: data.vouchersCount,
      badge: t('badgeTotalIssued'),
      icon: CreditCard,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: t('metricActiveClasses'),
      count: data.activeClassesCount,
      badge: t('badgeManagedClasses'),
      icon: CalendarCheck,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
    },
    {
      label: t('metricSections'),
      count: data.totalSectionsCount,
      badge: t('badgeAssignmentRooms'),
      icon: DoorOpen,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Primary Strength Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {topMetrics.map(item => (
          <Card key={item.label} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{item.label}</p>
                <p className="text-2xl font-black text-[#16212B] mt-1">{item.count}</p>
              </div>
              <div className={`w-11 h-11 rounded-xl ${item.iconBg} ${item.iconColor} flex items-center justify-center`}>
                <item.icon className="w-5.5 h-5.5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                {item.badge}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#2487B8]" />
            </div>
          </Card>
        ))}
      </div>

      {/* Operational Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {bottomMetrics.map(item => (
          <Card key={item.label} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${item.iconBg} ${item.iconColor} flex items-center justify-center shrink-0`}>
                <item.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#16212B]">{item.label}</p>
                <p className="text-[11px] text-slate-400 font-medium">{item.badge}</p>
              </div>
            </div>
            <span className="text-xl font-extrabold text-[#16212B]">{item.count}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
