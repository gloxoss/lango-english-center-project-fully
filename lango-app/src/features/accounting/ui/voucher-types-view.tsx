'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Journal = { id: string; code: string; name: string; journalType: string };
type Voucher = {
  id: string;
  code: string;
  name: string;
  journalCode: string;
  sourceModule: string | null;
  requiresApproval: boolean;
  isActive: boolean;
};

export function VoucherTypesView({ locale: _locale }: { locale?: string } = {}) {
  const t = useTranslations('Finance');
  const tCommon = useTranslations('Common');

  const [journals, setJournals] = useState<Journal[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [journal, setJournal] = useState({ code: '', name: '', journalType: 'general' });
  const [voucher, setVoucher] = useState({
    code: '',
    name: '',
    journalId: '',
    sourceModule: '',
    requiresApproval: true,
  });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [journalsResponse, vouchersResponse] = await Promise.all([
        fetch('/api/finance/accounting/journals'),
        fetch('/api/finance/accounting/voucher-types'),
      ]);
      const [journalsJson, vouchersJson] = await Promise.all([
        journalsResponse.json(),
        vouchersResponse.json(),
      ]);
      if (journalsJson.success) setJournals(journalsJson.data);
      if (vouchersJson.success) setVouchers(vouchersJson.data);
    } catch {
      setError(t('loadingFailed'));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (url: string, body: unknown) => {
    setError(null);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error?.message ?? t('recordingFailed'));
    await load();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="text-start">
        <h1 className="text-2xl font-extrabold text-[#16212B]">{t('journalsAndVouchersTitle')}</h1>
        <p className="mt-1 text-xs text-slate-500">{t('journalsAndVouchersSubtitle')}</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2 text-start">
        <Card className="rounded-2xl p-5 border-slate-200/80">
          <h2 className="mb-4 font-bold text-slate-900">{t('newJournalCardTitle')}</h2>
          <div className="grid gap-3">
            <Input
              placeholder={`${tCommon('code')} (GEN, BQ…)`}
              value={journal.code}
              onChange={event => setJournal({ ...journal, code: event.target.value.toUpperCase() })}
              className="text-xs"
            />
            <Input
              placeholder={tCommon('name')}
              value={journal.name}
              onChange={event => setJournal({ ...journal, name: event.target.value })}
              className="text-xs"
            />
            <select
              value={journal.journalType}
              onChange={event => setJournal({ ...journal, journalType: event.target.value })}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-xs"
            >
              {['sales', 'cash', 'bank', 'purchase', 'general', 'opening', 'closing'].map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <Button
              onClick={() => void post('/api/finance/accounting/journals', journal).catch(cause => setError(cause.message))}
              className="bg-[#2487B8] text-white hover:bg-[#1B6C93] text-xs"
            >
              {t('createJournalBtn')}
            </Button>
          </div>
        </Card>

        <Card className="rounded-2xl p-5 border-slate-200/80">
          <h2 className="mb-4 font-bold text-slate-900">{t('newVoucherTypeCardTitle')}</h2>
          <div className="grid gap-3">
            <Input
              placeholder={tCommon('code')}
              value={voucher.code}
              onChange={event => setVoucher({ ...voucher, code: event.target.value.toUpperCase() })}
              className="text-xs"
            />
            <Input
              placeholder={tCommon('name')}
              value={voucher.name}
              onChange={event => setVoucher({ ...voucher, name: event.target.value })}
              className="text-xs"
            />
            <select
              value={voucher.journalId}
              onChange={event => setVoucher({ ...voucher, journalId: event.target.value })}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-xs"
            >
              <option value="">{t('colJournal')}…</option>
              {journals.map(item => (
                <option key={item.id} value={item.id}>
                  {item.code} — {item.name}
                </option>
              ))}
            </select>
            <Input
              placeholder={t('optionalSourceModule')}
              value={voucher.sourceModule}
              onChange={event => setVoucher({ ...voucher, sourceModule: event.target.value })}
              className="text-xs"
            />
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={voucher.requiresApproval}
                onChange={event => setVoucher({ ...voucher, requiresApproval: event.target.checked })}
                className="rounded border-slate-300"
              />
              <span>{t('requiresApprovalLabel')}</span>
            </label>
            <Button
              onClick={() =>
                void post('/api/finance/accounting/voucher-types', {
                  ...voucher,
                  sourceModule: voucher.sourceModule || null,
                }).catch(cause => setError(cause.message))
              }
              className="bg-[#2487B8] text-white hover:bg-[#1B6C93] text-xs"
            >
              {t('createVoucherTypeBtn')}
            </Button>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-2xl border-slate-200/80">
        <table className="w-full text-start text-xs">
          <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
            <tr>
              <th className="p-3 text-start">{tCommon('code')}</th>
              <th className="p-3 text-start">{tCommon('name')}</th>
              <th className="p-3 text-start">{t('colJournal')}</th>
              <th className="p-3 text-start">{t('colSourceModule')}</th>
              <th className="p-3 text-start">{t('colControl')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vouchers.map(item => (
              <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="p-3 font-mono font-bold text-slate-800">{item.code}</td>
                <td className="p-3 font-medium text-slate-900">{item.name}</td>
                <td className="p-3 text-slate-600">{item.journalCode}</td>
                <td className="p-3 text-slate-500">{item.sourceModule ?? tCommon('all')}</td>
                <td className="p-3 font-semibold">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-[10px] ${
                      item.requiresApproval
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {item.requiresApproval ? t('ctrlApproval') : t('ctrlDirect')}
                  </span>
                </td>
              </tr>
            ))}
            {vouchers.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">
                  {tCommon('empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
