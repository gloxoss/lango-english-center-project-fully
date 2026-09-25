'use client';

import { AlertCircle, CheckCircle2, FilePlus2, Loader2, Send, XCircle } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { authClient } from '@/libs/auth-client';

type Draft = {
  id: string;
  key: string;
  branchId: string | null;
  title: string;
  reason: string | null;
  proposedValue: unknown;
  currentValue: unknown;
  baseVersion: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'applied' | 'cancelled';
  authorId: string;
  approverId: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
};

type CatalogDef = {
  key: string;
  label: string;
  description: string | null;
  namespace: string;
  sensitivity: string;
  effective?: { value: unknown; source: string; version: number };
};

const STATUS_META: Record<Draft['status'], string> = {
  draft: 'bg-slate-100 text-slate-600',
  submitted: 'bg-amber-50 text-amber-700 border border-amber-200',
  approved: 'bg-blue-50 text-blue-600 border border-blue-200',
  rejected: 'bg-red-50 text-red-600 border border-red-200',
  applied: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
  cancelled: 'bg-slate-100 text-slate-500',
};

function formatValue(v: unknown, emptyValue: string): string {
  if (v === null || v === undefined) {
    return emptyValue;
  }
  if (typeof v === 'object') {
    return JSON.stringify(v);
  }
  return String(v);
}

function parseValueInput(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }
  if (trimmed === 'true') {
    return true;
  }
  if (trimmed === 'false') {
    return false;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export default function SettingsDraftsPage() {
  const locale = useLocale();
  const t = useTranslations('SettingsDrafts');
  const tSources = useTranslations('SettingsRegistry.sources');
  const { data: session } = authClient.useSession();
  const currentUserId = session?.user?.id;
  const intlLocale = locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-FR';
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [catalog, setCatalog] = useState<CatalogDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [tab, setTab] = useState('open');

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ key: '', title: '', reason: '', value: '' });

  const [review, setReview] = useState<{ draft: Draft; action: 'approve' | 'reject' } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [draftsRes, catalogRes] = await Promise.all([
        fetch('/api/settings/drafts'),
        fetch('/api/settings/catalog'),
      ]);
      const draftsJson = await draftsRes.json();
      const catalogJson = await catalogRes.json();
      if (!draftsRes.ok || !catalogRes.ok || !draftsJson.success || !catalogJson.success) {
        throw new Error('load failed');
      }
      setDrafts(draftsJson.data.drafts);
      setCatalog(catalogJson.data.definitions);
      setLoadError(false);
    } catch {
      setLoadError(true);
      setToast({ type: 'err', msg: t('loadError') });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const t = setTimeout(setToast, 3500, null);
    return () => clearTimeout(t);
  }, [toast]);

  const visible = useMemo(() => {
    if (tab === 'open') {
      return drafts.filter(d => d.status === 'submitted' || d.status === 'draft');
    }
    if (tab === 'done') {
      return drafts.filter(d => ['approved', 'applied', 'rejected', 'cancelled'].includes(d.status));
    }
    return drafts;
  }, [drafts, tab]);

  const selectedDef = catalog.find(c => c.key === form.key);
  const isComplex = selectedDef ? typeof selectedDef.effective?.value === 'object' && selectedDef.effective?.value !== null : false;

  const submit = async (path: string, init?: RequestInit) => {
    const res = await fetch(path, init);
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(t('actionError'));
    }
    return json;
  };

  const handleCreate = async () => {
    if (!form.key || !form.title.trim()) {
      setToast({ type: 'err', msg: t('requiredFields') });
      return;
    }
    setCreating(true);
    try {
      await submit('/api/settings/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: form.key,
          title: form.title.trim(),
          reason: form.reason.trim() || undefined,
          proposedValue: parseValueInput(form.value),
        }),
      });
      setToast({ type: 'ok', msg: t('created') });
      setCreateOpen(false);
      setForm({ key: '', title: '', reason: '', value: '' });
      await load();
    } catch (e) {
      setToast({ type: 'err', msg: (e as Error).message });
    } finally {
      setCreating(false);
    }
  };

  const act = async (id: string, action: 'submit' | 'cancel') => {
    setActingId(id);
    try {
      await submit(`/api/settings/drafts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      setToast({ type: 'ok', msg: action === 'submit' ? t('submitted') : t('cancelled') });
      await load();
    } catch (e) {
      setToast({ type: 'err', msg: (e as Error).message });
    } finally {
      setActingId(null);
    }
  };

  const handleReview = async () => {
    if (!review) {
      return;
    }
    setReviewing(true);
    try {
      const path = review.action === 'approve'
        ? `/api/settings/drafts/${review.draft.id}/approve`
        : `/api/settings/drafts/${review.draft.id}/reject`;
      const body = review.action === 'approve' ? { comment: reviewNote || undefined } : { reason: reviewNote || undefined };
      const result = await submit(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setToast({ type: result.data?.conflict ? 'err' : 'ok', msg: review.action === 'approve'
        ? result.data?.conflict ? t('approvedConflict') : t('approvedApplied')
        : t('rejected') });
      setReview(null);
      setReviewNote('');
      await load();
    } catch (e) {
      setToast({ type: 'err', msg: (e as Error).message });
    } finally {
      setReviewing(false);
    }
  };

  if (loading && drafts.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (loadError && drafts.length === 0) {
    return (
      <div
        role="alert"
        className="
          flex flex-col items-center gap-3 rounded-2xl border border-rose-200
          bg-rose-50 p-8 text-rose-700
        "
      >
        <AlertCircle className="size-6" />
        <p className="text-sm font-semibold">{t('loadError')}</p>
        <Button variant="outline" onClick={() => void load()}>{t('retry')}</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{t('title')}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {t('subtitle')}
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="
            h-9 gap-2 rounded-full bg-blue-600 px-5 text-xs font-bold text-white
            hover:bg-blue-700
          "
        >
          <FilePlus2 className="size-4" />
          {t('newProposal')}
        </Button>
      </div>

      {toast && (
        <div
          role={toast.type === 'err' ? 'alert' : 'status'}
          className={`
            flex items-center gap-2 rounded-xl p-3 text-xs font-semibold
            ${
        toast.type === 'ok'
          ? `border border-emerald-200 bg-emerald-50 text-emerald-700`
          : `border border-red-200 bg-red-50 text-red-700`
        }
          `}
        >
          {toast.type === 'ok'
            ? <CheckCircle2 className="size-4 shrink-0" />
            : (
                <AlertCircle className="size-4 shrink-0" />
              )}
          {toast.msg}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="open">{t('openTab', { count: drafts.filter(d => d.status === 'submitted' || d.status === 'draft').length })}</TabsTrigger>
          <TabsTrigger value="done">{t('doneTab', { count: drafts.filter(d => !['submitted', 'draft'].includes(d.status)).length })}</TabsTrigger>
          <TabsTrigger value="all">{t('allTab', { count: drafts.length })}</TabsTrigger>
        </TabsList>
      </Tabs>

      {visible.length === 0 && (
        <div className="
          rounded-2xl border border-dashed border-slate-200 py-16 text-center
          text-sm text-slate-400
        "
        >
          {t('emptyCategory')}
        </div>
      )}

      <div className="space-y-3">
        {visible.map((draft) => {
          const statusClass = STATUS_META[draft.status];
          const def = catalog.find(c => c.key === draft.key);
          return (
            <Card
              key={draft.id}
              className="rounded-2xl border border-slate-200 p-5 shadow-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-slate-800">{draft.title}</h3>
                    <Badge
                      variant="neutral"
                      className={`
                        px-2 text-[10px]
                        ${statusClass}
                      `}
                    >
                      {t(`status.${draft.status}`)}
                    </Badge>
                    <span className="font-mono text-[10px] text-slate-400">{draft.key}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{locale === 'fr' ? def?.label ?? draft.key : draft.key}</p>
                  {draft.reason && (
                    <p className="mt-1 text-xs text-slate-500 italic">
                      «
                      {draft.reason}
                      {' '}
                      »
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {draft.status === 'draft' && currentUserId === draft.authorId && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 rounded-full text-xs"
                        disabled={actingId === draft.id}
                        onClick={() => act(draft.id, 'cancel')}
                      >
                        {t('cancel')}
                      </Button>
                      <Button
                        size="sm"
                        className="
                          h-8 gap-1.5 rounded-full bg-blue-600 text-xs
                          text-white
                          hover:bg-blue-700
                        "
                        disabled={actingId === draft.id}
                        onClick={() => act(draft.id, 'submit')}
                      >
                        <Send className="size-3.5" />
                        {' '}
                        {t('submit')}
                      </Button>
                    </>
                  )}
                  {draft.status === 'submitted' && currentUserId && currentUserId !== draft.authorId && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="
                          h-8 gap-1.5 rounded-full border-red-200 text-xs
                          text-red-600
                          hover:bg-red-50
                        "
                        onClick={() => {
                          setReviewNote('');
                          setReview({ draft, action: 'reject' });
                        }}
                      >
                        <XCircle className="size-3.5" />
                        {' '}
                        {t('reject')}
                      </Button>
                      <Button
                        size="sm"
                        className="
                          h-8 gap-1.5 rounded-full bg-emerald-600 text-xs
                          text-white
                          hover:bg-emerald-700
                        "
                        onClick={() => {
                          setReviewNote('');
                          setReview({ draft, action: 'approve' });
                        }}
                      >
                        <CheckCircle2 className="size-3.5" />
                        {' '}
                        {t('approve')}
                      </Button>
                    </div>
                  )}
                  {draft.status === 'submitted' && currentUserId === draft.authorId && (
                    <span className="text-[11px] text-slate-500">{t('awaitingOtherAdmin')}</span>
                  )}
                </div>
              </div>

              <div className="
                mt-3 grid gap-3
                sm:grid-cols-2
              "
              >
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="
                    mb-1 text-[10px] font-bold tracking-wide text-slate-500
                    uppercase
                  "
                  >
                    {t('currentValue')}
                  </p>
                  <pre className="
                    font-mono text-xs wrap-break-word whitespace-pre-wrap
                    text-slate-600
                  "
                  >
                    {formatValue(draft.currentValue, t('emptyValue'))}
                  </pre>
                  {draft.baseVersion > 0 && (
                    <p className="mt-1 text-[10px] text-slate-400">
                      {t('baseVersion', { version: draft.baseVersion })}
                    </p>
                  )}
                </div>
                <div className="rounded-xl bg-blue-50/60 p-3">
                  <p className="
                    mb-1 text-[10px] font-bold tracking-wide text-blue-600
                    uppercase
                  "
                  >
                    {t('proposedValue')}
                  </p>
                  <pre className="
                    font-mono text-xs wrap-break-word whitespace-pre-wrap
                    text-blue-800
                  "
                  >
                    {formatValue(draft.proposedValue, t('emptyValue'))}
                  </pre>
                </div>
              </div>

              <div className="
                mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]
                text-slate-400
              "
              >
                <span>{t('authorId', { id: draft.authorId.slice(0, 10) })}</span>
                <span>{t('createdAt', { date: new Intl.DateTimeFormat(intlLocale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(draft.createdAt)) })}</span>
                {draft.approverId && <span>{t('reviewerId', { id: draft.approverId.slice(0, 10) })}</span>}
                {draft.rejectionReason && <span className="text-red-500">{t('rejectionReason', { reason: draft.rejectionReason })}</span>}
                {draft.appliedAt && <span>{t('appliedAt', { date: new Intl.DateTimeFormat(intlLocale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(draft.appliedAt)) })}</span>}
              </div>
              {draft.status === 'approved' && (
                <p className="mt-2 text-xs text-amber-700">
                  {t('approvedNotApplied')}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {/* Create draft dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('newProposal')}</DialogTitle>
            <DialogDescription>
              {t('createDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">{t('setting')}</Label>
              <Select value={form.key} onValueChange={k => setForm(f => ({ ...f, key: k, value: '' }))}>
                <SelectTrigger className="h-9 rounded-xl text-xs" aria-label={t('setting')}>
                  <SelectValue placeholder={t('chooseSetting')} />
                </SelectTrigger>
                <SelectContent>
                  {catalog.map(c => (
                    <SelectItem key={c.key} value={c.key}>{locale === 'fr' ? `${c.label} — ${c.key}` : c.key}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {locale === 'fr' && selectedDef && (
              <p className="text-[10px] text-slate-500">{selectedDef.description ?? selectedDef.key}</p>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">{t('proposalTitle')}</Label>
              <Input className="h-9 rounded-xl text-xs" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={t('proposalTitlePlaceholder')} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">{t('newValue')}</Label>
              <Textarea
                className="resize-y rounded-xl font-mono text-xs"
                rows={3}
                value={form.value}
                onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                placeholder={isComplex ? t('jsonPlaceholder') : selectedDef ? t('currentValuePlaceholder', { value: formatValue(selectedDef.effective?.value, t('emptyValue')) }) : ''}
              />
              {selectedDef?.effective && (
                <p className="text-[10px] text-slate-400">{t('effectiveValue', { value: formatValue(selectedDef.effective.value, t('emptyValue')), source: tSources.has(selectedDef.effective.source) ? tSources(selectedDef.effective.source as 'default') : selectedDef.effective.source })}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">{t('reasonOptional')}</Label>
              <Input className="h-9 rounded-xl text-xs" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder={t('reasonPlaceholder')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-9 rounded-full text-xs" onClick={() => setCreateOpen(false)}>{t('cancel')}</Button>
            <Button
              className="
                h-9 rounded-full bg-blue-600 text-xs text-white
                hover:bg-blue-700
              "
              disabled={creating}
              onClick={handleCreate}
            >
              {creating && <Loader2 className="mr-1 size-3.5 animate-spin" />}
              {t('createProposal')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve / reject dialog */}
      <Dialog open={review !== null} onOpenChange={o => !o && setReview(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{review?.action === 'approve' ? t('approveAndApply') : t('rejectProposal')}</DialogTitle>
            <DialogDescription>
              {review?.draft.title}
              {' '}
              —
              {review?.draft.key}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="mb-1 text-[10px] font-bold text-slate-500 uppercase">{t('proposedValue')}</p>
              <pre className="
                font-mono text-xs wrap-break-word whitespace-pre-wrap
                text-slate-700
              "
              >
                {review ? formatValue(review.draft.proposedValue, t('emptyValue')) : ''}
              </pre>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">{review?.action === 'approve' ? t('commentOptional') : t('rejectionReasonLabel')}</Label>
              <Textarea className="resize-y rounded-xl text-xs" rows={2} value={reviewNote} onChange={e => setReviewNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="h-9 rounded-full text-xs" onClick={() => setReview(null)}>{t('cancel')}</Button>
            <Button
              className={`
                h-9 rounded-full text-xs text-white
                ${review?.action === 'approve'
      ? `
        bg-emerald-600
        hover:bg-emerald-700
      `
      : `
        bg-red-600
        hover:bg-red-700
      `}
              `}
              disabled={reviewing}
              onClick={handleReview}
            >
              {reviewing && <Loader2 className="mr-1 size-3.5 animate-spin" />}
              {review?.action === 'approve' ? t('approveAndApply') : t('reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
