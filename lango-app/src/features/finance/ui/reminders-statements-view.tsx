'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  Send,
} from 'lucide-react';

type OverdueInvoice = {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  dueDate: string;
  netAmount: number;
  paidAmount: number;
  status: string;
};

type SendRecord = {
  id: string;
  invoiceNumber: string;
  studentName: string;
  recipientPhone: string;
  body: string;
  status: string;
  sentAt: string;
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  partial: 'bg-amber-100 text-amber-700',
  overdue: 'bg-rose-100 text-rose-600',
};

function formatDate(date: string): string {
  if (!date) return '—';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

export function RemindersStatementsView() {
  const locale = useLocale();
  const dateLocale = locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR';
  const mad = (value: number): string => `${value.toLocaleString(dateLocale, { minimumFractionDigits: 2 })} MAD`;
  const t = useTranslations('Finance');
  const tCommon = useTranslations('Common');
  const tStatus = useTranslations('Status');

  const statusLabels: Record<string, string> = {
    pending: tStatus('pending'),
    partial: tStatus('partial'),
    overdue: tStatus('overdue'),
  };

  const [overdue, setOverdue] = useState<OverdueInvoice[]>([]);
  const [sent, setSent] = useState<SendRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/finance/reminders');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setOverdue((json?.data ?? []) as OverdueInvoice[]);
    } catch {
      setError(t('loadOverdueError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const sendReminder = useCallback(async (invoiceId: string, studentName: string) => {
    setSendingId(invoiceId);
    setFlash(null);
    try {
      const res = await fetch('/api/finance/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFlash(`Échec : ${json?.message ?? `HTTP ${res.status}`}`);
        return;
      }
      const sms = json.data;
      const inv = overdue.find((i) => i.id === invoiceId);
      setSent((prev) => [
        {
          id: sms?.id ?? `${Date.now()}`,
          invoiceNumber: inv?.invoiceNumber ?? invoiceId,
          studentName,
          recipientPhone: sms?.recipientPhone ?? '—',
          body: sms?.body ?? '',
          status: sms?.status ?? 'sent',
          sentAt: sms?.sentAt ?? new Date().toISOString(),
        },
        ...prev,
      ]);
      setFlash(t('reminderSentSuccess', { studentName }));
    } catch {
      setFlash(t('sendReminderError'));
    } finally {
      setSendingId(null);
    }
  }, [overdue, t]);

  const totalOutstanding = overdue.reduce((sum, i) => sum + (Number(i.netAmount) - Number(i.paidAmount)), 0);

  if (loading) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="h-40 animate-pulse bg-slate-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('remindersTitle')}</h1>
          <p className="text-sm text-slate-500">{t('remindersSubtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          aria-label={tCommon('refresh')}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
        >
          <RefreshCw className="w-4 h-4" /> {tCommon('refresh')}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {flash && (
        <div className="p-4 bg-[#DDF5EC] border border-[#17A673]/30 rounded-lg text-[#17A673] text-sm flex items-center gap-2" role="status">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{flash}</span>
        </div>
      )}

      {/* KPI band */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">{t('overdueInvoicesCard')}</p>
            <p className="text-xl font-extrabold text-slate-900">{overdue.length}</p>
            <p className="text-[11px] text-slate-400">{t('pastDueDateSub')}</p>
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">{t('totalOutstandingBalance')}</p>
            <p className="text-xl font-extrabold text-slate-900">{mad(totalOutstanding)}</p>
            <p className="text-[11px] text-slate-400">{t('allOverdueInvoicesSub')}</p>
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DDF5EC] text-[#17A673] flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">{t('remindersSentCard')}</p>
            <p className="text-xl font-extrabold text-slate-900">{sent.length}</p>
            <p className="text-[11px] text-slate-400">{t('thisSessionSub')}</p>
          </div>
        </div>
      </div>

      {/* Overdue invoices */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-rose-600" />
          <h2 className="font-semibold text-slate-900">{t('overdueInvoicesTableTitle')}</h2>
        </div>
        {overdue.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">{t('noOverdueInvoices')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs text-slate-500 border-b border-slate-100">
                  <th className="px-5 py-3 font-semibold">{t('invoiceNumber')}</th>
                  <th className="px-5 py-3 font-semibold">{t('student')}</th>
                  <th className="px-5 py-3 font-semibold">{t('dueDateLabel')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t('amount')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t('paidAmountLabel')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t('balanceCol')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{tCommon('status')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{tCommon('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overdue.map((inv) => {
                  const balance = Number(inv.netAmount) - Number(inv.paidAmount);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3 font-mono text-xs font-bold text-[#0066FF]">{inv.invoiceNumber}</td>
                      <td className="px-5 py-3 font-medium text-slate-800">{inv.studentName}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{formatDate(inv.dueDate)}</td>
                      <td className="px-5 py-3 text-end font-semibold text-slate-800">{mad(Number(inv.netAmount))}</td>
                      <td className="px-5 py-3 text-end text-slate-500">{mad(Number(inv.paidAmount))}</td>
                      <td className="px-5 py-3 text-end font-bold text-rose-600">{mad(balance)}</td>
                      <td className="px-5 py-3 text-end">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[inv.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {statusLabels[inv.status] ?? inv.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-end">
                        <button
                          type="button"
                          disabled={sendingId === inv.id}
                          onClick={() => sendReminder(inv.id, inv.studentName)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0066FF] rounded-lg hover:bg-[#0052CC] disabled:opacity-60 disabled:cursor-not-allowed transition"
                        >
                          {sendingId === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          {t('sendReminderBtn')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Send log */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#0066FF]" />
          <h2 className="font-semibold text-slate-900">{t('sentRemindersLog')}</h2>
        </div>
        {sent.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">{t('noRemindersSent')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs text-slate-500 border-b border-slate-100">
                  <th className="px-5 py-3 font-semibold">{tCommon('date')}</th>
                  <th className="px-5 py-3 font-semibold">{t('student')}</th>
                  <th className="px-5 py-3 font-semibold">{t('invoiceNumber')}</th>
                  <th className="px-5 py-3 font-semibold">{t('recipientCol')}</th>
                  <th className="px-5 py-3 font-semibold">{t('messageCol')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{tCommon('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sent.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3 text-xs text-slate-500">{new Date(s.sentAt).toLocaleString(dateLocale)}</td>
                    <td className="px-5 py-3 font-medium text-slate-800">{s.studentName}</td>
                    <td className="px-5 py-3 font-mono text-xs font-bold text-[#0066FF]">{s.invoiceNumber}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{s.recipientPhone}</td>
                    <td className="px-5 py-3 text-xs text-slate-600 max-w-md truncate" title={s.body}>{s.body}</td>
                    <td className="px-5 py-3 text-end">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#DDF5EC] text-[#17A673]">{t('sentBadge')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 flex items-center gap-1">
        <CheckCircle2 className="w-3.5 h-3.5" /> {t('smsSimulationFooter')}
      </p>
    </div>
  );
}
