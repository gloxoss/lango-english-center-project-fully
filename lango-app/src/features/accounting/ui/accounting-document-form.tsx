'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Account = { id: string; code: string; name: string };

export function AccountingDocumentForm({ mode, locale = 'fr' }: { mode: 'deposit' | 'expense'; locale?: string }) {
  const t = useTranslations('Finance');
  const tCommon = useTranslations('Common');

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journals, setJournals] = useState<{ id: string; code: string; name: string }[]>([]);
  const [vouchers, setVouchers] = useState<{ id: string; code: string; name: string; journalCode: string }[]>([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    reference: '',
    counterparty: '',
    description: '',
    amount: '',
    debitAccountId: '',
    creditAccountId: '',
    journalCode: '',
    voucherTypeCode: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/finance/accounting/accounts?pageSize=100')
      .then(response => response.json())
      .then((json) => {
        if (json.success) setAccounts(json.data);
      })
      .catch(() => setError(t('failedToLoadAccounts')));
    fetch('/api/finance/accounting/journals')
      .then(response => response.json())
      .then((json) => {
        if (json.success) setJournals(json.data);
      })
      .catch(() => {});
    fetch('/api/finance/accounting/voucher-types')
      .then(response => response.json())
      .then((json) => {
        if (json.success) setVouchers(json.data);
      })
      .catch(() => {});
  }, [t]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const idempotencyKey = `${mode}:${form.reference}:${form.date}:${form.amount}`;
    const endpoint = mode === 'deposit' ? '/api/finance/accounting/deposits' : '/api/finance/accounting/expenses';
    const payload = mode === 'deposit'
      ? {
          entryDate: form.date,
          receivedIntoAccountId: form.debitAccountId,
          offsetAccountId: form.creditAccountId,
          amount: form.amount,
          reference: form.reference,
          description: form.description,
          sourceVersion: 1,
          idempotencyKey,
          journalCode: form.journalCode,
          voucherTypeCode: form.voucherTypeCode,
        }
      : {
          documentDate: form.date,
          reference: form.reference,
          counterparty: form.counterparty,
          description: form.description,
          expenseAccountId: form.debitAccountId,
          settlementAccountId: form.creditAccountId,
          amount: form.amount,
        };
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message ?? t('recordingFailed'));
      setMessage(
        mode === 'deposit'
          ? t('depositRecordedSuccess', { entryNumber: json.data.entry.entryNumber })
          : t('draftExpenseCreatedSuccess', { id: json.data.id })
      );
      setForm(current => ({ ...current, reference: '', counterparty: '', description: '', amount: '' }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('recordingFailed'));
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B]">
          {mode === 'deposit' ? t('accountingDepositTitle') : t('accountingExpenseTitle')}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          {mode === 'deposit' ? t('accountingDepositDesc') : t('accountingExpenseDesc')}
        </p>
      </div>

      {message && (
        <div className="flex gap-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 className="size-5 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="rounded-2xl p-6">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 text-start">
          <label className="text-xs font-bold">
            {tCommon('date')}
            <Input
              type="date"
              required
              value={form.date}
              onChange={event => field('date', event.target.value)}
              className="mt-1"
            />
          </label>
          <label className="text-xs font-bold">
            {t('referenceLabel')}
            <Input
              required
              value={form.reference}
              onChange={event => field('reference', event.target.value)}
              className="mt-1"
            />
          </label>
          {mode === 'expense' && (
            <label className="text-xs font-bold sm:col-span-2">
              {t('counterpartyLabel')}
              <Input
                required
                value={form.counterparty}
                onChange={event => field('counterparty', event.target.value)}
                className="mt-1"
              />
            </label>
          )}
          <label className="text-xs font-bold">
            {mode === 'deposit' ? t('debitAccountDepositLabel') : t('debitAccountExpenseLabel')}
            <select
              required
              value={form.debitAccountId}
              onChange={event => field('debitAccountId', event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs"
            >
              <option value="">{tCommon('select')}</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.code} — {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold">
            {mode === 'deposit' ? t('creditAccountDepositLabel') : t('creditAccountExpenseLabel')}
            <select
              required
              value={form.creditAccountId}
              onChange={event => field('creditAccountId', event.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs"
            >
              <option value="">{tCommon('select')}</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.code} — {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold">
            {t('amountMadLabel')}
            <Input
              required
              inputMode="decimal"
              pattern="[0-9]+([.][0-9]{1,2})?"
              value={form.amount}
              onChange={event => field('amount', event.target.value)}
              className="mt-1"
            />
          </label>
          {mode === 'deposit' && (
            <>
              <label className="text-xs font-bold">
                {t('journalCodeLabel')}
                <select
                  required
                  value={form.journalCode}
                  onChange={event => {
                    field('journalCode', event.target.value);
                    field('voucherTypeCode', '');
                  }}
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs"
                >
                  <option value="">{tCommon('select')}</option>
                  {journals.map(journal => (
                    <option key={journal.id} value={journal.code}>
                      {journal.code} — {journal.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold">
                {t('voucherTypeLabel')}
                <select
                  required
                  value={form.voucherTypeCode}
                  onChange={event => field('voucherTypeCode', event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-xs"
                >
                  <option value="">{tCommon('select')}</option>
                  {vouchers
                    .filter(v => !form.journalCode || v.journalCode === form.journalCode)
                    .map(voucher => (
                      <option key={voucher.id} value={voucher.code}>
                        {voucher.code} — {voucher.name}
                      </option>
                    ))}
                </select>
              </label>
            </>
          )}
          <label className="text-xs font-bold sm:col-span-2">
            {tCommon('description')}
            <Input
              required
              value={form.description}
              onChange={event => field('description', event.target.value)}
              className="mt-1"
            />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving} className="bg-[#2487B8] text-white hover:bg-[#1B6C93]">
              {saving
                ? tCommon('saving')
                : mode === 'deposit'
                  ? t('postDepositBtn')
                  : t('createExpenseDraftBtn')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
