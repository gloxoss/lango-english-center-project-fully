'use client';

import { ArrowUpRight, Building2, Globe, ShieldAlert } from 'lucide-react';
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

type SubscriptionAlert = { id: string; name: string; slug: string; subscriptionStatus: string; isActive: boolean };
type ExpiringLicenseAlert = { id: string; name: string; slug: string; licenseStatus: string; expiresAt: string | null };
type AlertsData = { subscriptionIssues: SubscriptionAlert[]; expiringLicenses: ExpiringLicenseAlert[] };

export function SuperAdminDashboardView({ locale }: { locale: string }) {
  const [summary, setSummary] = useState<SuperAdminSummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [alerts, setAlerts] = useState<AlertsData | null>(null);

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

    fetch('/api/addons/events/calendar')
      .then(r => r.json())
      .then((json) => {
        if (json.data) setCalendarEvents(json.data);
      })
      .catch(err => console.error('Failed loading calendar events', err));

    fetch('/api/super-admin/alerts')
      .then(r => r.json())
      .then((json) => {
        if (json.success) setAlerts(json.data);
      })
      .catch(err => console.error('Failed loading super-admin alerts', err));
  }, []);

  const schools = summary?.schools ?? [];
  const subscriptionIssues = alerts?.subscriptionIssues ?? [];
  const expiringLicenses = alerts?.expiringLicenses ?? [];
  const suspendedCount = subscriptionIssues.filter(s => s.subscriptionStatus === 'suspended').length;
  const cancelledCount = subscriptionIssues.filter(s => s.subscriptionStatus === 'cancelled' || !s.isActive).length;

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

      {/* Alerts panel */}
      {(subscriptionIssues.length > 0 || expiringLicenses.length > 0) && (
        <Card className="p-5 bg-white rounded-2xl border border-amber-200/80 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <h2 className="text-sm font-extrabold text-[#0F172A]">Alertes & Supervision</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {subscriptionIssues.length + expiringLicenses.length}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href={`/${locale}/dashboard/super-admin/schools?status=suspended`}
              className="p-4 rounded-xl border border-amber-200/70 bg-amber-50/50 hover:bg-amber-50 transition-colors"
            >
              <p className="text-2xl font-extrabold text-amber-700">{suspendedCount}</p>
              <p className="text-xs font-bold text-slate-600 mt-0.5">Abonnements suspendus</p>
            </Link>
            <Link
              href={`/${locale}/dashboard/super-admin/schools?status=cancelled`}
              className="p-4 rounded-xl border border-rose-200/70 bg-rose-50/50 hover:bg-rose-50 transition-colors"
            >
              <p className="text-2xl font-extrabold text-rose-600">{cancelledCount}</p>
              <p className="text-xs font-bold text-slate-600 mt-0.5">Abonnements annulés</p>
            </Link>
            <Link
              href={`/${locale}/dashboard/super-admin/subscriptions/list`}
              className="p-4 rounded-xl border border-blue-200/70 bg-blue-50/50 hover:bg-blue-50 transition-colors"
            >
              <p className="text-2xl font-extrabold text-[#0066FF]">{expiringLicenses.length}</p>
              <p className="text-xs font-bold text-slate-600 mt-0.5">Licences expirant / expirées</p>
            </Link>
          </div>

          <div className="space-y-2">
            {subscriptionIssues.slice(0, 4).map(s => (
              <Link
                key={s.id}
                href={`/${locale}/dashboard/super-admin/schools/${s.id}`}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-100 transition-colors"
              >
                <span className="text-xs font-bold text-[#0F172A]">{s.name}</span>
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${s.subscriptionStatus === 'suspended' ? 'bg-amber-100 text-amber-700' : s.subscriptionStatus === 'cancelled' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                  {s.subscriptionStatus === 'suspended' ? 'Suspendu' : s.subscriptionStatus === 'cancelled' ? 'Annulé' : 'Désactivée'}
                </span>
              </Link>
            ))}
            {expiringLicenses.slice(0, 4).map(l => (
              <Link
                key={l.id}
                href={`/${locale}/dashboard/super-admin/schools/${l.id}`}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-100 transition-colors"
              >
                <span className="text-xs font-bold text-[#0F172A]">{l.name}</span>
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${l.licenseStatus === 'expired' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                  {l.licenseStatus === 'expired' ? 'Licence expirée' : `Expire le ${l.expiresAt ? new Date(l.expiresAt).toLocaleDateString('fr-FR') : '—'}`}
                </span>
              </Link>
            ))}
            {subscriptionIssues.length + expiringLicenses.length > 8 && (
              <Link href={`/${locale}/dashboard/super-admin/subscriptions/list`} className="block text-center text-xs font-bold text-[#0066FF] hover:underline pt-1">
                Voir toutes les alertes ({subscriptionIssues.length + expiringLicenses.length}) <ArrowUpRight className="w-3 h-3 inline" />
              </Link>
            )}
          </div>
        </Card>
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
          <DashboardCalendarWidget events={calendarEvents} />
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
