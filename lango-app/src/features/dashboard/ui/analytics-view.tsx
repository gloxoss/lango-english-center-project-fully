'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  Users,
  GraduationCap,
  CalendarCheck,
  AlertCircle,
} from 'lucide-react';

type ApiAnalytics = {
  totalStudents: number;
  totalTeachers: number;
  activeClasses: number;
  attendanceRate30d: number | null;
  enrollmentTrend: { month: string; newStudents: number }[];
  revenueTrend: { month: string; invoiced: number; collected: number; expenses: number }[];
};

const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function formatMonth(iso: string): string {
  const [, m] = iso.split('-');
  return MONTH_LABELS[Number.parseInt(m ?? '1', 10) - 1] ?? iso;
}

export function AnalyticsView() {
  const [data, setData] = useState<ApiAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/analytics');
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.message || 'Échec du chargement.');
          return;
        }
        setData(json.data);
      } catch (err) {
        console.error('Failed loading analytics', err);
        setError('Connexion impossible. Vérifiez votre réseau.');
      }
    }
    load();
  }, []);

  if (error) {
    return (
      <div className="max-w-[1600px] mx-auto p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  const enrollmentChart = (data?.enrollmentTrend ?? []).map(d => ({ label: formatMonth(d.month), newStudents: d.newStudents }));
  const revenueChart = (data?.revenueTrend ?? []).map(d => ({ label: formatMonth(d.month), Facturé: d.invoiced, Encaissé: d.collected, Dépenses: d.expenses }));

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="pb-3 border-b border-slate-200/80">
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Analytique & Croissance</h1>
        <p className="text-xs text-slate-500 font-medium mt-1">Indicateurs clés sur les 6 derniers mois</p>
      </div>

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="w-9 h-9 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
            <Users className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Élèves inscrits</p>
            <p className="text-3xl font-extrabold text-[#16212B] tracking-tight mt-0.5">{data?.totalStudents ?? '—'}</p>
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="w-9 h-9 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
            <GraduationCap className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Enseignants</p>
            <p className="text-3xl font-extrabold text-[#16212B] tracking-tight mt-0.5">{data?.totalTeachers ?? '—'}</p>
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="w-9 h-9 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
            <Users className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Classes actives</p>
            <p className="text-3xl font-extrabold text-[#16212B] tracking-tight mt-0.5">{data?.activeClasses ?? '—'}</p>
          </div>
        </Card>

        <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="w-9 h-9 rounded-full bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center">
            <CalendarCheck className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500">Présence (30j)</p>
            <p className="text-3xl font-extrabold text-[#16212B] tracking-tight mt-0.5">{data?.attendanceRate30d !== null && data?.attendanceRate30d !== undefined ? `${data.attendanceRate30d}%` : '—'}</p>
          </div>
        </Card>
      </div>

      {/* Enrollment Trend */}
      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <div>
          <h3 className="text-base font-extrabold text-[#16212B]">Nouvelles inscriptions</h3>
          <p className="text-xs text-slate-500">Élèves créés par mois, 6 derniers mois</p>
        </div>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={enrollmentChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="enrollmentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2487B8" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2487B8" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="newStudents" name="Nouveaux élèves" stroke="#2487B8" strokeWidth={3} fill="url(#enrollmentGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Revenue vs Expenses */}
      <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <div>
          <h3 className="text-base font-extrabold text-[#16212B]">Facturé, encaissé et dépenses</h3>
          <p className="text-xs text-slate-500">Par mois, 6 derniers mois (MAD)</p>
        </div>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Facturé" fill="#DCEBF4" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Encaissé" fill="#2487B8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Dépenses" fill="#E5544B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
