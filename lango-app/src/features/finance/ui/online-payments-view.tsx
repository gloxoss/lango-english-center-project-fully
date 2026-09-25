'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, CreditCard } from 'lucide-react';
import { formatMoney } from '@/libs/finance/format-money';

type Payment = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  amount: string;
  paymentMethod: string;
  paymentDate: string;
  referenceId: string | null;
};

export function OnlinePaymentsView() {
  const t = useTranslations('Finance');
  const tCommon = useTranslations('Common');

  const methodLabel: Record<string, string> = {
    card: t('paymentCardLabel'),
    transfer: t('methodTransfer'),
    cash: t('methodCash'),
    check: t('methodCheck'),
  };

  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/finance/payments?pageSize=200')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success) {
          setPayments(json.data);
        }
      })
      .catch(() => {});
  }, []);

  // "Online" payments = non-cash, non-check methods (card/transfer) - the
  // real distinction this schema supports. No multi-gateway/webhook/
  // settlement concept exists here, so it isn't faked.
  const onlinePayments = payments.filter(p => p.paymentMethod === 'card' || p.paymentMethod === 'transfer');
  const filtered = onlinePayments.filter(p =>
    p.studentName.toLowerCase().includes(search.toLowerCase())
    || p.invoiceNumber.toLowerCase().includes(search.toLowerCase())
    || (p.referenceId ?? '').toLowerCase().includes(search.toLowerCase()),
  );
  const total = filtered.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('onlinePaymentsTitle')}</h1>
        <p className="text-xs text-slate-500 mt-1">{t('onlinePaymentsSubtitle', { count: filtered.length })}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-slate-400">{t('totalAmountCard')}</p>
          <p className="text-2xl font-extrabold text-[#16212B]">{formatMoney(total)}</p>
        </Card>
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <p className="text-xs font-bold text-slate-400">{t('transactionsCount')}</p>
          <p className="text-2xl font-extrabold text-[#16212B]">{filtered.length}</p>
        </Card>
      </div>

      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder={t('searchOnlinePaymentsPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="ps-9 h-9 text-xs rounded-xl bg-slate-50 border-none" />
        </div>
      </div>

      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-[#F6F9FC] text-[#16212B] font-extrabold border-b border-slate-200/80">
              <tr>
                <th className="py-3.5 px-4">{tCommon('date')}</th>
                <th className="py-3.5 px-4">{t('student')}</th>
                <th className="py-3.5 px-4">{t('invoicesBreadcrumb')}</th>
                <th className="py-3.5 px-4">{t('refundMethodLabel')}</th>
                <th className="py-3.5 px-4">{t('referenceCol')}</th>
                <th className="py-3.5 px-4 text-end">{t('amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">{t('noOnlinePaymentsFound')}</td></tr>
              )}
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition font-medium">
                  <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{p.paymentDate}</td>
                  <td className="py-3.5 px-4 font-bold text-[#16212B]">{p.studentName}</td>
                  <td className="py-3.5 px-4 font-mono text-[#2487B8] text-[11px]">{p.invoiceNumber}</td>
                  <td className="py-3.5 px-4">
                    <Badge className="text-[10px] border-none font-bold bg-[#DCEBF4] text-[#1B6C93] gap-1">
                      <CreditCard className="w-3 h-3" />
                      {methodLabel[p.paymentMethod] ?? p.paymentMethod}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500">{p.referenceId ?? '—'}</td>
                  <td className="py-3.5 px-4 text-end font-extrabold text-[#16212B]">{formatMoney(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
