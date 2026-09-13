'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
} from 'lucide-react';

interface Job {
  id: string;
  type: 'student_id' | 'employee_id' | 'admit_card';
  status: 'queued' | 'processing' | 'partially_completed' | 'completed' | 'failed' | 'cancelled';
  totalCount: number;
  successCount: number;
  errorCount: number;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

interface JobItem {
  id: string;
  subjectId: string;
  status: 'pending' | 'success' | 'failed';
  errorMessage?: string | null;
}

interface Student {
  id: string;
  fullName: string;
  matricule?: string | null;
}

interface Template {
  id: string;
  name: string;
  type: 'student_id' | 'employee_id' | 'admit_card';
  status: string;
}

const SUBJECT_TYPE_BY_TEMPLATE: Record<string, string> = {
  student_id: 'student',
  employee_id: 'employee',
  admit_card: 'exam_candidate',
};

export default function CardsJobsPage() {
  const t = useTranslations('Cards');
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale ?? 'fr';

  const TYPE_LABELS: Record<string, string> = {
    student_id: t('typeStudentId'),
    employee_id: t('typeEmployeeId'),
    admit_card: t('typeAdmitCard'),
  };

  const STATUS_BADGE: Record<string, { label: string, variant: 'neutral' | 'info' | 'success' | 'danger' | 'warning' | 'signal' }> = {
    queued: { label: t('statusQueued'), variant: 'info' },
    processing: { label: t('statusProcessing'), variant: 'signal' },
    partially_completed: { label: t('statusPartiallyCompleted'), variant: 'warning' },
    completed: { label: t('statusCompleted'), variant: 'success' },
    failed: { label: t('statusFailed'), variant: 'danger' },
    cancelled: { label: t('statusCancelled'), variant: 'neutral' },
  };

  const ITEM_STATUS_BADGE: Record<string, { label: string, variant: 'neutral' | 'success' | 'danger' }> = {
    pending: { label: t('statusPending'), variant: 'neutral' },
    success: { label: t('statusSuccess'), variant: 'success' },
    failed: { label: t('statusFailed'), variant: 'danger' },
  };

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [publishedVersionId, setPublishedVersionId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [customSubjectIds, setCustomSubjectIds] = useState('');
  const [creating, setCreating] = useState(false);

  const [detailJobId, setDetailJobId] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<JobItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = () => fetch('/api/cards/jobs')
    .then(r => r.json())
    .then(j => { if (j.success) setJobs(j.data); });

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const openCreate = async () => {
    setIsCreateOpen(true);
    setSelectedTemplateId('');
    setPublishedVersionId(null);
    setSelectedSubjectIds([]);
    setCustomSubjectIds('');
    setStudentSearch('');
    const res = await fetch('/api/cards/templates').then(r => r.json());
    if (res.success) {
      const published = res.data.filter((tpl: Template) => tpl.status === 'published' || tpl.status === 'draft');
      setTemplates(published);
    }
  };

  const selectTemplate = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    setPublishedVersionId(null);
    setSelectedSubjectIds([]);
    const res = await fetch(`/api/cards/templates/${templateId}/versions`).then(r => r.json());
    if (res.success) {
      const publishedVersion = res.data.find((v: any) => v.publishedById);
      setPublishedVersionId(publishedVersion ? publishedVersion.id : null);
      const subjectType = SUBJECT_TYPE_BY_TEMPLATE[
        templates.find(tpl => tpl.id === templateId)?.type ?? ''
      ];
      if (subjectType === 'student') {
        const sRes = await fetch('/api/students?page=1&pageSize=100').then(r => r.json());
        if (sRes.success) setStudents(sRes.data);
      }
    }
  };

  const selectedType = templates.find(tpl => tpl.id === selectedTemplateId)?.type ?? 'student_id';
  const subjectType = SUBJECT_TYPE_BY_TEMPLATE[selectedType];

  const filteredStudents = useMemo(() => {
    const q = studentSearch.toLowerCase();
    return students.filter(s => (s.fullName?.toLowerCase().includes(q) ?? false) || (s.matricule?.toLowerCase().includes(q) ?? false));
  }, [students, studentSearch]);

  const toggleSubject = (id: string) => {
    setSelectedSubjectIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const finalSubjectIds = subjectType === 'student'
    ? selectedSubjectIds
    : customSubjectIds.split(/[\n,]/).map(s => s.trim()).filter(Boolean);

  const handleCreate = async () => {
    if (!publishedVersionId || finalSubjectIds.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch('/api/cards/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateVersionId: publishedVersionId,
          subjectType,
          subjectIds: finalSubjectIds,
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
      const res = await fetch(`/api/cards/jobs/${jobId}/process`, { method: 'POST' });
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
      const res = await fetch(`/api/cards/jobs/${jobId}`).then(r => r.json());
      if (res.success) setDetailItems(res.data.items);
    } finally {
      setDetailLoading(false);
    }
  };

  const totalJobs = jobs.length;
  const completedCount = jobs.filter(j => j.status === 'completed').length;
  const inProgressCount = jobs.filter(j => j.status === 'queued' || j.status === 'processing' || j.status === 'partially_completed').length;
  const failedCount = jobs.filter(j => j.status === 'failed').length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('jobsTitle')}</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{t('jobsSubtitle')}</p>
          </div>
        </div>
        <Button
          onClick={openCreate}
          className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5 px-4 cursor-pointer"
        >
          <Plus className="w-4 h-4" /><span>{t('newJob')}</span>
        </Button>
      </div>

      {/* KPI banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiTotalJobs')}</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{totalJobs}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiCompletedJobs')}</span>
            <h3 className="text-2xl font-extrabold text-[#17A673] mt-1">{completedCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiInProgressJobs')}</span>
            <h3 className="text-2xl font-extrabold text-[#0EA5C4] mt-1">{inProgressCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-[#0EA5C4] flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('kpiFailedJobs')}</span>
            <h3 className="text-2xl font-extrabold text-rose-600 mt-1">{failedCount}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Jobs table */}
      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
        <div className="flex justify-between items-center">
          <div className="relative w-72">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder={t('searchJobPlaceholder')} className="ps-9 h-9 text-xs rounded-xl" />
          </div>
          <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs font-medium cursor-pointer" onClick={() => load()}>
            <RefreshCw className="w-3.5 h-3.5 me-1.5" />{t('btnRefresh')}
          </Button>
        </div>

        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50/50 text-start text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="p-3 ps-4 text-start">{t('thType')}</th>
                <th className="p-3 text-start">{t('thStatus')}</th>
                <th className="p-3 text-start">{t('thTotal')}</th>
                <th className="p-3 text-start">{t('thSucceeded')}</th>
                <th className="p-3 text-start">{t('thFailed')}</th>
                <th className="p-3 text-start">{t('thCreatedAt')}</th>
                <th className="p-3 text-end pe-4">{t('thActions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">{t('loadingJobs')}</td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">{t('noJobsFound')}</td>
                </tr>
              ) : (
                jobs.map(job => (
                  <tr key={job.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="p-3 ps-4 font-semibold text-slate-700">{TYPE_LABELS[job.type] || job.type}</td>
                    <td className="p-3">
                      <Badge variant={STATUS_BADGE[job.status]?.variant || 'neutral'}>
                        {STATUS_BADGE[job.status]?.label || job.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-slate-600">{job.totalCount}</td>
                    <td className="p-3 text-emerald-600 font-semibold">{job.successCount}</td>
                    <td className="p-3 text-rose-600 font-semibold">{job.errorCount}</td>
                    <td className="p-3 text-slate-500">{new Date(job.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : locale === 'en' ? 'en-US' : 'fr-FR')}</td>
                    <td className="p-3 pe-4 text-end space-x-1.5 rtl:space-x-reverse">
                      {(job.status === 'queued' || job.status === 'processing' || job.status === 'partially_completed' || job.status === 'failed') && (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create job dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t('dialogNewJob')}</DialogTitle>
            <DialogDescription>{t('dialogNewJobDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pe-1">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">{t('selectTemplateLabel')}</Label>
              <Select value={selectedTemplateId} onValueChange={selectTemplate}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={t('chooseTemplatePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(tpl => (
                    <SelectItem key={tpl.id} value={tpl.id} className="text-xs">
                      {tpl.name} — {TYPE_LABELS[tpl.type] || tpl.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplateId && !publishedVersionId && (
                <p className="text-[11px] font-semibold text-amber-600">
                  {t('noPublishedVersionWarning')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">{t('subjectTypeLabel')}</Label>
              <Input value={subjectType} readOnly className="h-9 text-xs bg-slate-50" />
            </div>

            {subjectType === 'student' ? (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">
                  {t('studentsSelectedCount', { count: selectedSubjectIds.length })}
                </Label>
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    placeholder={t('searchStudentPlaceholder')}
                    className="ps-9 h-9 text-xs rounded-xl"
                  />
                </div>
                <div className="border border-slate-100 rounded-xl max-h-52 overflow-y-auto">
                  {filteredStudents.length === 0 ? (
                    <p className="p-4 text-xs text-slate-400 text-center">{t('noStudentsInJobFound')}</p>
                  ) : (
                    filteredStudents.map(s => (
                      <label
                        key={s.id}
                        className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSubjectIds.includes(s.id)}
                          onChange={() => toggleSubject(s.id)}
                          className="w-4 h-4 accent-[#2487B8]"
                        />
                        <span className="text-xs font-medium text-slate-700">{s.fullName}</span>
                        {s.matricule && <span className="text-[10px] text-slate-400 ms-auto font-mono">{s.matricule}</span>}
                      </label>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">
                  {subjectType === 'employee' ? t('employeeIdsLabel') : t('admitCandidateIdsLabel')}
                </Label>
                <textarea
                  value={customSubjectIds}
                  onChange={e => setCustomSubjectIds(e.target.value)}
                  placeholder={t('customSubjectIdsPlaceholder')}
                  rows={4}
                  className="w-full h-24 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 outline-none focus:border-[#2487B8]"
                />
                {finalSubjectIds.length > 0 && (
                  <p className="text-[11px] font-semibold text-slate-500">{t('enteredIdsCount', { count: finalSubjectIds.length })}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="text-xs h-9 cursor-pointer">{t('btnCancel')}</Button>
            <Button
              className="bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs h-9 font-bold shadow-2xs gap-1.5 px-4 cursor-pointer"
              onClick={handleCreate}
              disabled={creating || !publishedVersionId || finalSubjectIds.length === 0}
            >
              {creating ? t('btnCreating') : t('btnCreateJob')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job detail dialog */}
      <Dialog open={detailJobId !== null} onOpenChange={(open) => { if (!open) setDetailJobId(null); }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{t('jobDetailTitle')}</DialogTitle>
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto pe-1">
            {detailLoading ? (
              <p className="text-xs text-slate-400 text-center py-8">{t('loadingJobs')}</p>
            ) : detailItems.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">{t('noItemsInJob')}</p>
            ) : (
              <div className="rounded-xl border border-slate-100 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50/50 text-start text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      <th className="p-2.5 ps-3 text-start">{t('thSubject')}</th>
                      <th className="p-2.5 text-start">{t('thStatus')}</th>
                      <th className="p-2.5 text-start">{t('thError')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailItems.map(item => (
                      <tr key={item.id} className="border-b border-slate-50 last:border-0">
                        <td className="p-2.5 ps-3 font-mono text-[11px] text-slate-600">{item.subjectId}</td>
                        <td className="p-2.5">
                          <Badge variant={ITEM_STATUS_BADGE[item.status]?.variant || 'neutral'}>
                            {ITEM_STATUS_BADGE[item.status]?.label || item.status}
                          </Badge>
                        </td>
                        <td className="p-2.5 text-rose-600 text-[11px]">{item.errorMessage || '-'}</td>
                      </tr>
                    ))}
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
