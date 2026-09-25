'use client';

import { AlertCircle, CheckCircle2, FileText, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cndpStatusOf } from '@/features/settings/cndp-status';

type FilingData = {
  id: string;
  filingReference: string | null;
  filedAt: string | null;
  status: 'draft' | 'submitted' | 'approved';
  notes: string | null;
};

export function CndpComplianceView() {
  const t = useTranslations('CndpCompliance');
  const [filing, setFiling] = useState<FilingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Shared with the header badge so the two can never describe the same filing
  // differently.
  const filingStatus = cndpStatusOf(filing?.status);

  const [reference, setReference] = useState('');
  const [filedAt, setFiledAt] = useState('');
  const [status, setStatus] = useState<'draft' | 'submitted' | 'approved'>('draft');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetch('/api/settings/cndp-filing')
      .then(async (res) => {
        // A failed read used to look exactly like "never filed".
        if (!res.ok) {
          throw new Error('load failed');
        }
        return res.json();
      })
      .then((json) => {
        if (json?.success && json?.data) {
          const d: FilingData = json.data;
          setFiling(d);
          setReference(d.filingReference || '');
          setFiledAt(d.filedAt || '');
          setStatus(d.status);
          setNotes(d.notes || '');
        }
      })
      .catch(() => setError(t('loadError')))
      .finally(() => setLoading(false));
  }, []);

  const approvedIncomplete = status === 'approved' && (!reference.trim() || !filedAt);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (approvedIncomplete) {
      setError(t('approvedNeedsReceipt'));
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/settings/cndp-filing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filingReference: reference,
          filedAt: filedAt || undefined,
          status,
          notes,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || t('saveError'));
        return;
      }

      setFiling(json.data);
      setSuccess(t('saved'));
    } catch {
      setError(t('networkError'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-xs font-semibold text-slate-500">{t('loading')}</div>;
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div className="
        flex items-center justify-between border-b border-slate-200/80 pb-3
      "
      >
        <div>
          <h1 className="
            flex items-center gap-2 text-2xl font-extrabold tracking-tight
            text-[#16212B]
          "
          >
            <ShieldCheck className="size-6 text-[#2487B8]" />
            <span>{t('title')}</span>
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="
            flex items-center gap-2.5 rounded-xl border border-rose-200
            bg-rose-50 p-3.5 text-xs font-semibold text-rose-700
          "
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="
            flex items-center gap-2.5 rounded-xl border border-emerald-200
            bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-700
          "
        >
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="
        grid grid-cols-1 gap-6
        lg:grid-cols-3
      "
      >
        <Card className="
          space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6
          shadow-2xs
          lg:col-span-2
        "
        >
          <h3 className="
            flex items-center gap-2 text-sm font-extrabold text-[#16212B]
          "
          >
            <FileText className="size-4 text-[#2487B8]" />
            <span>{t('formTitle')}</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label
                htmlFor="cndp-ref"
                className="text-xs font-bold text-slate-700"
              >
                {t('referenceLabel')}
              </Label>
              <Input
                id="cndp-ref"
                type="text"
                maxLength={100}
                placeholder={t('referencePlaceholder')}
                value={reference}
                onChange={e => setReference(e.target.value)}
                className="h-10 rounded-xl text-xs"
              />
            </div>

            <div className="
              grid grid-cols-1 gap-4
              sm:grid-cols-2
            "
            >
              <div className="space-y-1.5">
                <Label
                  htmlFor="cndp-date"
                  className="text-xs font-bold text-slate-700"
                >
                  {t('dateLabel')}
                </Label>
                <Input
                  id="cndp-date"
                  type="date"
                  value={filedAt}
                  onChange={e => setFiledAt(e.target.value)}
                  className="h-10 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="cndp-status"
                  className="text-xs font-bold text-slate-700"
                >
                  {t('statusLabel')}
                </Label>
                <select
                  id="cndp-status"
                  value={status}
                  onChange={e => setStatus(e.target.value as FilingData['status'])}
                  className="
                    h-10 w-full rounded-xl border border-slate-200 bg-white px-3
                    text-xs font-semibold text-slate-800
                    focus:border-[#2487B8] focus:outline-none
                  "
                >
                  <option value="draft">{t('optionDraft')}</option>
                  <option value="submitted">{t('optionSubmitted')}</option>
                  <option value="approved">{t('optionApproved')}</option>
                </select>
              </div>
            </div>
            {approvedIncomplete && <p className="text-[11px] text-amber-700">{t('approvedNeedsReceipt')}</p>}

            <div className="space-y-1.5">
              <Label
                htmlFor="cndp-notes"
                className="text-xs font-bold text-slate-700"
              >
                {t('notesLabel')}
              </Label>
              <textarea
                id="cndp-notes"
                rows={3}
                maxLength={2000}
                placeholder={t('notesPlaceholder')}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="
                  w-full rounded-xl border border-slate-200 p-3 text-xs
                  focus:border-[#2487B8] focus:outline-none
                "
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={saving || approvedIncomplete}
                className="
                  h-10 rounded-xl bg-[#2487B8] px-5 text-xs font-bold text-white
                  hover:bg-[#1B6C93]
                "
              >
                {saving ? t('saving') : t('save')}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="
          space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6
          shadow-2xs
        "
        >
          <h3 className="text-sm font-extrabold text-[#16212B]">{t('statusCardTitle')}</h3>
          <div className="
            space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs
          "
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-500">{t('referenceShort')}</span>
              <span className="font-mono font-bold text-[#16212B]">{filing?.filingReference || t('noReceipt')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-500">{t('currentStatus')}</span>
              <span className={`
                rounded-full px-2 py-0.5 text-[10px] font-bold capitalize
                ${
    filingStatus.tone === 'good'
      ? 'bg-emerald-100 text-emerald-800'
      : filingStatus.tone === 'progress'
        ? 'bg-blue-100 text-blue-800'
        : `bg-slate-200 text-slate-700`
    }
              `}
              >
                {t(`status.${filingStatus.key}`)}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">{t('selfDeclaredNote')}</p>
        </Card>
      </div>
    </div>
  );
}
