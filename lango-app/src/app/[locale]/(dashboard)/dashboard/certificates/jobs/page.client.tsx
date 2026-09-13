'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Layers,
  Plus,
  Search,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Eye,
  Users,
} from 'lucide-react';

interface Job {
  id: string;
  definitionId: string;
  status: 'pending' | 'processing' | 'completed';
  totalCount: number;
  successCount: number;
  errorCount: number;
  createdAt: string;
  createdBy: string;
  definitionTitle: string;
}

interface JobItem {
  id: string;
  recipientId: string;
  status: 'pending' | 'success' | 'failed';
  errorReason: string | null;
  issuedCertificateId: string | null;
  recipientName: string | null;
  serialNumber: string | null;
}

interface Definition {
  id: string;
  title: string;
  allowedTargetType: 'student' | 'employee';
  status: string;
}

interface Recipient {
  id: string;
  name: string | null;
  matricule: string | null;
  employeeId: string | null;
  role: string;
}

export default function CertificatesJobsPage() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';
  const t = useTranslations('Certificates');

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [selectedDefinitionId, setSelectedDefinitionId] = useState('');
  const [selectedType, setSelectedType] = useState<'student' | 'employee'>('student');
  const [publishedVersionId, setPublishedVersionId] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [customRecipientIds, setCustomRecipientIds] = useState('');
  const [creating, setCreating] = useState(false);

  const [detailJobId, setDetailJobId] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<JobItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [processingId, setProcessingId] = useState<string | null>(null);

  const getJobStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: t('statusPending'), variant: 'info' as const };
      case 'processing':
        return { label: t('statusProcessing'), variant: 'signal' as const };
      case 'completed':
        return { label: t('statusCompleted'), variant: 'success' as const };
      default:
        return { label: status, variant: 'info' as const };
    }
  };

  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: t('statusPending'), variant: 'neutral' as const };
      case 'success':
        return { label: t('statusSuccess'), variant: 'success' as const };
      case 'failed':
        return { label: t('statusFailed'), variant: 'danger' as const };
      default:
        return { label: status, variant: 'neutral' as const };
    }
  };

  const load = () => fetch('/api/certificates/jobs')
    .then(r => r.json())
    .then(j => { if (j.success) setJobs(j.data); });

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const openCreate = async () => {
    setIsCreateOpen(true);
    setSelectedDefinitionId('');
    setSelectedType('student');
    setPublishedVersionId(null);
    setSelectedRecipientIds([]);
    setCustomRecipientIds('');
    setRecipientSearch('');
    const res = await fetch('/api/certificates/definitions').then(r => r.json());
    if (res.success) setDefinitions(res.data.filter((d: Definition) => d.status !== 'archived'));
  };

  const selectDefinition = async (definitionId: string) => {
    setSelectedDefinitionId(definitionId);
    setPublishedVersionId(null);
    setSelectedRecipientIds([]);
    const def = definitions.find(d => d.id === definitionId);
    setSelectedType(def?.allowedTargetType ?? 'student');
    const res = await fetch(`/api/certificates/definitions/${definitionId}/versions`).then(r => r.json());
    if (res.success) {
      const active = res.data.find((v: any) => v.status === 'active');
      setPublishedVersionId(active ? active.id : null);
    }
    if (def?.allowedTargetType === 'student') {
      const rRes = await fetch('/api/certificates/recipients?type=student').then(r => r.json());
      if (rRes.success) setRecipients(rRes.data);
    }
  };

  const filteredRecipients = useMemo(() => {
    const q = recipientSearch.toLowerCase();
    return recipients.filter(r =>
      (r.name?.toLowerCase().includes(q) ?? false) ||
      (r.matricule?.toLowerCase().includes(q) ?? false)
    );
  }, [recipients, recipientSearch]);

  const toggleRecipient = (id: string) => {
    setSelectedRecipientIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const finalRecipientIds = selectedType === 'student'
    ? selectedRecipientIds
    : customRecipientIds.split(/[\n,]/).map(s => s.trim()).filter(Boolean);

  const handleCreate = async () => {
    if (!publishedVersionId || finalRecipientIds.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch('/api/certificates/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          definitionId: selectedDefinitionId,
          definitionVersionId: publishedVersionId,
          recipientType: selectedType,
          recipientIds: finalRecipientIds,
          ruleType: 'manual_authorized',
          ruleParams: {},
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsCreateOpen(false);
        await load();
      } else {
        alert(data.message || t('errorCreateJob'));
      }
    } finally {
      setCreating(false);
    }
  };

  const handleProcess = async (jobId: string) => {
    setProcessingId(jobId);
    try {
      const res = await fetch(`/api/certificates/jobs/${jobId}/process`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) alert(data.message || t('errorProcessJob'));
      await load();
      if (detailJobId === jobId) openDetail(jobId);
    } finally {
      setProcessingId(null);
    }
  };

  const openDetail = async (jobId: string) => {
    setDetailJobId(jobId);
    setDetailLoading(true);
    setDetailItems([]);
    try {
      const res = await fetch(`/api/certificates/jobs/${jobId}`).then(r => r.json());
      if (res.success) setDetailItems(res.data.items);
    } finally {
      setDetailLoading(false);
    }
  };

  const completedCount = jobs.filter(j => j.status === 'completed').length;
  const inProgressCount = jobs.filter(j => j.status === 'pending' || j.status === 'processing').length;
  const totalRecipients = jobs.reduce((a, j) => a + j.totalCount, 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('batchIssuanceTitle')}</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{t('batchIssuanceSubtitle')}</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5 px-4 cursor-pointer">
          <Plus className="w-4 h-4" /><span>{t('btnNewJob')}</span>
        </Button>
      </div>

      {/* KPI banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('statTotalBatches')}</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{jobs.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center shrink-0"><Layers className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('statRecipients')}</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{totalRecipients}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><Users className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('statCompleted')}</span>
            <h3 className="text-2xl font-extrabold text-[#17A673] mt-1">{completedCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><CheckCircle2 className="w-5 h-5" /></div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('statInProgress')}</span>
            <h3 className="text-2xl font-extrabold text-[#0EA5C4] mt-1">{inProgressCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-[#0EA5C4] flex items-center justify-center shrink-0"><Zap className="w-5 h-5" /></div>
        </Card>
      </div>

      {/* Jobs table */}
      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex justify-between items-center">
          <p className="text-xs text-slate-400 font-medium">{t('batchCount', { count: jobs.length })}</p>
          <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs font-medium cursor-pointer" onClick={() => load()}>
            <RefreshCw className="w-3.5 h-3.5 me-1.5" />{t('btnRefresh')}
          </Button>
        </div>

        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/50 text-start text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="p-3 ps-4 text-start">{t('thDefinition')}</th>
                <th className="p-3 text-start">{t('thStatus')}</th>
                <th className="p-3 text-start">{t('thTotal')}</th>
                <th className="p-3 text-start">{t('thSuccessCount')}</th>
                <th className="p-3 text-start">{t('thFailedCount')}</th>
                <th className="p-3 text-start">{t('thCreatedAt')}</th>
                <th className="p-3 text-end pe-4">{t('thActions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">{t('tableLoading')}</td></tr>
              ) : jobs.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">{t('noJobsForNow')}</td></tr>
              ) : (
                jobs.map(job => {
                  const sBadge = getJobStatusBadge(job.status);
                  return (
                    <tr key={job.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="p-3 ps-4 font-semibold text-slate-700">{job.definitionTitle}</td>
                      <td className="p-3">
                        <Badge variant={sBadge.variant}>
                          {sBadge.label}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-600">{job.totalCount}</td>
                      <td className="p-3 text-emerald-600 font-semibold">{job.successCount}</td>
                      <td className="p-3 text-rose-600 font-semibold">{job.errorCount}</td>
                      <td className="p-3 text-slate-500">{new Date(job.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : locale === 'fr' ? 'fr-FR' : 'en-US')}</td>
                      <td className="p-3 pe-4 text-end space-x-1.5 rtl:space-x-reverse">
                        {job.status !== 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg text-xs font-medium cursor-pointer"
                            onClick={() => handleProcess(job.id)}
                            disabled={processingId === job.id}
                          >
                            {processingId === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" /> : <Zap className="w-3.5 h-3.5 me-1.5" />}
                            {t('btnProcess')}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg text-xs font-medium cursor-pointer"
                          onClick={() => openDetail(job.id)}
                        >
                          <Eye className="w-3.5 h-3.5 me-1.5" />{t('btnDetail')}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create job dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader className="text-start">
            <DialogTitle>{t('dialogNewJobTitle')}</DialogTitle>
            <DialogDescription>{t('dialogNewJobDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pe-1 text-start">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">{t('labelDefinition')}</Label>
              <Select value={selectedDefinitionId} onValueChange={selectDefinition}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={t('placeholderChooseDefinition')} />
                </SelectTrigger>
                <SelectContent>
                  {definitions.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-slate-400">{t('noDefinitions')}</p>
                  ) : (
                    definitions.map(d => (
                      <SelectItem key={d.id} value={d.id} className="text-xs">
                        {d.title} — {d.allowedTargetType === 'student' ? t('targetStudents') : t('targetEmployees')}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedDefinitionId && !publishedVersionId && (
                <p className="text-[11px] font-semibold text-amber-600">
                  {t('noPublishedVersionWarning')}
                </p>
              )}
            </div>

            {selectedType === 'student' ? (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">
                  {t('selectedStudentsCount', { count: selectedRecipientIds.length })}
                </Label>
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={recipientSearch}
                    onChange={e => setRecipientSearch(e.target.value)}
                    placeholder={t('searchStudentsPlaceholder')}
                    className="ps-9 h-9 text-xs rounded-xl"
                  />
                </div>
                <div className="border border-slate-100 rounded-xl max-h-52 overflow-y-auto">
                  {filteredRecipients.length === 0 ? (
                    <p className="p-4 text-xs text-slate-400 text-center">{t('noStudentsFound')}</p>
                  ) : (
                    filteredRecipients.map(r => (
                      <label
                        key={r.id}
                        className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRecipientIds.includes(r.id)}
                          onChange={() => toggleRecipient(r.id)}
                          className="w-4 h-4 accent-[#2487B8]"
                        />
                        <span className="text-xs font-medium text-slate-700">{r.name}</span>
                        {r.matricule && <span className="text-[10px] text-slate-400 ms-auto">{r.matricule}</span>}
                      </label>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">{t('labelStaffIds')}</Label>
                <textarea
                  value={customRecipientIds}
                  onChange={e => setCustomRecipientIds(e.target.value)}
                  placeholder={t('placeholderStaffIds')}
                  rows={4}
                  className="w-full h-24 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-[#2487B8]"
                />
                {finalRecipientIds.length > 0 && (
                  <p className="text-[11px] font-semibold text-slate-500">{t('staffIdsCount', { count: finalRecipientIds.length })}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="text-xs h-9 cursor-pointer">{t('btnCancel')}</Button>
            <Button
              className="bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs h-9 font-bold shadow-2xs gap-1.5 px-4 cursor-pointer"
              onClick={handleCreate}
              disabled={creating || !publishedVersionId || finalRecipientIds.length === 0}
            >
              {creating ? t('btnCreating') : t('btnCreateJob')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job detail dialog */}
      <Dialog open={detailJobId !== null} onOpenChange={(open) => { if (!open) setDetailJobId(null); }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader className="text-start">
            <DialogTitle>{t('dialogJobDetailTitle')}</DialogTitle>
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto pe-1 text-start">
            {detailLoading ? (
              <p className="text-xs text-slate-400 text-center py-8">{t('tableLoading')}</p>
            ) : detailItems.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">{t('noItems')}</p>
            ) : (
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50/50 text-start text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      <th className="p-2.5 ps-3 text-start">{t('thRecipient')}</th>
                      <th className="p-2.5 text-start">{t('thStatus')}</th>
                      <th className="p-2.5 text-start">{t('thSerial')}</th>
                      <th className="p-2.5 text-start">{t('thError')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailItems.map(item => {
                      const sBadge = getItemStatusBadge(item.status);
                      return (
                        <tr key={item.id} className="border-b border-slate-50 last:border-0">
                          <td className="p-2.5 ps-3 text-slate-600">{item.recipientName ?? item.recipientId}</td>
                          <td className="p-2.5">
                            <Badge variant={sBadge.variant}>
                              {sBadge.label}
                            </Badge>
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-500">{item.serialNumber ?? '-'}</td>
                          <td className="p-2.5 text-rose-600 text-[11px] max-w-[160px] truncate">{item.errorReason || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailJobId(null)} className="text-xs h-9 cursor-pointer">{t('btnClose')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
