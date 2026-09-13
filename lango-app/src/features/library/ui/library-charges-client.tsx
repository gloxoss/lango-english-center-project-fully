'use client';

import { useCallback, useEffect, useState } from 'react';
import { Receipt, RefreshCw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Charge = { id: string; memberId: string; loanId: string | null; amount: string; reason: string; state: string; waivedById: string | null; waivedAt: string | null; waiverReason: string | null; createdAt: string };

export function LibraryChargesClient() {
  const t = useTranslations('Library');
  const locale = useLocale();
  const [charges, setCharges] = useState<Charge[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [posting, setPosting] = useState<string | null>(null);

  const stateLabels: Record<string, { label: string; cls: string }> = {
    open: { label: t('stateWaiting'), cls: 'bg-amber-50 text-amber-700' },
    waived: { label: t('stateWaived'), cls: 'bg-slate-100 text-slate-500' },
    posted: { label: t('statePosted'), cls: 'bg-[#DDF5EC] text-[#17A673]' },
  };

  const reasonLabels: Record<string, string> = {
    overdue_fine: t('chargeReasonOverdueFine'),
    lost_copy: t('chargeReasonLostCopy'),
    damage: t('chargeReasonDamage'),
  };

  const load = useCallback(async () => {
    const r = await fetch('/api/addons/library/charges', { cache: 'no-store' });
    const j = await r.json();
    if (j.success) setCharges(j.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(path: string, body: object, ok: string) {
    setBusy(true);
    setMessage(null);
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (j.success) {
        setMessage(j.data?.blocked ? t('postingBlocked', { reason: j.data.reason ?? t('operationFailed') }) : ok);
      } else {
        setMessage(j.error?.message ?? t('operationFailed'));
      }
      await load();
    } finally {
      setBusy(false);
      setPosting(null);
    }
  }

  function waive(c: Charge) {
    const reason = window.prompt(t('waiveReasonPrompt'));
    if (reason) void post(`/api/addons/library/charges/${c.id}/waive`, { reason }, t('chargeWaivedMsg'));
  }

  function postCharge(c: Charge) {
    setPosting(c.id);
    const journalCode = window.prompt(t('journalCodePrompt'));
    if (!journalCode) {
      setPosting(null);
      return;
    }
    const voucherTypeCode = window.prompt(t('voucherTypePrompt'));
    if (!voucherTypeCode) {
      setPosting(null);
      return;
    }
    void post(`/api/addons/library/charges/${c.id}/post`, { journalCode, voucherTypeCode }, t('chargePostedMsg'));
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR');

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B]">{t('chargesTitle')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('chargesSubtitle')}</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={busy}>
          <RefreshCw className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t('refresh')}
        </Button>
      </div>

      {message && <p role="status" className="text-sm">{message}</p>}

      <Card className="p-4">
        {charges.length === 0 ? (
          <div className="py-12 text-center">
            <Receipt className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="font-medium">{t('noCharges')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left rtl:text-right text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="p-3">{t('reason')}</th>
                  <th className="p-3">{t('amount')}</th>
                  <th className="p-3">{t('status')}</th>
                  <th className="p-3">{t('thCreatedAt')}</th>
                  <th className="p-3">{t('thDetail')}</th>
                  <th className="p-3 text-right rtl:text-left">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {charges.map(c => {
                  const s = stateLabels[c.state] ?? { label: c.state, cls: 'bg-slate-100 text-slate-500' };
                  return (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="p-3 font-medium">{reasonLabels[c.reason] ?? c.reason}</td>
                      <td className="p-3 font-bold">{Number(c.amount).toFixed(2)} DH</td>
                      <td className="p-3"><Badge className={s.cls}>{s.label}</Badge></td>
                      <td className="p-3">{formatDate(c.createdAt)}</td>
                      <td className="p-3 text-xs">{c.waiverReason ?? `${t('thMember')} ${c.memberId.slice(0, 8)}`}</td>
                      <td className="p-3 text-right rtl:text-left">
                        <div className="flex justify-end rtl:justify-start gap-2">
                          {c.state === 'open' && (
                            <>
                              <Button variant="outline" size="sm" disabled={busy} onClick={() => waive(c)}>
                                {t('btnWaive')}
                              </Button>
                              <Button variant="outline" size="sm" disabled={busy} onClick={() => postCharge(c)}>
                                {posting === c.id ? '…' : t('btnPost')}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
