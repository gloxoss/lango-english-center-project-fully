'use client';

import { ArrowUpRight, Building2, Globe } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { AnnualFeeSummaryChart, type MonthlyFeePoint } from '@/features/dashboard/ui/annual-fee-summary-chart';
import { AttendanceInspectionChart, type AttendanceInspectionPoint } from '@/features/dashboard/ui/attendance-inspection-chart';
import { BirthdayTrackerWidget } from '@/features/dashboard/ui/birthday-tracker-widget';
import { DashboardCalendarWidget } from '@/features/dashboard/ui/dashboard-calendar-widget';
import { IncomeExpenseDonut, type IncomeExpenseData } from '@/features/dashboard/ui/income-expense-donut';
import { StrengthMetricCards } from '@/features/dashboard/ui/strength-metric-cards';
import { StudentQuantityDonut, type StudentDistributionItem } from '@/features/dashboard/ui/student-quantity-donut';

type ApiSchool = { id: string; name: string; planTier: string; subscriptionStatus: string; isActive: boolean; userCount: number };

type SuperAdminSummaryData = {
  totalSchools: number;
  activeSchools: number;
  schools: ApiSchool[];
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
  totalEmployees: number;
  admissions30Days: number;
  vouchersCount: number;
  activeClassesCount: number;
  totalSectionsCount: number;
  globalIncomeVsExpense: IncomeExpenseData;
  globalAnnualFeeSummary: MonthlyFeePoint[];
  studentQuantityByBranch: StudentDistributionItem[];
  globalWeeklyAttendanceInspection: AttendanceInspectionPoint[];
};

export function SuperAdminDashboardView({ locale }: { locale: string }) {
  const [summary, setSummary] = useState<SuperAdminSummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/super-admin/summary')
      .then(r => r.json())
      .then((json) => {
        if (json.success) setSummary(json.data);
        else setError(json.message || 'Erreur lors du chargement de la synthèse.');
      })
      .catch(err => {
        console.error('Failed loading super-admin summary', err);
        setError('Connexion au serveur impossible.');
      });
  }, []);

  const schools = summary?.schools ?? [];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header Bar */}
      <div className="pb-3 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
              Tableau de bord Plateforme (All Branch Dashboard)
            </h1>
            <span className="rounded-full bg-blue-100 text-blue-700 font-extrabold text-xs px-3 py-1 border border-blue-200 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> Super Admin Global
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Vue d&apos;ensemble consolidée de tous les établissements clients sur SchoolOS.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
          {error}
        </div>
      )}

      {/* 1. All Branch Strength Cards (8 Metric Grid) */}
      <StrengthMetricCards
        data={{
          totalEmployees: summary?.totalEmployees ?? 0,
          totalStudents: summary?.totalStudents ?? 0,
          totalParents: summary?.totalParents ?? 0,
          totalTeachers: summary?.totalTeachers ?? 0,
          admissions30Days: summary?.admissions30Days ?? 0,
          vouchersCount: summary?.vouchersCount ?? 0,
          activeClassesCount: summary?.activeClassesCount ?? 0,
          totalSectionsCount: summary?.totalSectionsCount ?? 0,
        }}
      />

      {/* 2. Top Charts Row: Global Financial Donut & Global Annual Fee Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 min-h-[360px]">
          <IncomeExpenseDonut
            data={summary?.globalIncomeVsExpense ?? { collected: 0, remaining: 0, invoiced: 0 }}
            monthName="Toutes Écoles"
          />
        </div>
        <div className="lg:col-span-8 min-h-[360px]">
          <AnnualFeeSummaryChart data={summary?.globalAnnualFeeSummary ?? []} />
        </div>
      </div>

      {/* 3. Middle Charts Row: Student Quantity by Branch Donut & Global Attendance Inspection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 min-h-[350px]">
          <StudentQuantityDonut
            data={summary?.studentQuantityByBranch ?? []}
            title="Student Quantity (Par Établissement)"
          />
        </div>
        <div className="lg:col-span-8 min-h-[350px]">
          <AttendanceInspectionChart
            data={summary?.globalWeeklyAttendanceInspection ?? []}
          />
        </div>
      </div>

      {/* 4. Bottom Row: Interactive Platform Calendar & Birthday Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 min-h-[420px]">
          <DashboardCalendarWidget />
        </div>
        <div className="lg:col-span-4 min-h-[420px]">
          <BirthdayTrackerWidget />
        </div>
      </div>

      {/* Client Schools Overview Table */}
      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-extrabold text-[#0F172A]">Écoles Clients Récentes</h3>
          <Link href={`/${locale}/dashboard/super-admin/schools`} className="text-xs font-bold text-[#0066FF] flex items-center gap-1 hover:underline">
            Gérer toutes les écoles ({schools.length}) <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="space-y-2">
          {schools.length === 0 && <p className="text-xs text-slate-400">Aucune école pour le moment.</p>}
          {schools.slice(0, 6).map(s => (
            <Link key={s.id} href={`/${locale}/dashboard/super-admin/schools/${s.id}`} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#0F172A]">{s.name}</p>
                  <p className="text-[10px] font-semibold text-slate-400">Formule: {s.planTier.toUpperCase()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500">{s.userCount} utilisateurs</span>
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${s.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {s.isActive ? 'Actif' : 'Inactif'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
