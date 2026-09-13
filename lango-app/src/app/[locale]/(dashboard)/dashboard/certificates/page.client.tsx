'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
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

export default function CertificatesOverviewPage() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';
  const t = useTranslations('Certificates');

  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/certificates/overview')
      .then(r => r.json())
      .then(j => { if (j.success) setData(j.data); })
      .finally(() => setLoading(false));
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return { label: t('statusValid'), variant: 'success' as const };
      case 'revoked':
        return { label: t('statusRevoked'), variant: 'danger' as const };
      case 'replaced':
        return { label: t('statusReplaced'), variant: 'neutral' as const };
      default:
        return { label: status, variant: 'neutral' as const };
    }
  };

  const jobsTotal = Object.values(data?.jobsByStatus ?? {}).reduce((a, b) => a + b, 0);

  const statCards = [
    { label: t('statDefinitions'), value: data?.definitions ?? 0, sub: t('statDefinitionsSub'), icon: ScrollText, tint: 'bg-blue-50 text-[#2487B8]' },
    { label: t('statTemplates'), value: data?.templates ?? 0, sub: t('statTemplatesSub', { count: data?.activeSignatories ?? 0 }), icon: Layers, tint: 'bg-indigo-50 text-indigo-600' },
    { label: t('statIssuedCertificates'), value: data?.issuedTotal ?? 0, sub: t('statIssuedValidSub', { count: data?.issuedByStatus?.valid ?? 0 }), icon: FileCheck2, tint: 'bg-emerald-50 text-emerald-600' },
    { label: t('statAwaitingReview'), value: data?.awaitingReview ?? 0, sub: t('statAwaitingReviewSub'), icon: ClipboardList, tint: 'bg-amber-50 text-amber-600' },
  ];

  const quickLinks = [
    { label: t('linkIssueStudents'), href: `/${locale}/dashboard/certificates/issue/students`, desc: t('linkIssueStudentsDesc'), icon: Users },
    { label: t('linkIssueEmployees'), href: `/${locale}/dashboard/certificates/issue/employees`, desc: t('linkIssueEmployeesDesc'), icon: UserCheck },
    { label: t('linkRequests'), href: `/${locale}/dashboard/certificates/requests`, desc: t('linkRequestsDesc'), icon: PenLine },
    { label: t('linkJobs'), href: `/${locale}/dashboard/certificates/jobs`, desc: t('linkJobsDesc', { count: jobsTotal }), icon: ClipboardList },
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
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('overviewTitle')}</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{t('overviewSubtitle')}</p>
          </div>
        </div>
        <Link
          href={`/${locale}/dashboard/certificates/definitions`}
          className="inline-flex items-center gap-1.5 h-10 bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold rounded-xl px-4 shadow-2xs"
        >
          <ScrollText className="w-4 h-4" />{t('manageDefinitions')}
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
          <h2 className="text-sm font-extrabold text-[#16212B]">{t('quickActions')}</h2>
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
                <div className="flex-1 min-w-0 text-start">
                  <p className="text-xs font-bold text-slate-700">{q.label}</p>
                  <p className="text-[10px] text-slate-400 truncate">{q.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#2487B8] group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </Card>

        {/* Recent issued */}
        <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-extrabold text-[#16212B]">{t('recentCertificates')}</h2>
            <Link href={`/${locale}/dashboard/certificates/issued`} className="text-[10px] font-bold text-[#2487B8] hover:underline">{t('viewAll')}</Link>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
          ) : data && data.recent.length > 0 ? (
            <div className="space-y-2.5">
              {data.recent.map(doc => {
                const badge = getStatusBadge(doc.status);
                return (
                  <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
                    <div className="flex-1 min-w-0 text-start">
                      <p className="text-xs font-bold text-slate-700 truncate">{doc.definitionTitle}</p>
                      <p className="text-[10px] text-slate-400 truncate">{doc.recipientName ?? '—'} • {doc.serialNumber}</p>
                    </div>
                    <Badge variant={badge.variant}>
                      {badge.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-10">{t('noCertificatesIssued')}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
