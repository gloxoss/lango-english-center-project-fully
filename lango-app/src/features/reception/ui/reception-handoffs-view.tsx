'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle, CheckCircle2, ListTodo, Loader2, Plus, UserCheck, XCircle,
} from 'lucide-react';
import { PortalStateView } from '@/components/shared/portal-state';
import {
  api,
  fmtDateTime,
  CATEGORY_KEYS,
  HANDOFF_PRIORITY_KEYS,
  HANDOFF_STATUS_KEYS,
  type Handoff,
} from './reception-api';

type Staff = { id: string; name: string; role: string };

export function ReceptionHandoffsView() {
  const t = useTranslations('Reception');
  const locale = useLocale();

  const [data, setData] = useState<Handoff[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('all');
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [resolving, setResolving] = useState<Handoff | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ pageSize: '100' });
    if (status !== 'all') qs.set('status', status);
    if (assignedToMe) qs.set('assignedToMe', 'true');
    const res = await api<Handoff[]>(`/api/reception/handoffs?${qs}`);
    setLoading(false);
    if (res.ok && Array.isArray(res.data)) {
      setData(res.data);
      setTotal(res.total ?? 0);
    } else {
      setError(res.error?.message ?? t('errorLoad'));
    }
  }, [status, assignedToMe, t]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: 'acknowledge' | 'cancel', body: Record<string, unknown> = {}) => {
    setActionMsg(null);
    const res = await api(`/api/reception/handoffs/${id}/${action}`, { method: 'POST', body });
    if (!res.ok) {
      setActionMsg(res.error?.message ?? t('actionFailed'));
      return;
    }
    setActionMsg(t('actionSuccess'));
    load();
  };

  const openCreate = () => {
    loadStaff(setStaff);
    setCreateOpen(true);
  };

  if (loading && data.length === 0) return <PortalStateView state="loading" />;
  if (error && data.length === 0) {
    return <PortalStateView state="error" action={<Button size="sm" variant="outline" onClick={load}>{t('retry')}</Button>} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('handoffsTitle')}</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            {t('handoffsSubtitle')}
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5 bg-[#2487B8] hover:bg-[#1B6C93] text-white">
          <Plus className="h-4 w-4" /> {t('btnNewHandoff')}
        </Button>
      </div>

      {actionMsg && <p className="text-sm text-emerald-600">{actionMsg}</p>}

      <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="hf-status">{t('filterStatus')}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="hf-status" className="w-44" aria-label={t('filterStatus')}><SelectValue placeholder={t('filterStatus')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filterStatusAll')}</SelectItem>
                <SelectItem value="open">{t('statusOpen')}</SelectItem>
                <SelectItem value="acknowledged">{t('statusAcknowledged')}</SelectItem>
                <SelectItem value="resolved">{t('statusResolved')}</SelectItem>
                <SelectItem value="cancelled">{t('statusCancelled')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant={assignedToMe ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAssignedToMe((v) => !v)}
            className="gap-1.5"
          >
            <UserCheck className="h-3.5 w-3.5" /> {t('btnMyTasks')}
          </Button>
          <span className="ml-auto text-xs text-slate-400">{t('totalHandoffsCount', { count: total })}</span>
        </div>

        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">{t('noHandoffsFound')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left rtl:text-right text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 rtl:pr-0 rtl:pl-3 font-bold">{t('colTitle')}</th>
                  <th className="py-2 pr-3 rtl:pr-0 rtl:pl-3 font-bold">{t('colCategory')}</th>
                  <th className="py-2 pr-3 rtl:pr-0 rtl:pl-3 font-bold">{t('colAssignedTo')}</th>
                  <th className="py-2 pr-3 rtl:pr-0 rtl:pl-3 font-bold">{t('colPriority')}</th>
                  <th className="py-2 pr-3 rtl:pr-0 rtl:pl-3 font-bold">{t('colDeadline')}</th>
                  <th className="py-2 pr-3 rtl:pr-0 rtl:pl-3 font-bold">{t('colStatus')}</th>
                  <th className="py-2 font-bold text-right rtl:text-left">{t('colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((h) => (
                  <tr key={h.id} className="align-top">
                    <td className="py-2.5 pr-3 rtl:pr-0 rtl:pl-3">
                      <p className="font-semibold text-[#16212B]">{h.title}</p>
                      {h.description ? <p className="max-w-xs text-xs text-slate-500">{h.description}</p> : null}
                    </td>
                    <td className="py-2.5 pr-3 rtl:pr-0 rtl:pl-3 text-slate-600">
                      {CATEGORY_KEYS[h.category] ? t(CATEGORY_KEYS[h.category] as any) : h.category}
                    </td>
                    <td className="py-2.5 pr-3 rtl:pr-0 rtl:pl-3 text-slate-600">{h.assignedToName ?? '—'}</td>
                    <td className="py-2.5 pr-3 rtl:pr-0 rtl:pl-3">
                      <Badge className={h.priority === 'urgent' || h.priority === 'high' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}>
                        {HANDOFF_PRIORITY_KEYS[h.priority] ? t(HANDOFF_PRIORITY_KEYS[h.priority] as any) : h.priority}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3 rtl:pr-0 rtl:pl-3 font-mono text-xs text-slate-500">{h.deadline ? fmtDateTime(h.deadline, locale) : '—'}</td>
                    <td className="py-2.5 pr-3 rtl:pr-0 rtl:pl-3">
                      <Badge className="bg-[#DCEBF4] text-[#1B6C93]">
                        {HANDOFF_STATUS_KEYS[h.status] ? t(HANDOFF_STATUS_KEYS[h.status] as any) : h.status}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-right rtl:text-left">
                      <div className="flex flex-wrap justify-end rtl:justify-start gap-1">
                        {h.status === 'open' && (
                          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => act(h.id, 'acknowledge')}>
                            <UserCheck className="h-3 w-3" /> {t('btnAcknowledge')}
                          </Button>
                        )}
                        {(h.status === 'open' || h.status === 'acknowledged') && (
                          <Button size="sm" variant="outline" className="h-7 text-[11px] text-emerald-700" onClick={() => setResolving(h)}>
                            <CheckCircle2 className="h-3 w-3" /> {t('btnResolve')}
                          </Button>
                        )}
                        {h.status === 'open' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] text-rose-600"
                            onClick={() => act(h.id, 'cancel', { reason: t('cancelReasonReception') })}
                          >
                            <XCircle className="h-3 w-3" /> {t('btnCancel')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateHandoffDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        staff={staff}
        onCreated={() => { setCreateOpen(false); load(); }}
      />

      <ResolveHandoffDialog
        handoff={resolving}
        onClose={() => setResolving(null)}
        onDone={() => { setResolving(null); load(); }}
      />
    </div>
  );
}

async function loadStaff(setter: (s: Staff[]) => void) {
  const res = await api<Staff[]>('/api/reception/staff');
  if (res.ok && Array.isArray(res.data)) setter(res.data);
}

function CreateHandoffDialog({ open, onOpenChange, staff, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  staff: Staff[];
  onCreated: () => void;
}) {
  const t = useTranslations('Reception');

  const [form, setForm] = useState({
    category: 'admin', title: '', description: '', priority: 'medium',
    assignedToId: '', deadline: '', subjectType: '', subjectId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idem, setIdem] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        category: 'admin', title: '', description: '', priority: 'medium',
        assignedToId: '', deadline: '', subjectType: '', subjectId: '',
      });
      setError(null);
      setIdem(crypto.randomUUID());
    }
  }, [open]);

  const submit = async () => {
    if (!form.title.trim()) {
      setError(t('errTitleRequired'));
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await api<{ data: Handoff }>('/api/reception/handoffs', {
      method: 'POST',
      body: {
        category: form.category,
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        assignedToId: form.assignedToId || null,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
        subjectType: form.subjectType.trim() || null,
        subjectId: form.subjectId.trim() || null,
        idempotencyKey: idem,
      },
    });
    setSubmitting(false);
    if (res.ok) onCreated();
    else setError(res.error?.message ?? t('actionFailed'));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg" aria-describedby="handoff-dialog-desc">
        <DialogHeader>
          <DialogTitle>{t('newHandoffTitle')}</DialogTitle>
          <DialogDescription id="handoff-dialog-desc">
            {t('newHandoffDesc')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="hf-title">{t('labelTitle')}</Label>
            <Input id="hf-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t('phHandoffTitle')} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hf-cat">{t('labelCategory')}</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger id="hf-cat" aria-label={t('labelCategory')}><SelectValue placeholder={t('labelCategory')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admissions">{t('catAdmissions')}</SelectItem>
                  <SelectItem value="finance">{t('catFinance')}</SelectItem>
                  <SelectItem value="teacher">{t('catTeacher')}</SelectItem>
                  <SelectItem value="admin">{t('catAdmin')}</SelectItem>
                  <SelectItem value="security">{t('catSecurity')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hf-prio">{t('labelPriority')}</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger id="hf-prio" aria-label={t('labelPriority')}><SelectValue placeholder={t('labelPriority')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t('priorityLow')}</SelectItem>
                  <SelectItem value="medium">{t('priorityMedium')}</SelectItem>
                  <SelectItem value="high">{t('priorityHigh')}</SelectItem>
                  <SelectItem value="urgent">{t('priorityUrgent')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hf-desc">{t('labelDescription')}</Label>
            <Textarea id="hf-desc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('phHandoffDesc')} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hf-assign">{t('labelAssignedStaff')}</Label>
              <Select value={form.assignedToId} onValueChange={(v) => setForm({ ...form, assignedToId: v })}>
                <SelectTrigger id="hf-assign" aria-label={t('labelAssignedStaff')}><SelectValue placeholder={t('phStaffMember')} /></SelectTrigger>
                <SelectContent>
                  {staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hf-deadline">{t('labelDeadlineDate')}</Label>
              <Input id="hf-deadline" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hf-subject-type">{t('labelSubjectType')}</Label>
              <Select value={form.subjectType} onValueChange={(v) => setForm({ ...form, subjectType: v })}>
                <SelectTrigger id="hf-subject-type" aria-label={t('labelSubjectType')}><SelectValue placeholder={t('labelSubjectType')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t('optNone')}</SelectItem>
                  <SelectItem value="student">{t('typeStudent')}</SelectItem>
                  <SelectItem value="guardian">{t('typeGuardian')}</SelectItem>
                  <SelectItem value="visitor">{t('typeVisitor')}</SelectItem>
                  <SelectItem value="appointment">{t('typeAppointment')}</SelectItem>
                  <SelectItem value="inquiry">{t('typeInquiry')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hf-subject-id">{t('labelSubjectId')}</Label>
              <Input id="hf-subject-id" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} placeholder={t('phSubjectId')} />
            </div>
          </div>
          {error && <p className="flex items-center gap-1 text-sm text-rose-600" role="alert"><AlertCircle className="h-4 w-4" />{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>{t('btnCancel')}</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin rtl:mr-0 rtl:ml-1" /> : <ListTodo className="mr-1 h-4 w-4 rtl:mr-0 rtl:ml-1" />} {t('btnCreate')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResolveHandoffDialog({ handoff, onClose, onDone }: {
  handoff: Handoff | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('Reception');

  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (handoff) { setNotes(''); setError(null); }
  }, [handoff]);

  if (!handoff) return null;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const res = await api(`/api/reception/handoffs/${handoff.id}/resolve`, {
      method: 'POST',
      body: { resolutionNotes: notes.trim() },
    });
    setSubmitting(false);
    if (res.ok) onDone();
    else setError(res.error?.message ?? t('actionFailed'));
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !submitting) onClose(); }}>
      <DialogContent className="sm:max-w-lg" aria-describedby="resolve-desc">
        <DialogHeader>
          <DialogTitle>{t('resolveHandoffTitle', { title: handoff.title })}</DialogTitle>
          <DialogDescription id="resolve-desc">{t('resolveHandoffDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rsv-notes">{t('labelResolutionNotes')}</Label>
            <Textarea id="rsv-notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('phResolutionNotes')} />
          </div>
          {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>{t('btnClose')}</Button>
            <Button onClick={submit} disabled={submitting || notes.trim().length === 0}>
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin rtl:mr-0 rtl:ml-1" /> : <CheckCircle2 className="mr-1 h-4 w-4 rtl:mr-0 rtl:ml-1" />} {t('btnResolve')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
