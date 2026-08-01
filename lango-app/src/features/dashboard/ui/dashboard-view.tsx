'use client';

import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AnnualFeeSummaryChart, type MonthlyFeePoint } from './annual-fee-summary-chart';
import { AttendanceInspectionChart, type AttendanceInspectionPoint } from './attendance-inspection-chart';
import { BirthdayTrackerWidget, type BirthdayPerson } from './birthday-tracker-widget';
import { DashboardCalendarWidget } from './dashboard-calendar-widget';
import { IncomeExpenseDonut, type IncomeExpenseData } from './income-expense-donut';
import { StrengthMetricCards } from './strength-metric-cards';
import { StudentQuantityDonut, type StudentDistributionItem } from './student-quantity-donut';

type AtRiskStudent = {
  id: string;
  name: string;
  className: string;
  indicators: number;
  riskLevel: string;
  badge: 'danger' | 'warning';
};

type FullDashboardSummary = {
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
  totalEmployees: number;
  admissions30Days: number;
  vouchersCount: number;
  activeClassesCount: number;
  totalSectionsCount: number;
  todayAttendance: { presentCount: number; absentCount: number; totalMarked: number; rate: number } | null;
  weeklyTrend: { date: string; rate: number | null }[];
  incomeVsExpense: IncomeExpenseData;
  annualFeeSummary: MonthlyFeePoint[];
  studentQuantityByLevel: StudentDistributionItem[];
  weeklyAttendanceInspection: AttendanceInspectionPoint[];
  recentPayments: { studentName: string; className: string; amount: number; date: string }[];
  overdueInvoicesCount: number;
  unjustifiedAbsencesToday: number;
  atRiskStudents: AtRiskStudent[];
  todayBirthdays?: {
    studentBirthdays: BirthdayPerson[];
    employeeBirthdays: BirthdayPerson[];
  };
};

function formatMad(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} MAD`;
}

export function DashboardView({ locale }: { locale: string }) {
  const router = useRouter();
  const [pendingNav, setPendingNav] = useState<{ title: string; route: string } | null>(null);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [summary, setSummary] = useState<FullDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/dashboard/summary');
        if (res.ok) {
          const json = await res.json();
          setSummary(json.data);
        }
      } catch (err) {
        console.error('Failed to load dashboard summary', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleConfirmNav = () => {
    if (dontShowAgain && typeof window !== 'undefined') {
      localStorage.setItem('lango_skip_card_confirm', 'true');
    }
    if (pendingNav) {
      const target = pendingNav.route;
      setPendingNav(null);
      router.push(target);
    }
  };

  const statusBanners = summary
    ? [
        {
          id: 'attendance',
          title: summary.todayAttendance ? `Présence du jour : ${summary.todayAttendance.rate}%` : 'Aucune présence pointée aujourd\'hui',
          sub: summary.todayAttendance ? `${summary.todayAttendance.presentCount}/${summary.todayAttendance.totalMarked} élèves présents` : 'Utilisez le module Présence pour commencer',
          icon: CheckCircle2,
          route: `/${locale}/dashboard/attendance`,
        },
        {
          id: 'overdue',
          title: `${summary.overdueInvoicesCount} facture${summary.overdueInvoicesCount === 1 ? '' : 's'} en retard`,
          sub: summary.overdueInvoicesCount > 0 ? 'Actions requises' : 'Aucun retard de paiement',
          icon: Lock,
          route: `/${locale}/dashboard/finance/invoices`,
        },
        {
          id: 'absences',
          title: `${summary.unjustifiedAbsencesToday} absence${summary.unjustifiedAbsencesToday === 1 ? '' : 's'} non justifiée${summary.unjustifiedAbsencesToday === 1 ? '' : 's'}`,
          sub: 'Aujourd\'hui',
          icon: AlertTriangle,
          route: `/${locale}/dashboard/attendance`,
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      {/* Top Header Bar Title & Quick Actions */}
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">
              Tableau de bord Établissement
            </h1>
            <span className="rounded-full bg-[#0EA5C4]/10 px-3 py-1 text-xs font-bold text-[#0EA5C4] border border-[#0EA5C4]/20">
              Icon School & College Branch Dashboard
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Aperçu analytique, finances, assiduité et calendrier de votre école.
          </p>
        </div>
      </div>

      {/* Status Health Banners */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {statusBanners.map(b => (
          <Link
            key={b.id}
            href={b.route}
            className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-100 text-[#2487B8]">
                <b.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#16212B]">{b.title}</p>
                <p className="text-[11px] text-slate-400 font-medium">{b.sub}</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-400" />
          </Link>
        ))}
      </div>

      {/* 1. Ramom School Strength Metric Cards (8 Cards Grid) */}
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

      {/* 2. Top Charts Row: Income vs Expense Donut & Annual Fee Summary Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 min-h-[360px]">
          <IncomeExpenseDonut
            data={summary?.incomeVsExpense ?? { collected: 0, remaining: 0, invoiced: 0 }}
          />
        </div>
        <div className="lg:col-span-8 min-h-[360px]">
          <AnnualFeeSummaryChart data={summary?.annualFeeSummary ?? []} />
        </div>
      </div>

      {/* 3. Middle Charts Row: Student Quantity Donut & Attendance Inspection Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 min-h-[350px]">
          <StudentQuantityDonut
            data={summary?.studentQuantityByLevel ?? []}
            title="Student Quantity (Par Niveau)"
          />
        </div>
        <div className="lg:col-span-8 min-h-[350px]">
          <AttendanceInspectionChart
            data={summary?.weeklyAttendanceInspection ?? []}
          />
        </div>
      </div>

      {/* 4. Bottom Row: Interactive Calendar & Birthday Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 min-h-[420px]">
          <DashboardCalendarWidget />
        </div>
        <div className="lg:col-span-4 min-h-[420px]">
          <BirthdayTrackerWidget
            studentBirthdays={summary?.todayBirthdays?.studentBirthdays}
            employeeBirthdays={summary?.todayBirthdays?.employeeBirthdays}
          />
        </div>
      </div>

      {/* Recent Activity Feeds & At-Risk Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions Feed */}
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-[#16212B]">Paiements récents</h3>
            <Link
              href={`/${locale}/dashboard/finance/invoices`}
              className="text-xs font-bold text-[#2487B8] flex items-center gap-1 hover:underline"
            >
              Voir tout <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {!summary?.recentPayments || summary.recentPayments.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Aucun paiement enregistré.</p>
            ) : (
              summary.recentPayments.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-xs font-bold text-[#16212B]">{p.studentName}</p>
                    <p className="text-[10px] text-slate-400">{p.className} • {p.date}</p>
                  </div>
                  <span className="text-xs font-extrabold text-emerald-600">+{formatMad(p.amount)}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* At Risk Students */}
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-[#16212B]">Élèves à surveiller / Vigilance</h3>
            <Link
              href={`/${locale}/dashboard/students`}
              className="text-xs font-bold text-[#2487B8] flex items-center gap-1 hover:underline"
            >
              Voir le répertoire <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {!summary?.atRiskStudents || summary.atRiskStudents.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Aucune alerte élève pour le moment.</p>
            ) : (
              summary.atRiskStudents.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-xs font-bold text-[#16212B]">{s.name}</p>
                    <p className="text-[10px] text-slate-400">{s.className}</p>
                  </div>
                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                      s.badge === 'danger'
                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {s.riskLevel}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Navigation Confirm Dialog */}
      <Dialog open={Boolean(pendingNav)} onOpenChange={open => !open && setPendingNav(null)}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">
              Accéder au module
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Voulez-vous ouvrir {pendingNav?.title} ?
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2 py-2">
            <Checkbox id="skipConfirm" checked={dontShowAgain} onCheckedChange={c => setDontShowAgain(Boolean(c))} />
            <label htmlFor="skipConfirm" className="text-xs font-medium text-slate-600">
              Ne plus demander confirmation
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setPendingNav(null)} className="rounded-xl">
              Annuler
            </Button>
            <Button size="sm" onClick={handleConfirmNav} className="rounded-xl bg-[#2487B8] hover:bg-[#1B6C93]">
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
