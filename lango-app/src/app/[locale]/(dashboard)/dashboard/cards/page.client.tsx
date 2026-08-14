'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IdCard, Layers, Users, UserCheck, ClipboardList, FileCheck2, Loader2, ArrowRight, FileX2 } from 'lucide-react';

type Overview = {
  templates: { total: number; published: number };
  issued: Record<string, number>;
  issuedTotal: number;
  jobs: Record<string, number>;
  recent: Array<{
    id: string;
    type: 'student_id' | 'employee_id' | 'admit_card';
    subjectType: string;
    status: string;
    issuedAt: string;
  }>;
};

const TYPE_LABELS: Record<string, string> = {
  student_id: 'Carte d\'étudiant',
  employee_id: 'Carte d\'employé',
  admit_card: 'Convocation d\'examen',
};

const STATUS_BADGE: Record<string, { label: string, variant: 'neutral' | 'success' | 'danger' | 'warning' }> = {
  active: { label: 'Active', variant: 'success' },
  revoked: { label: 'Révoquée', variant: 'danger' },
  expired: { label: 'Expirée', variant: 'warning' },
  replaced: { label: 'Remplacée', variant: 'neutral' },
};

export default function CardsOverviewPage() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';

  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/cards/overview')
      .then(r => r.json())
      .then(j => { if (j.success) setData(j.data); })
      .finally(() => setLoading(false));
  }, []);

  const issuedActive = data?.issued?.active ?? 0;
  const issuedRevoked = data?.issued?.revoked ?? 0;
  const jobsTotal = Object.values(data?.jobs ?? {}).reduce((a, b) => a + b, 0);

  const statCards = [
    { label: 'Modèles', value: data?.templates.total ?? 0, sub: `${data?.templates.published ?? 0} publiés`, icon: Layers, tint: 'bg-blue-50 text-[#2487B8]' },
    { label: 'Cartes actives', value: issuedActive, sub: 'documents émis valides', icon: FileCheck2, tint: 'bg-emerald-50 text-emerald-600' },
    { label: 'Révoquées', value: issuedRevoked, sub: 'cartes invalidées', icon: FileX2, tint: 'bg-rose-50 text-rose-500' },
    { label: 'Lots', value: jobsTotal, sub: 'émissions en lot', icon: ClipboardList, tint: 'bg-cyan-50 text-[#0EA5C4]' },
  ];

  const quickLinks = [
    { label: 'Élèves', href: `/${locale}/dashboard/cards/students`, desc: 'Émettre des cartes d\'étudiant', icon: Users },
    { label: 'Employés', href: `/${locale}/dashboard/cards/employees`, desc: 'Émettre des cartes d\'employé', icon: UserCheck },
    { label: 'Convocations', href: `/${locale}/dashboard/cards/admit-cards`, desc: 'Cartes d\'examen par salle', icon: IdCard },
    { label: 'Documents émis', href: `/${locale}/dashboard/cards/issued`, desc: 'Gérer, télécharger et révoquer', icon: FileCheck2 },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <IdCard className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Cartes & Convocations</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Émettez, gérez et vérifiez les cartes d'étudiant, d'employé et de candidat.</p>
          </div>
        </div>
        <Link
          href={`/${locale}/dashboard/cards/templates`}
          className="inline-flex items-center gap-1.5 h-10 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold rounded-xl px-4 shadow-2xs"
        >
          <Layers className="w-4 h-4" />Gérer les modèles
        </Link>
      </div>

      {/* KPI banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => (
          <Card key={s.label} className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</span>
              <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{loading ? '—' : s.value}</h3>
              <span className="text-[10px] font-medium text-slate-400">{s.sub}</span>
            </div>
            <div className={`w-10 h-10 rounded-xl ${s.tint} flex items-center justify-center shrink-0`}>
              <s.icon className="w-5 h-5" />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick links */}
        <Card className="lg:col-span-2 p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-3">
          <h2 className="text-sm font-extrabold text-[#16212B]">Actions rapides</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quickLinks.map(q => (
              <Link
                key={q.href}
                href={q.href}
                className="group flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:border-[#2487B8]/40 hover:bg-blue-50/40 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-[#2487B8]/10 text-[#2487B8] flex items-center justify-center shrink-0">
                  <q.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-700">{q.label}</p>
                  <p className="text-[10px] text-slate-400 truncate">{q.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#2487B8] group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </Card>

        {/* Recent issued */}
        <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-extrabold text-[#16212B]">Émissions récentes</h2>
            <Link href={`/${locale}/dashboard/cards/issued`} className="text-[10px] font-bold text-[#2487B8] hover:underline">Tout voir</Link>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
          ) : data && data.recent.length > 0 ? (
            <div className="space-y-2.5">
              {data.recent.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{TYPE_LABELS[doc.type] || doc.type}</p>
                    <p className="text-[10px] text-slate-400">{new Date(doc.issuedAt).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <Badge variant={STATUS_BADGE[doc.status]?.variant || 'neutral'}>
                    {STATUS_BADGE[doc.status]?.label || doc.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-10">Aucune émission pour le moment.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
