'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { FileCheck2, RefreshCw, Download, Ban, Loader2 } from 'lucide-react';

type IssuedDoc = {
  id: string;
  type: 'student_id' | 'employee_id' | 'admit_card';
  subjectType: string;
  subjectName: string;
  status: 'active' | 'expired' | 'revoked' | 'replaced';
  issuedAt: string;
  revokeReason?: string | null;
};

export default function CardsIssuedPage() {
  const t = useTranslations('Cards');
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';

  const TYPE_LABELS: Record<string, string> = {
    student_id: t('typeStudentId'),
    employee_id: t('typeEmployeeId'),
    admit_card: t('typeAdmitCard'),
  };

  const STATUS_BADGE: Record<string, { label: string, variant: 'neutral' | 'success' | 'danger' | 'warning' }> = {
    active: { label: t('statusActive'), variant: 'success' },
    revoked: { label: t('statusRevoked'), variant: 'danger' },
    expired: { label: t('statusExpired'), variant: 'warning' },
    replaced: { label: t('statusReplaced'), variant: 'neutral' },
  };

  const [docs, setDocs] = useState<IssuedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [revokeTarget, setRevokeTarget] = useState<IssuedDoc | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params2 = new URLSearchParams();
      if (typeFilter !== 'all') params2.set('type', typeFilter);
      if (statusFilter !== 'all') params2.set('status', statusFilter);
      const res = await fetch(`/api/cards/issued?${params2.toString()}`).then(r => r.json());
      if (res.success) setDocs(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [typeFilter, statusFilter]);

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {};
    for (const d of docs) byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
    return byStatus;
  }, [docs]);

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/cards/issued/${revokeTarget.id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: revokeReason.trim() || undefined }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.message || json.error?.message || t('errorRevoke'));
      }
      setRevokeTarget(null);
      setRevokeReason('');
      await load();
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <FileCheck2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('issuedTitle')}</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{t('issuedSubtitle')}</p>
          </div>
        </div>
      </div>

      {/* KPI banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiTotalIssued')}</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{docs.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center"><FileCheck2 className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('statActiveCards')}</span>
            <h3 className="text-2xl font-extrabold text-[#17A673] mt-1">{counts.active ?? 0}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><FileCheck2 className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('statRevoked')}</span>
            <h3 className="text-2xl font-extrabold text-rose-600 mt-1">{counts.revoked ?? 0}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center"><Ban className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('statusExpired')}</span>
            <h3 className="text-2xl font-extrabold text-[#0EA5C4] mt-1">{counts.expired ?? 0}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-[#0EA5C4] flex items-center justify-center"><FileCheck2 className="w-5 h-5" /></div>
        </Card>
      </div>

      {/* Filters + table */}
      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-56 h-9 text-xs"><SelectValue placeholder={t('allTypes')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">{t('allTypes')}</SelectItem>
              <SelectItem value="student_id" className="text-xs">{t('typeStudentId')}</SelectItem>
              <SelectItem value="employee_id" className="text-xs">{t('typeEmployeeId')}</SelectItem>
              <SelectItem value="admit_card" className="text-xs">{t('typeAdmitCard')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 h-9 text-xs"><SelectValue placeholder={t('allStatuses')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">{t('allStatuses')}</SelectItem>
              <SelectItem value="active" className="text-xs">{t('statusActive')}</SelectItem>
              <SelectItem value="revoked" className="text-xs">{t('statusRevoked')}</SelectItem>
              <SelectItem value="expired" className="text-xs">{t('statusExpired')}</SelectItem>
              <SelectItem value="replaced" className="text-xs">{t('statusReplaced')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs font-medium cursor-pointer" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5 me-1.5" />{t('btnRefresh')}
          </Button>
        </div>

        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/50 text-start text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="p-3 ps-4 text-start">{t('thBeneficiary')}</th>
                <th className="p-3 text-start">{t('thType')}</th>
                <th className="p-3 text-start">{t('thStatus')}</th>
                <th className="p-3 text-start">{t('thIssuedAt')}</th>
                <th className="p-3 text-start">{t('thReason')}</th>
                <th className="p-3 text-end pe-4">{t('thActions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">{t('loadingTemplates')}</td></tr>
              ) : docs.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">{t('noIssuedDocsFound')}</td></tr>
              ) : (
                docs.map(doc => (
                  <tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="p-3 ps-4 font-semibold text-slate-700">{doc.subjectName}</td>
                    <td className="p-3 text-slate-600">{TYPE_LABELS[doc.type] || doc.type}</td>
                    <td className="p-3">
                      <Badge variant={STATUS_BADGE[doc.status]?.variant || 'neutral'}>
                        {STATUS_BADGE[doc.status]?.label || doc.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-slate-500">{new Date(doc.issuedAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : locale === 'en' ? 'en-US' : 'fr-FR')}</td>
                    <td className="p-3 text-slate-400 max-w-[180px] truncate">{doc.revokeReason ?? '-'}</td>
                    <td className="p-3 pe-4 text-end space-x-1.5 rtl:space-x-reverse whitespace-nowrap">
                      <a
                        href={`/api/cards/issued/${doc.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-medium border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); }}
                      >
                        <Download className="w-3.5 h-3.5 me-1.5" />{t('btnDownloadPdf')}
                      </a>
                      {doc.status === 'active' && (
                        <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs font-medium cursor-pointer text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => { setRevokeTarget(doc); setRevokeReason(''); }}>
                          <Ban className="w-3.5 h-3.5 me-1.5" />{t('btnRevoke')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Revoke dialog */}
      <Dialog open={revokeTarget !== null} onOpenChange={(o) => { if (!o && !revoking) setRevokeTarget(null); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{t('dialogRevokeTitle')}</DialogTitle>
            <DialogDescription>
              {t('dialogRevokeDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Label className="text-xs font-bold text-slate-700">{t('revokeReasonLabel')}</Label>
            <textarea
              value={revokeReason}
              onChange={e => setRevokeReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={t('revokeReasonPlaceholder')}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-[#2487B8]"
            />
            <p className="text-[10px] text-slate-400">{t('revokeAuditNotice')}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)} className="text-xs h-9 cursor-pointer" disabled={revoking}>{t('btnCancel')}</Button>
            <Button className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-9 font-bold gap-1.5 px-4 cursor-pointer" onClick={handleRevoke} disabled={revoking}>
              {revoking && <Loader2 className="w-4 h-4 animate-spin" />}
              {revoking ? t('btnRevoking') : t('btnRevoke')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
