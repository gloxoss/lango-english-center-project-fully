'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  Plus,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Eye,
  Loader2,
  CircleDashed,
} from 'lucide-react';

type RunStatus = 'previewed' | 'approved' | 'running' | 'completed' | 'failed' | 'cancelled';
type TargetStatus = 'pending' | 'included' | 'skipped_duplicate' | 'error';

type TargetRow = {
  id: string;
  studentId: string;
  studentName?: string;
  matricule?: string;
  amount: number;
  status: TargetStatus;
  invoiceId?: string | null;
  error?: string | null;
};

type RunRow = {
  id: string;
  period: string;
  feeStructureVersionId: string;
  feeStructureName?: string;
  branchId: string | null;
  branchName?: string | null;
  status: RunStatus;
  targetCount: number;
  runById: string;
  runByName?: string;
  dueDate: string | null;
  previewSummary?: {
    totalCents?: number;
    included?: number;
    skipped?: number;
    dueDate?: string | null;
    components?: { name: string; amount: number; taxable?: boolean; dueOffsetDays?: number }[];
  } | null;
  createdAt: string;
};

type BranchOption = { id: string; name: string };
type VersionOption = { id: string; feeStructureName: string; versionNumber: number; componentCount: number };
type StudentOption = { id: string; fullName: string; matricule: string | null; branchId: string | null };

const STATUS_STYLE: Record<string, string> = {
  previewed: 'bg-amber-100 text-amber-800',
  approved: 'bg-sky-100 text-sky-800',
  running: 'bg-blue-100 text-blue-800',
  completed: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-rose-100 text-rose-800',
  cancelled: 'bg-slate-100 text-slate-600',
};

function formatMAD(cents?: number) {
  if (cents === undefined || cents === null) return '—';
  return `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD`;
}

function runStudentCount(run: RunRow) {
  if (run.previewSummary?.included !== undefined) return run.previewSummary.included;
  return run.targetCount;
}

export function FeeAllocationsView({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations('Finance');
  const tCommon = useTranslations('Common');

  const statusLabel: Record<string, string> = {
    previewed: t('statusPreviewed'),
    approved: t('statusApproved'),
    running: tCommon('loading'),
    completed: t('statusCompleted'),
    failed: tCommon('error'),
    cancelled: t('statusCancelled'),
  };

  const targetLabel: Record<string, string> = {
    pending: t('targetPending'),
    included: t('targetIncluded'),
    skipped_duplicate: t('targetPending'),
    error: t('targetError'),
  };

  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [versions, setVersions] = useState<VersionOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [period, setPeriod] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [branchId, setBranchId] = useState('');
  const [versionId, setVersionId] = useState('');
  const [popMode, setPopMode] = useState<'all' | 'manual'>('all');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [studentSearch, setStudentSearch] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [, setCreatedRun] = useState<RunRow | null>(null);
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);

  const [detail, setDetail] = useState<{ run: RunRow; targets: TargetRow[] } | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [acting, setActing] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/fee-allocations');
      const json = await res.json();
      if (json?.success) setRuns(json.data);
    } catch {
      setError(t('networkErrorSaving'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadRuns();
    fetch('/api/settings/branches')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => { if (json?.success) setBranches(json.data); })
      .catch(() => {});
    fetch('/api/finance/fee-structure-versions')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => { if (json?.success) setVersions(json.data); })
      .catch(() => {});
    fetch('/api/students?status=Actif&pageSize=300')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => { if (json?.success) setStudents(json.data); })
      .catch(() => {});
  }, [loadRuns]);

  const filteredStudents = useMemo(() => {
    const term = studentSearch.toLowerCase();
    return students.filter(s => !term || s.fullName.toLowerCase().includes(term) || (s.matricule ?? '').toLowerCase().includes(term));
  }, [students, studentSearch]);

  function toggleStudent(id: string) {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handlePreview() {
    setPreviewMessage(null);
    setPreviewError(null);
    if (!versionId) { setPreviewError(t('selectPublishedStructurePlaceholder')); return; }
    if (!period.trim()) { setPreviewError(t('periodLabel')); return; }
    if (popMode === 'manual' && selectedStudents.size === 0) { setPreviewError(t('targetPopulationLabel')); return; }
    setPreviewing(true);
    try {
      const body: Record<string, unknown> = {
        period: period.trim(),
        feeStructureVersionId: versionId,
        dueDate: dueDate || undefined,
      };
      if (popMode === 'all') {
        body.branchId = branchId || null;
      } else {
        body.studentIds = [...selectedStudents];
      }
      const res = await fetch('/api/finance/fee-allocations/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok && json?.success) {
        setCreatedRun(json.data.run);
        setPreviewMessage(json.message);
        setShowCreate(false);
        resetCreateForm();
        loadRuns();
      } else {
        setPreviewError(json?.message ?? t('saveFailed'));
      }
    } catch {
      setPreviewError(t('networkErrorSaving'));
    } finally {
      setPreviewing(false);
    }
  }

  function resetCreateForm() {
    setPeriod('');
    setDueDate('');
    setBranchId('');
    setVersionId('');
    setPopMode('all');
    setSelectedStudents(new Set());
    setStudentSearch('');
  }

  async function act(run: RunRow, kind: 'approve' | 'run' | 'cancel') {
    setActing(run.id);
    try {
      const res = await fetch(`/api/finance/fee-allocations/${run.id}/${kind}`, { method: kind === 'run' ? 'POST' : 'PUT' });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.message ?? t('saveFailed'));
      } else if (kind === 'run') {
        setError(null);
        setPreviewMessage(json?.message ?? null);
      }
      loadRuns();
    } catch {
      setError(t('networkErrorSaving'));
    } finally {
      setActing(null);
    }
  }

  async function openDetail(run: RunRow) {
    setDetailLoading(true);
    setShowDetail(true);
    setDetail({ run, targets: [] });
    try {
      const res = await fetch(`/api/finance/fee-allocations/${run.id}`);
      const json = await res.json();
      if (json?.success) setDetail(json.data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  const totalInvoicedCents = useMemo(() => {
    return runs.reduce((sum, r) => sum + (r.previewSummary?.totalCents ? Number(r.previewSummary.totalCents) : 0), 0);
  }, [runs]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('feeAllocationsTitle')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('feeAllocationsSubtitle')}</p>
        </div>
        <Button onClick={() => { resetCreateForm(); setPreviewError(null); setPreviewMessage(null); setShowCreate(true); }} size="sm" className="h-9 rounded-xl font-bold bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 shadow-sm">
          <Plus className="w-4 h-4" /> {t('newAllocationBtn')}
        </Button>
      </div>

      {previewMessage && (
        <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 px-4 py-3 text-xs font-bold text-[#17A673]">{previewMessage}</div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200/60 bg-rose-50/40 px-4 py-3 text-xs font-bold text-[#E5544B]">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-slate-400">{t('allocationsCountCard')}</p>
          <p className="text-2xl font-extrabold text-[#16212B]">{runs.length}</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-blue-200/60 bg-blue-50/20 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-[#1B6C93]">{t('generatedInvoicesCard')}</p>
          <p className="text-2xl font-extrabold text-[#16212B]">
            {runs.reduce((sum, r) => sum + (r.previewSummary?.included ?? 0), 0)}
          </p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-emerald-200/60 bg-emerald-50/20 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-[#17A673]">{t('totalInvoicedCard')}</p>
          <p className="text-2xl font-extrabold text-[#17A673]">{(totalInvoicedCents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</p>
        </Card>
      </div>

      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-4 text-start">{t('periodCol')}</th>
                <th className="py-3.5 px-4 text-start">{tCommon('status')}</th>
                <th className="py-3.5 px-4 text-start">{t('studentsCol')}</th>
                <th className="py-3.5 px-4 text-end">{t('totalMadCol')}</th>
                <th className="py-3.5 px-4 text-start">{t('structureCol')}</th>
                <th className="py-3.5 px-4 text-start">{t('branchCol')}</th>
                <th className="py-3.5 px-4 text-start">{t('createdByCol')}</th>
                <th className="py-3.5 px-4 text-start">{t('dateCol')}</th>
                <th className="py-3.5 px-4 text-end">{tCommon('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading && (
                <tr><td colSpan={9} className="py-10 text-center text-slate-400">{tCommon('loading')}</td></tr>
              )}
              {!loading && runs.length === 0 && (
                <tr><td colSpan={9} className="py-10 text-center text-slate-400">{t('noAllocationsFound')}</td></tr>
              )}
              {runs.map(run => (
                <tr key={run.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-4 font-bold text-[#16212B]">{run.period}</td>
                  <td className="py-3.5 px-4">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${STATUS_STYLE[run.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {statusLabel[run.status] ?? run.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500">{runStudentCount(run)}</td>
                  <td className="py-3.5 px-4 text-end font-extrabold text-[#16212B]">{formatMAD(run.previewSummary?.totalCents)}</td>
                  <td className="py-3.5 px-4 text-slate-500">{run.feeStructureName ?? '—'}</td>
                  <td className="py-3.5 px-4 text-slate-500">{run.branchName ?? t('allBranchesFilterOption')}</td>
                  <td className="py-3.5 px-4 text-slate-500">{run.runByName ?? run.runById.slice(0, 8)}</td>
                  <td className="py-3.5 px-4 text-slate-500">{run.createdAt.slice(0, 10)}</td>
                  <td className="py-3.5 px-4 text-end">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="ghost" size="icon" title={tCommon('view')} onClick={() => openDetail(run)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      {run.status === 'previewed' && (
                        <Button variant="secondary" size="sm" disabled={acting === run.id} onClick={() => act(run, 'approve')} className="rounded-xl text-xs font-bold">
                          {t('approveBtn')}
                        </Button>
                      )}
                      {(run.status === 'previewed' || run.status === 'approved') && (
                        <Button variant="default" size="sm" disabled={acting === run.id} onClick={() => act(run, 'run')} className="rounded-xl text-xs font-bold bg-[#2487B8] hover:bg-[#1B6C93] text-white">
                          {acting === run.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4 rtl:rotate-180" />}
                          {t('runBtn')}
                        </Button>
                      )}
                      {(run.status === 'previewed' || run.status === 'approved') && (
                        <Button variant="danger" size="sm" disabled={acting === run.id} onClick={() => act(run, 'cancel')} className="rounded-xl text-xs font-bold">
                          {t('cancelAllocationBtn')}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-xl bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">{t('newAllocationModalTitle')}</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {t('newAllocationModalDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">{t('periodLabel')}</label>
                <Input value={period} onChange={e => setPeriod(e.target.value)} placeholder={t('periodPlaceholder')} className="h-9 text-xs rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">{t('dueDateRequiredLabel')}</label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9 text-xs rounded-xl" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">{t('publishedStructureLabel')}</label>
              <select
                value={versionId}
                onChange={e => setVersionId(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white text-[#16212B]"
              >
                <option value="">{t('selectPublishedStructurePlaceholder')}</option>
                {versions.map(v => (
                  <option key={v.id} value={v.id}>{v.feeStructureName} — v{v.versionNumber} ({v.componentCount})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">{t('targetPopulationLabel')}</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPopMode('all')}
                  className={`flex-1 h-9 rounded-xl border text-xs font-bold transition ${popMode === 'all' ? 'border-[#2487B8] bg-[#E4EDFD] text-[#2487B8]' : 'border-slate-200 bg-white text-slate-500'}`}
                >
                  {t('allStudentsBranchOption')}
                </button>
                <button
                  type="button"
                  onClick={() => setPopMode('manual')}
                  className={`flex-1 h-9 rounded-xl border text-xs font-bold transition ${popMode === 'manual' ? 'border-[#2487B8] bg-[#E4EDFD] text-[#2487B8]' : 'border-slate-200 bg-white text-slate-500'}`}
                >
                  {t('manualSelectionOption')}
                </button>
              </div>
            </div>

            {popMode === 'all' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">{t('branchOptionalLabel')}</label>
                <select value={branchId} onChange={e => setBranchId(e.target.value)} className="w-full h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white text-[#16212B]">
                  <option value="">{t('allBranchesFilterOption')}</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}

            {popMode === 'manual' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-500">{t('studentsSelectedCount', { count: selectedStudents.size })}</label>
                  <span className="flex-1" />
                  {selectedStudents.size > 0 && (
                    <button type="button" onClick={() => setSelectedStudents(new Set())} className="text-[11px] font-bold text-[#2487B8]">{t('clearAllBtn')}</button>
                  )}
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    placeholder={t('searchStudentPlaceholder')}
                    className="ps-9 h-9 text-xs rounded-xl bg-slate-50 border-none"
                  />
                </div>
                <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {filteredStudents.length === 0 && <div className="py-6 text-center text-xs text-slate-400">{t('noTargetsFound')}</div>}
                  {filteredStudents.map(s => (
                    <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedStudents.has(s.id)}
                        onChange={() => toggleStudent(s.id)}
                        className="accent-[#2487B8]"
                      />
                      <span className="font-bold text-[#16212B]">{s.fullName}</span>
                      {s.matricule && <span className="text-slate-400">{s.matricule}</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {previewError && <div className="rounded-xl border border-rose-200/60 bg-rose-50/40 px-4 py-3 text-xs font-bold text-[#E5544B]">{previewError}</div>}
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)} className="rounded-xl text-xs font-bold">
              {tCommon('cancel')}
            </Button>
            <Button variant="default" size="sm" disabled={previewing} onClick={handlePreview} className="rounded-xl text-xs font-bold bg-[#2487B8] hover:bg-[#1B6C93] text-white">
              {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CircleDashed className="w-4 h-4" />}
              {t('generatePreviewBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-3xl bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">
              {t('allocationDetailTitle', {
                period: detail?.run.period ?? '',
                status: detail ? (statusLabel[detail.run.status] ?? detail.run.status) : '',
              })}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {detail?.run.previewSummary?.components
                ? t('allocationDetailDesc', {
                  count: detail.run.previewSummary.components.length,
                  dueDate: detail.run.previewSummary.dueDate ?? detail.run.dueDate ?? '—',
                })
                : t('feeAllocationsSubtitle')}
            </DialogDescription>
          </DialogHeader>

          {detail?.run.previewSummary?.components && (
            <div className="rounded-xl border border-slate-200 overflow-hidden my-3">
              <table className="w-full text-start text-xs">
                <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
                  <tr>
                    <th className="py-2.5 px-3 text-start">{t('componentCol')}</th>
                    <th className="py-2.5 px-3 text-end">{t('amountCol')}</th>
                    <th className="py-2.5 px-3 text-center">{t('vatCol')}</th>
                    <th className="py-2.5 px-3 text-end">{t('dueDateRequiredLabel')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {detail.run.previewSummary.components.map(c => (
                    <tr key={c.name}>
                      <td className="py-2.5 px-3 font-bold text-[#16212B]">{c.name}</td>
                      <td className="py-2.5 px-3 text-end text-slate-500">{Number(c.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-center text-slate-500">{c.taxable ? tCommon('yes') : tCommon('no')}</td>
                      <td className="py-2.5 px-3 text-end text-slate-500">+{c.dueOffsetDays} d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200">
            {detailLoading && <div className="py-8 text-center text-xs text-slate-400">{t('loadingTargets')}</div>}
            {!detailLoading && (!detail || detail.targets.length === 0) && (
              <div className="py-8 text-center text-xs text-slate-400">{t('noTargetsFound')}</div>
            )}
            {!detailLoading && detail && detail.targets.length > 0 && (
              <table className="w-full text-start text-xs">
                <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 text-start">{t('studentCol')}</th>
                    <th className="py-2.5 px-3 text-end">{t('amountCol')}</th>
                    <th className="py-2.5 px-3 text-center">{tCommon('status')}</th>
                    <th className="py-2.5 px-3 text-start">{t('invoiceCol')}</th>
                    <th className="py-2.5 px-3 text-start">{t('errorCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {detail.targets.map(tRow => (
                    <tr key={tRow.id}>
                      <td className="py-2.5 px-3 font-bold text-[#16212B]">{tRow.studentName ?? tRow.studentId}</td>
                      <td className="py-2.5 px-3 text-end text-slate-500">{tRow.amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${tRow.status === 'included' ? 'bg-[#DDF5EC] text-[#17A673]' : tRow.status === 'error' ? 'bg-rose-50 text-[#E5544B]' : 'bg-slate-100 text-slate-600'}`}>
                          {targetLabel[tRow.status] ?? tRow.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{tRow.invoiceId ? tRow.invoiceId.slice(0, 8) : '—'}</td>
                      <td className="py-2.5 px-3 text-rose-500 max-w-[220px] truncate">{tRow.error ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {detail && (detail.run.status === 'previewed' || detail.run.status === 'approved') && (
            <DialogFooter className="pt-4">
              <div className="flex items-center gap-2 w-full justify-end">
                {detail.run.status === 'previewed' && (
                  <Button variant="secondary" size="sm" onClick={() => { act(detail.run, 'approve'); setShowDetail(false); }} className="rounded-xl text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" /> {t('approveBtn')}
                  </Button>
                )}
                <Button variant="default" size="sm" onClick={() => { act(detail.run, 'run'); setShowDetail(false); }} className="rounded-xl text-xs font-bold bg-[#2487B8] hover:bg-[#1B6C93] text-white">
                  <PlayCircle className="w-4 h-4 rtl:rotate-180" /> {t('runBillingBtn')}
                </Button>
                <Button variant="danger" size="sm" onClick={() => { act(detail.run, 'cancel'); setShowDetail(false); }} className="rounded-xl text-xs font-bold">
                  <XCircle className="w-4 h-4" /> {t('cancelAllocationBtn')}
                </Button>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
