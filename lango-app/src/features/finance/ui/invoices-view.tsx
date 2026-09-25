'use client';

import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  Download,
  Layers,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Send,
  TrendingUp,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { exportToCsv } from '@/libs/csv-export';
import { printInvoiceDocument } from './finance-document-print';
import { formatMoney } from '@/libs/finance/format-money';

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  className: string | null;
  guardianName: string | null;
  amount: string;
  discountAmount: string;
  netAmount: string;
  paidAmount: string;
  status: 'draft' | 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled' | 'credited';
  dueDate: string;
  issueDate: string;
};

type InvoiceDetail = InvoiceRow & {
  note: string | null;
  items: { id: string; description: string; quantity: number; unitPrice: string; amount: string }[];
  payments: { id: string; amount: string; paymentMethod: string; paymentDate: string; referenceId: string | null; status: 'posted' | 'reversed' | 'refunded'; allocatedAmount: string | null }[];
};

const STATUS_BADGE: Record<InvoiceRow['status'], string> = {
  draft: 'bg-slate-100 text-slate-400',
  pending: 'bg-slate-100 text-slate-600',
  partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-[#DDF5EC] text-[#17A673]',
  overdue: 'bg-rose-100 text-rose-600',
  cancelled: 'bg-slate-200 text-slate-500 line-through',
  credited: 'bg-violet-100 text-violet-600',
};

const ALL_STATUS_KEYS: InvoiceRow['status'][] = [
  'draft',
  'pending',
  'partial',
  'paid',
  'overdue',
  'cancelled',
  'credited',
];

export function InvoicesFinanceView({ locale = 'fr' }: { locale?: string }) {
  const tFinance = useTranslations('Finance');
  const tCommon = useTranslations('Common');
  const tStatus = useTranslations('Status');
  const tStudents = useTranslations('Students');
  const searchParams = useSearchParams();
  const studentIdFilter = searchParams.get('studentId');
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ studentId: '', amount: '', dueDate: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<{ id: string; name: string; matricule: string | null }[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string; matricule: string | null } | null>(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch(studentIdFilter ? `/api/finance/invoices?studentId=${studentIdFilter}` : '/api/finance/invoices');
      const json = await res.json();
      if (json.success) {
        setInvoices(json.data);
      }
    } catch (e) {
      console.error('Failed to load invoices', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line react/exhaustive-deps
  }, [studentIdFilter]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    fetch(`/api/finance/invoices?id=${selectedId}`)
      .then(r => r.json())
      .then((json) => {
        if (json.success) {
          setDetail(json.data);
        }
      })
      .catch(() => {});
  }, [selectedId]);

  // Debounced student search for the create-invoice dialog (same /api/search
  // source as the collection desk, so the form no longer needs a raw UUID).
  useEffect(() => {
    const q = studentSearch.trim();
    if (q.length < 2) {
      setStudentResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (json.success) {
          setStudentResults(json.data.students ?? []);
        }
      } catch {
        // ignore transient search failures
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [studentSearch]);

  const selectStudent = (s: { id: string; name: string; matricule: string | null }) => {
    setSelectedStudent(s);
    setCreateForm(f => ({ ...f, studentId: s.id }));
    setStudentSearch('');
    setStudentResults([]);
  };

  const filtered = invoices.filter((inv) => {
    const matchSearch = inv.studentName.toLowerCase().includes(search.toLowerCase()) || inv.invoiceNumber.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalInvoiced = invoices.reduce((sum, i) => sum + Number(i.netAmount), 0);
  const overdue = invoices.filter(i => i.status === 'overdue');
  const overdueAmount = overdue.reduce((sum, i) => sum + (Number(i.netAmount) - Number(i.paidAmount)), 0);
  const totalPaid = invoices.reduce((sum, i) => sum + Number(i.paidAmount), 0);
  const recoveryRate = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 1000) / 10 : 0;

  const handleCreate = async () => {
    if (!createForm.studentId || !createForm.amount || !createForm.dueDate) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/finance/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: createForm.studentId,
          amount: Number(createForm.amount),
          dueDate: createForm.dueDate,
          note: createForm.note || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCreateOpen(false);
        setCreateForm({ studentId: '', amount: '', dueDate: '', note: '' });
        setSelectedStudent(null);
        await fetchInvoices();
      } else {
        console.error('API error creating invoice', json.message);
      }
    } catch (e) {
      console.error('Failed to create invoice', e);
    } finally {
      setSaving(false);
    }
  };

  const handleReversePayment = async (p: { id: string }) => {
    // eslint-disable-next-line no-alert
    const reason = window.prompt('Motif de l\'annulation du paiement ?');
    if (reason === null) {
      return;
    }
    if (!reason.trim()) {
      // eslint-disable-next-line no-alert
      window.alert('Un motif est requis pour annuler un paiement.');
      return;
    }
    try {
      const res = await fetch(`/api/finance/payments/${p.id}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        // eslint-disable-next-line no-alert
        window.alert(json.error?.message ?? json.message ?? 'Annulation impossible.');
        return;
      }
      await fetchInvoices();
      const d = await fetch(`/api/finance/invoices?id=${selectedId}`).then(r => r.json());
      if (d.success) {
        setDetail(d.data);
      }
    } catch (e) {
      console.error('Failed to reverse payment', e);
    }
  };

  const runLifecycleAction = async (action: 'issue' | 'cancel' | 'credit') => {
    if (!selectedId) {
      return;
    }
    const config = {
      issue: { method: 'PUT', path: `/api/finance/invoices/${selectedId}/issue` },
      cancel: { method: 'PUT', path: `/api/finance/invoices/${selectedId}/cancel` },
      credit: { method: 'POST', path: `/api/finance/invoices/${selectedId}/credit` },
    }[action];
    try {
      const res = await fetch(config.path, { method: config.method });
      const json = await res.json();
      if (!json.success) {
        // eslint-disable-next-line no-alert
        window.alert(json.error?.message ?? json.message ?? 'Action impossible.');
        return;
      }
      await fetchInvoices();
      const d = await fetch(`/api/finance/invoices?id=${selectedId}`).then(r => r.json());
      if (d.success) {
        setDetail(d.data);
      }
    } catch (e) {
      console.error('Failed to run invoice lifecycle action', e);
    }
  };

  return (
    <div className="mx-auto max-w-[1800px] space-y-6">
      {/* Header */}
      <div className="
        flex flex-col justify-between gap-4
        sm:flex-row sm:items-center
      "
      >
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{tFinance('invoicesManagement')}</h1>
          <p className="mt-1 text-xs text-slate-500">{tFinance('invoicesSubtitle', { count: invoices.length })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <Button asChild variant="outline" size="sm" className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5 hover:border-[#0066FF] hover:text-[#0066FF]">
            <Link href={`/${locale}/dashboard/finance/allocations`}>
              <Layers className="w-3.5 h-3.5" />
              {tFinance('batchBilling')}
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)} className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            {tFinance('createInvoice')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCsv(filtered, 'factures')}
            className="h-9 gap-1.5 rounded-xl border-slate-200 bg-white text-xs"
          >
            <Download className="size-3.5" />
            {tCommon('export')}
          </Button>
        </div>
      </div>

      {/* Stat Band - computed from the real fetched list */}
      <div className="
        grid grid-cols-2 gap-4
        lg:grid-cols-4
      "
      >
        {[
          { icon: <TrendingUp className="size-5 text-[#1B6C93]" />, color: 'bg-[#DCEBF4]', label: tFinance('issuedInvoices'), value: String(invoices.length) },
          { icon: <Download className="size-5 text-[#17A673]" />, color: 'bg-[#DDF5EC]', label: tFinance('invoicedAmount'), value: formatMoney(totalInvoiced) },
          { icon: <Clock className="size-5 text-amber-600" />, color: 'bg-amber-100', label: tFinance('overdueInvoices'), value: `${overdue.length} (${formatMoney(overdueAmount)})` },
          { icon: <CheckCircle2 className="size-5 text-violet-600" />, color: 'bg-violet-100', label: tFinance('recoveryRate'), value: `${recoveryRate} %` },
        ].map((stat, i) => (
          <Card
            key={i}
            className="
              flex items-center gap-3 rounded-2xl border border-slate-200/80
              bg-white p-4 shadow-2xs
            "
          >
            <div className={`
              flex size-10 shrink-0 items-center justify-center rounded-xl
              ${stat.color}
            `}
            >
              {stat.icon}
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">{stat.label}</p>
              <p className="text-xl/tight font-extrabold text-[#16212B]">{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="
        grid grid-cols-1 items-start gap-5
        xl:grid-cols-[1fr_380px]
      "
      >
        {/* LEFT — Invoice List */}
        <Card className="
          overflow-hidden rounded-2xl border border-slate-200/80 bg-white
          shadow-2xs
        "
        >
          <div className="
            flex flex-wrap items-center gap-2 border-b border-slate-100 p-4
          "
          >
            <div className="relative min-w-[180px] flex-1">
              <Search className="
                absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2
                text-slate-400
              "
              />
              <Input
                placeholder={tFinance('searchPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="
                  h-8 rounded-xl border-slate-200 bg-slate-50 pl-8 text-[11px]
                "
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="
                h-8 rounded-xl border border-slate-200 bg-slate-50 px-2
                text-[11px] font-semibold
              "
            >
              <option value="all">{tFinance('allStatuses')}</option>
              {ALL_STATUS_KEYS.map(k => <option key={k} value={k}>{tStatus(k)}</option>)}
            </select>
          </div>

          {/* Phone: one card per invoice. At 390 px the 7-column table pushed the
              status off-screen (audit S-36); the table stays for md and up. */}
          <div className="md:hidden divide-y divide-slate-100">
            {!loading && filtered.length === 0 && (
              <p className="py-8 text-center text-[11px] text-slate-400">{tFinance('noInvoicesFound')}</p>
            )}
            {filtered.map((inv) => {
              const balance = Number(inv.netAmount) - Number(inv.paidAmount);
              return (
                <button
                  type="button"
                  key={inv.id}
                  onClick={() => setSelectedId(inv.id)}
                  className={`w-full px-4 py-3 text-left transition-colors ${selectedId === inv.id ? 'bg-[#DCEBF4]/30' : 'hover:bg-slate-50/80'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-[#2487B8]">{inv.invoiceNumber}</span>
                    <Badge className={`text-[9px] border-none font-bold ${STATUS_BADGE[inv.status]}`}>{tStatus(inv.status)}</Badge>
                  </div>
                  <p className="mt-1 text-xs font-bold text-[#16212B]">{inv.studentName}</p>
                  <p className="text-[10px] text-slate-400">{[inv.className, inv.guardianName].filter(Boolean).join(' · ')}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                    <div>
                      <p className="text-slate-400">{tFinance('amount')}</p>
                      <p className="font-bold text-[#16212B]">
                        {formatMoney(inv.netAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">{tFinance('balance')}</p>
                      <p className={`
                        font-bold
                        ${balance > 0
                  ? `text-rose-600`
                  : `text-slate-400`}
                      `}
                      >
                        {formatMoney(balance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">{tFinance('dueDate')}</p>
                      <p className="font-mono text-slate-500">
                        {inv.dueDate}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="
                  border-b border-slate-100 bg-slate-50/50 font-bold
                  text-slate-400
                "
                >
                  <th className="px-3 py-2.5 text-left">{tFinance('invoiceNumber')}</th>
                  <th className="px-3 py-2.5 text-left">{tStudents('student')}</th>
                  <th className="px-3 py-2.5 text-left">{tFinance('class')}</th>
                  <th className="px-3 py-2.5 text-right">{tFinance('amount')}</th>
                  <th className="px-3 py-2.5 text-right">{tFinance('balance')}</th>
                  <th className="px-3 py-2.5 text-center">{tFinance('dueDate')}</th>
                  <th className="px-3 py-2.5 text-center">{tCommon('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-slate-400"
                    >
                      {tFinance('noInvoicesFound')}
                    </td>
                  </tr>
                )}
                {filtered.map((inv) => {
                  const balance = Number(inv.netAmount) - Number(inv.paidAmount);
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => setSelectedId(inv.id)}
                      className={`
                        cursor-pointer transition-colors
                        ${selectedId === inv.id
                      ? `bg-[#DCEBF4]/30`
                      : `hover:bg-slate-50/80`}
                      `}
                    >
                      <td className="
                        px-3 py-2.5 font-mono font-semibold text-[#2487B8]
                      "
                      >
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-bold text-[#16212B]">{inv.studentName}</p>
                        <p className="text-[9px] text-slate-400">{inv.guardianName ?? ''}</p>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">{inv.className ?? '—'}</td>
                      <td className="
                        px-3 py-2.5 text-right font-bold text-[#16212B]
                      "
                      >
                        {formatMoney(inv.netAmount)}
                      </td>
                      <td className={`
                        px-3 py-2.5 text-right font-bold
                        ${balance > 0
                      ? `text-rose-600`
                      : `text-slate-400`}
                      `}
                      >
                        {formatMoney(balance)}
                      </td>
                      <td className="
                        px-3 py-2.5 text-center font-mono text-[10px]
                        text-slate-500
                      "
                      >
                        {inv.dueDate}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge className={`
                          border-none text-[9px] font-bold
                          ${STATUS_BADGE[inv.status]}
                        `}
                        >
                          {tStatus(inv.status)}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* RIGHT — Invoice Detail Panel */}
        {selectedId && detail && (
          <Card className="
            sticky top-4 space-y-4 rounded-2xl border border-slate-200/80
            bg-white p-5 shadow-2xs
          "
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className={`
                  border-none text-[10px] font-bold
                  ${STATUS_BADGE[detail.status]}
                `}
                >
                  {tStatus(detail.status)}
                </Badge>
                <span className="font-mono text-[11px] text-slate-500">{detail.invoiceNumber}</span>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="
                  rounded-lg p-1 text-slate-400
                  hover:bg-slate-100
                "
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div>
              <p className="text-sm font-extrabold text-[#16212B]">{detail.studentName}</p>
              <p className="text-[11px] text-slate-500">
                {detail.guardianName ?? tFinance('guardianNotSpecified')}
                {' '}
                ·
                {' '}
                {detail.className ?? '—'}
              </p>
            </div>

            {detail.items.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-extrabold text-[#16212B]">{tFinance('invoiceDetails')}</p>
                <table className="w-full text-[11px]">
                  <tbody className="divide-y divide-slate-100">
                    {detail.items.map(line => (
                      <tr key={line.id}>
                        <td className="py-1.5 font-semibold text-[#16212B]">{line.description}</td>
                        <td className="
                          py-1.5 text-right font-bold text-[#16212B]
                        "
                        >
                          {formatMoney(line.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="
              space-y-1 border-t border-slate-100 pt-2 text-[11px]
            "
            >
              <div className="flex justify-between">
                <span className="text-slate-500">{tFinance('amount')}</span>
                <span className="font-bold">
                  {formatMoney(detail.amount)}
                </span>
              </div>
              {Number(detail.discountAmount) > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>{tFinance('discount')}</span>
                  <span className="font-bold">
                    -
                    {formatMoney(detail.discountAmount)}
                  </span>
                </div>
              )}
              <div className="
                flex justify-between border-t border-slate-200 pt-1 text-sm
                font-extrabold text-[#16212B]
              "
              >
                <span>{tFinance('netTotal')}</span>
                <span>{formatMoney(detail.netAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{tFinance('paidAmount')}</span>
                <span className="font-bold text-[#17A673]">
                  {formatMoney(detail.paidAmount)}
                </span>
              </div>
              <div className="flex justify-between font-extrabold text-rose-600">
                <span>{tFinance('remainingBalance')}</span>
                <span>{formatMoney(Number(detail.netAmount) - Number(detail.paidAmount))}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-extrabold text-[#16212B]">
                {tFinance('paymentHistory')}
                {' '}
                (
                {detail.payments.length}
                )
              </p>
              {detail.payments.length === 0 && (
                <p className="text-[10px] text-slate-400">
                  {tFinance('noPaymentRecorded')}
                </p>
              )}
              {detail.payments.map(p => (
                <div
                  key={p.id}
                  className="
                    flex items-center justify-between gap-2 border-b
                    border-slate-100 pb-1.5 text-[10px]
                  "
                >
                  <div className="min-w-0">
                    <p className="
                      flex items-center gap-1.5 font-semibold text-[#16212B]
                    "
                    >
                      {p.paymentDate}
                      {' '}
                      ·
                      {p.paymentMethod}
                      {p.status === 'reversed' && (
                        <Badge className="
                          border-none bg-rose-100 text-[8px] font-bold
                          text-rose-600
                        "
                        >
                          {tStatus('reversed')}
                        </Badge>
                      )}
                      {p.status === 'refunded' && (
                        <Badge className="
                          border-none bg-violet-100 text-[8px] font-bold
                          text-violet-600
                        "
                        >
                          {tStatus('refunded')}
                        </Badge>
                      )}
                    </p>
                    {p.referenceId && (
                      <p className="font-mono text-slate-400">
                        Réf.
                        {p.referenceId}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={`
                      font-extrabold
                      ${p.status === 'posted'
                  ? `text-[#17A673]`
                  : `text-slate-400 line-through`}
                    `}
                    >
                      {formatMoney(p.amount)}
                    </span>
                    {p.status === 'posted' && (
                      <button
                        type="button"
                        onClick={() => handleReversePayment(p)}
                        className="
                          text-[9px] font-bold text-rose-600
                          hover:underline
                        "
                      >
                        {tCommon('cancel')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {detail.note && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-extrabold text-[#16212B]">{tFinance('notes')}</p>
                <p className="text-[10px] text-slate-500">{detail.note}</p>
              </div>
            )}

            <div className="
              flex items-center gap-2 border-t border-slate-100 pt-1
            "
            >
              {detail.status === 'draft' && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => runLifecycleAction('issue')}
                  className="h-8 gap-1 rounded-xl bg-[#0066FF] text-[11px]"
                >
                  <Send className="size-3" />
                  {tFinance('issue')}
                </Button>
              )}
              {detail.status === 'pending' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runLifecycleAction('cancel')}
                  className="
                    h-8 gap-1 rounded-xl border-slate-200 text-[11px]
                    text-rose-600
                    hover:text-rose-600
                  "
                >
                  <Ban className="size-3" />
                  {tCommon('cancel')}
                </Button>
              )}
              {(detail.status === 'pending' || detail.status === 'partial') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runLifecycleAction('credit')}
                  className="
                    h-8 gap-1 rounded-xl border-slate-200 text-[11px]
                    text-violet-600
                    hover:text-violet-600
                  "
                >
                  <RotateCcw className="size-3" />
                  {tFinance('credit')}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => printInvoiceDocument(detail, {
                title: tFinance('invoiceDetailTitle'), student: tFinance('student'),
                date: tCommon('date'), description: tFinance('descriptionCol'),
                amount: tFinance('amount'), total: tFinance('netTotal'),
                paid: tFinance('paidAmountLabel'), balance: tFinance('remainingBalanceLabel'),
                discount: tFinance('discountLabel'), invoiceDate: tFinance('issueDateLabel'),
                dueDate: tFinance('dueDateLabel'),
              }, locale)} className="h-8 text-[11px] rounded-xl border-slate-200 gap-1 ml-auto">
                <Printer className="w-3 h-3" />{tFinance('print')}
              </Button>
            </div>
          </Card>
        )}

        {!selectedId && (
          <Card className="
            sticky top-4 flex flex-col items-center justify-center gap-2
            rounded-2xl border border-slate-200/80 bg-white p-8 text-center
            shadow-2xs
          "
          >
            <AlertCircle className="size-6 text-slate-300" />
            <p className="text-xs text-slate-400">{tFinance('selectInvoicePrompt')}</p>
          </Card>
        )}
      </div>

      {/* Create Invoice Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tFinance('createInvoice')}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{tStudents('student')}</label>
              {selectedStudent
                ? (
                    <div className="
                      flex items-center justify-between rounded-xl border
                      border-slate-200 px-3 py-2
                    "
                    >
                      <span className="text-xs font-semibold text-slate-800">{selectedStudent.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudent(null);
                          setCreateForm(f => ({ ...f, studentId: '' }));
                        }}
                        className="
                          text-[11px] font-semibold text-[#2487B8]
                          hover:underline
                        "
                      >
                        {tFinance('change')}
                      </button>
                    </div>
                  )
                : (
                    <div className="relative">
                      <Input
                        value={studentSearch}
                        onChange={e => setStudentSearch(e.target.value)}
                        placeholder={tFinance('searchStudentPlaceholder')}
                        className="h-9 rounded-xl"
                      />
                      {studentResults.length > 0 && (
                        <div className="
                          absolute z-10 mt-1 w-full divide-y divide-slate-100
                          rounded-xl border border-slate-200 bg-white shadow-lg
                        "
                        >
                          {studentResults.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => selectStudent(s)}
                              className="
                                flex w-full items-center justify-between px-3
                                py-2 text-left
                                hover:bg-slate-50
                              "
                            >
                              <span className="
                                text-xs font-semibold text-slate-800
                              "
                              >
                                {s.name}
                              </span>
                              {s.matricule && (
                                <span className="text-[10px] text-slate-400">
                                  {s.matricule}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">
                {tFinance('amount')}
                {' '}
                (
                {tCommon('currency')}
                )
              </label>
              <Input
                type="number"
                value={createForm.amount}
                onChange={e => setCreateForm({ ...createForm, amount: e.target.value })}
                className="h-9 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{tFinance('dueDate')}</label>
              <Input
                type="date"
                value={createForm.dueDate}
                onChange={e => setCreateForm({ ...createForm, dueDate: e.target.value })}
                className="h-9 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{tFinance('notes')}</label>
              <Input
                value={createForm.note}
                onChange={e => setCreateForm({ ...createForm, note: e.target.value })}
                className="h-9 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              size="sm"
              disabled={saving}
              onClick={handleCreate}
              className="
                h-9 rounded-xl bg-[#2487B8] text-xs font-bold text-white
                hover:bg-[#1B6C93]
              "
            >
              {saving ? tFinance('creating') : tFinance('createInvoice')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
