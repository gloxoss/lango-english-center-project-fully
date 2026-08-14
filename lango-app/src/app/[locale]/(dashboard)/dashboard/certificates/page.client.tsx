'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollText, Layers, PenLine, FileCheck2, ClipboardList, Users, UserCheck, Loader2, ArrowRight } from 'lucide-react';

type Overview = {
  definitions: number;
  templates: number;
  activeSignatories: number;
  issuedByStatus: Record<string, number>;
  issuedTotal: number;
  requestsByStatus: Record<string, number>;
  awaitingReview: number;
  jobsByStatus: Record<string, number>;
  recent: Array<{
    id: string;
    serialNumber: string;
    definitionId: string;
    status: string;
    issuedAt: string;
    recipientName: string | null;
    definitionTitle: string;
  }>;
};

const ISSUED_STATUS_BADGE: Record<string, { label: string, variant: 'neutral' | 'success' | 'danger' | 'warning' }> = {
  valid: { label: 'Valide', variant: 'success' },
  revoked: { label: 'Révoqué', variant: 'danger' },
  replaced: { label: 'Remplacé', variant: 'neutral' },
};

export default function CertificatesOverviewPage() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';

  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/certificates/overview')
      .then(r => r.json())
      .then(j => { if (j.success) setData(j.data); })
      .finally(() => setLoading(false));
  }, []);

  const jobsTotal = Object.values(data?.jobsByStatus ?? {}).reduce((a, b) => a + b, 0);

  const statCards = [
    { label: 'Définitions', value: data?.definitions ?? 0, sub: 'types de certificats', icon: ScrollText, tint: 'bg-blue-50 text-[#2487B8]' },
    { label: 'Modèles', value: data?.templates ?? 0, sub: `${data?.activeSignatories ?? 0} signataires actifs`, icon: Layers, tint: 'bg-indigo-50 text-indigo-600' },
    { label: 'Certificats émis', value: data?.issuedTotal ?? 0, sub: `${data?.issuedByStatus?.valid ?? 0} valides`, icon: FileCheck2, tint: 'bg-emerald-50 text-emerald-600' },
    { label: 'Demandes à traiter', value: data?.awaitingReview ?? 0, sub: 'soumission ou révision', icon: ClipboardList, tint: 'bg-amber-50 text-amber-600' },
  ];

  const quickLinks = [
    { label: 'Émettre — Élèves', href: `/${locale}/dashboard/certificates/issue/students`, desc: 'Certificats pour les élèves', icon: Users },
    { label: 'Émettre — Employés', href: `/${locale}/dashboard/certificates/issue/employees`, desc: 'Certificats pour le personnel', icon: UserCheck },
    { label: 'Demandes & Approbations', href: `/${locale}/dashboard/certificates/requests`, desc: 'Circuit de validation quatre yeux', icon: PenLine },
    { label: 'Émissions en lot', href: `/${locale}/dashboard/certificates/jobs`, desc: `Lots de certificats (${jobsTotal})`, icon: ClipboardList },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <ScrollText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Certificats</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Émettez, validez et vérifiez les certificats d'élèves et d'employés.</p>
          </div>
        </div>
        <Link
          href={`/${locale}/dashboard/certificates/definitions`}
          className="inline-flex items-center gap-1.5 h-10 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold rounded-xl px-4 shadow-2xs"
        >
          <ScrollText className="w-4 h-4" />Gérer les définitions
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
            <h2 className="text-sm font-extrabold text-[#16212B]">Certificats récents</h2>
            <Link href={`/${locale}/dashboard/certificates/issued`} className="text-[10px] font-bold text-[#2487B8] hover:underline">Tout voir</Link>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
          ) : data && data.recent.length > 0 ? (
            <div className="space-y-2.5">
              {data.recent.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{doc.definitionTitle}</p>
                    <p className="text-[10px] text-slate-400 truncate">{doc.recipientName ?? '—'} • {doc.serialNumber}</p>
                  </div>
                  <Badge variant={ISSUED_STATUS_BADGE[doc.status]?.variant || 'neutral'}>
                    {ISSUED_STATUS_BADGE[doc.status]?.label || doc.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-10">Aucun certificat émis pour le moment.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
