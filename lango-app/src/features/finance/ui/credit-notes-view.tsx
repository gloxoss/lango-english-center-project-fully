'use client';

import { CheckCircle2, Plus, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/use-permissions';

type CreditNote = {
  id: string;
  studentId: string;
  studentName: string;
  invoiceId: string | null;
  creditNoteNumber: string;
  amount: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  rejectionReason: string | null;
};

export function CreditNotesView() {
  const t = useTranslations('Finance');
  const tCommon = useTranslations('Common');
  const tStatus = useTranslations('Status');
  const { can } = usePermissions();

  function statusBadge(status: CreditNote['status']) {
    if (status === 'approved') {
      return (
        <Badge className="
          border-none bg-[#DDF5EC] text-[10px] font-bold text-[#17A673]
        "
        >
          {tStatus('approved')}
        </Badge>
      );
    }
    if (status === 'rejected') {
      return (
        <Badge className="
          border-none bg-rose-100 text-[10px] font-bold text-rose-600
        "
        >
          {tStatus('rejected')}
        </Badge>
      );
    }
    return (
      <Badge className="
        border-none bg-amber-100 text-[10px] font-bold text-amber-700
      "
      >
        {tStatus('pending')}
      </Badge>
    );
  }

  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ studentId: '', invoiceId: '', amount: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/finance/credit-notes')
      .then(res => (res.ok ? res.json() : null))
      .then(json => json?.success && setNotes(json.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!form.studentId || !form.amount || !form.reason) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/credit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: form.studentId,
          invoiceId: form.invoiceId || undefined,
          amount: form.amount,
          reason: form.reason,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || json.message || t('requestFailed'));
        return;
      }
      setShowForm(false);
      setForm({ studentId: '', invoiceId: '', amount: '', reason: '' });
      load();
    } catch {
      setError(t('connectionError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDecide = async (id: string, decision: 'approved' | 'rejected') => {
    const rejectionReason = decision === 'rejected' ? (window.prompt(t('rejectReasonPrompt')) ?? undefined) : undefined;
    if (decision === 'rejected' && !rejectionReason) {
      return;
    }
    setDecidingId(id);
    setDecisionError(null);
    try {
      // The response used to be ignored: a refused decision (maker-checker,
      // already decided, closed period) just reloaded the list with no reason.
      const res = await fetch('/api/finance/credit-notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, decision, rejectionReason }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) {
        setDecisionError(json?.error?.message || json?.message || t('requestFailed'));
      }
      load();
    } catch {
      setDecisionError(t('connectionError'));
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="
        flex flex-col justify-between gap-4
        sm:flex-row sm:items-center
      "
      >
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('creditNotesTitle')}</h1>
          <p className="mt-1 text-xs text-slate-500">{t('creditNotesSubtitle', { count: notes.length })}</p>
        </div>
        {can('finance.manage') && (
          <Button
            size="sm"
            onClick={() => setShowForm(v => !v)}
            className="
              h-9 gap-1.5 rounded-xl bg-[#2487B8] text-xs text-white
              hover:bg-[#1B6C93]
            "
          >
            <Plus className="size-3.5" />
            {t('newCreditNoteBtn')}
          </Button>
        )}
      </div>

      {decisionError && (
        <p
          role="alert"
          className="
            rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs
            font-semibold text-rose-700
          "
        >
          {decisionError}
        </p>
      )}

      {can('finance.manage') && showForm && (
        <Card className="
          space-y-3 rounded-2xl border border-slate-200/80 bg-white p-5
          shadow-2xs
        "
        >
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          <div className="
            grid grid-cols-1 gap-3 text-xs
            sm:grid-cols-4
          "
          >
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('studentIdLabel')}</label>
              <Input
                value={form.studentId}
                onChange={e => setForm({ ...form, studentId: e.target.value })}
                className="h-9 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{t('optionalInvoiceIdLabel')}</label>
              <Input
                value={form.invoiceId}
                onChange={e => setForm({ ...form, invoiceId: e.target.value })}
                className="h-9 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">
                {t('amount')}
                {' '}
                (MAD)
              </label>
              <Input
                type="number"
                value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                className="h-9 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{tCommon('reason')}</label>
              <Input
                value={form.reason}
                onChange={e => setForm({ ...form, reason: e.target.value })}
                className="h-9 rounded-xl"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={saving}
              onClick={handleCreate}
              className="
                h-9 rounded-xl bg-[#2487B8] text-xs font-bold text-white
                hover:bg-[#1B6C93]
              "
            >
              {saving ? '...' : t('createCreditNoteBtn')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowForm(false)}
              className="h-9 rounded-xl text-xs font-bold"
            >
              {tCommon('cancel')}
            </Button>
          </div>
        </Card>
      )}

      <Card className="
        overflow-hidden rounded-2xl border border-slate-200/80 bg-white
        shadow-2xs
      "
      >
        <table className="w-full text-start text-xs">
          <thead className="
            border-b border-slate-200/80 bg-[#F6F9FC] font-extrabold
            text-[#16212B]
          "
          >
            <tr>
              <th className="px-4 py-3.5">#</th>
              <th className="px-4 py-3.5">{t('student')}</th>
              <th className="px-4 py-3.5">{tCommon('reason')}</th>
              <th className="px-4 py-3.5 text-end">{t('amount')}</th>
              <th className="px-4 py-3.5 text-center">{tCommon('status')}</th>
              <th className="px-4 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!loading && notes.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400">{t('noCreditNotesRecorded')}</td></tr>
            )}
            {notes.map(n => (
              <tr
                key={n.id}
                className="
                  font-medium transition
                  hover:bg-slate-50/80
                "
              >
                <td className="px-4 py-3.5 font-mono font-bold text-[#2487B8]">{n.creditNoteNumber}</td>
                <td className="px-4 py-3.5 font-bold text-[#16212B]">{n.studentName}</td>
                <td className="px-4 py-3.5 text-slate-500">{n.reason}</td>
                <td className="
                  px-4 py-3.5 text-end font-extrabold text-[#16212B]
                "
                >
                  {Number(n.amount).toLocaleString('fr-FR')}
                  {' '}
                  MAD
                </td>
                <td className="px-4 py-3.5 text-center">{statusBadge(n.status)}</td>
                <td className="px-4 py-3.5">
                  {n.status === 'pending' && can('finance.approve') && (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        disabled={decidingId === n.id}
                        onClick={() => handleDecide(n.id, 'approved')}
                        className="
                          rounded-lg p-1.5 text-slate-400
                          hover:bg-[#DDF5EC] hover:text-[#17A673]
                        "
                      >
                        <CheckCircle2 className="size-3.5" />
                      </button>
                      <button
                        disabled={decidingId === n.id}
                        onClick={() => handleDecide(n.id, 'rejected')}
                        className="
                          rounded-lg p-1.5 text-slate-400
                          hover:bg-rose-50 hover:text-rose-600
                        "
                      >
                        <XCircle className="size-3.5" />
                      </button>
                    </div>
                  )}
                  {n.status === 'pending' && !can('finance.approve') && (
                    <span className="text-[10px] font-semibold text-slate-400">{t('awaitingAdminApproval')}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
