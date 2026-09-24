'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Search, Plus, Download, Printer, X,
  CheckCircle2, Clock, TrendingUp, AlertCircle,
  Send, Ban, RotateCcw, Layers,
} from 'lucide-react';
import { exportToCsv } from '@/libs/csv-export';

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
  draft: 'bg-slate-100 text-slate-400', pending: 'bg-slate-100 text-slate-600', partial: 'bg-amber-100 text-amber-700',
  paid: 'bg-[#DDF5EC] text-[#17A673]', overdue: 'bg-rose-100 text-rose-600', cancelled: 'bg-slate-200 text-slate-500 line-through',
  credited: 'bg-violet-100 text-violet-600',
};

const ALL_STATUS_KEYS: InvoiceRow['status'][] = [
  'draft', 'pending', 'partial', 'paid', 'overdue', 'cancelled', 'credited',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        if (json.success) setStudentResults(json.data.students ?? []);
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
    const reason = window.prompt('Motif de l\'annulation du paiement ?');
    if (reason === null) return;
    if (!reason.trim()) {
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
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{tFinance('invoicesManagement')}</h1>
          <p className="text-xs text-slate-500 mt-1">{tFinance('invoicesSubtitle', { count: invoices.length })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <Link href={`/${locale}/dashboard/finance/allocations`}>
            <Button variant="outline" size="sm" className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5 hover:border-[#0066FF] hover:text-[#0066FF]">
              <Layers className="w-3.5 h-3.5" />
              {tFinance('batchBilling')}
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)} className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            {tFinance('createInvoice')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportToCsv(filtered, 'factures')} className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5">
            <Download className="w-3.5 h-3.5" />
            {tCommon('export')}
          </Button>
        </div>
      </div>

      {/* Stat Band - computed from the real fetched list */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: <TrendingUp className="w-5 h-5 text-[#1B6C93]" />, color: 'bg-[#DCEBF4]', label: tFinance('issuedInvoices'), value: String(invoices.length) },
          { icon: <Download className="w-5 h-5 text-[#17A673]" />, color: 'bg-[#DDF5EC]', label: tFinance('invoicedAmount'), value: `${totalInvoiced.toLocaleString('fr-FR')} ${tCommon('currency')}` },
          { icon: <Clock className="w-5 h-5 text-amber-600" />, color: 'bg-amber-100', label: tFinance('overdueInvoices'), value: `${overdue.length} (${overdueAmount.toLocaleString('fr-FR')} ${tCommon('currency')})` },
          { icon: <CheckCircle2 className="w-5 h-5 text-violet-600" />, color: 'bg-violet-100', label: tFinance('recoveryRate'), value: `${recoveryRate} %` },
        ].map((stat, i) => (
          <Card key={i} className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${stat.color}`}>{stat.icon}</div>
            <div>
              <p className="text-[10px] font-bold text-slate-400">{stat.label}</p>
              <p className="text-xl font-extrabold text-[#16212B] leading-tight">{stat.value}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5 items-start">
        {/* LEFT — Invoice List */}
        <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 flex items-center gap-2 flex-wrap border-b border-slate-100">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input placeholder={tFinance('searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-[11px] bg-slate-50 rounded-xl border-slate-200" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-8 px-2 text-[11px] border border-slate-200 rounded-xl bg-slate-50 font-semibold">
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
                    <div><p className="text-slate-400">{tFinance('amount')}</p><p className="font-bold text-[#16212B]">{Number(inv.netAmount).toLocaleString('fr-FR')} {tCommon('currency')}</p></div>
                    <div><p className="text-slate-400">{tFinance('balance')}</p><p className={`font-bold ${balance > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{balance.toLocaleString('fr-FR')} {tCommon('currency')}</p></div>
                    <div><p className="text-slate-400">{tFinance('dueDate')}</p><p className="font-mono text-slate-500">{inv.dueDate}</p></div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-slate-400 font-bold border-b border-slate-100 bg-slate-50/50">
                  <th className="py-2.5 px-3 text-left">{tFinance('invoiceNumber')}</th>
                  <th className="py-2.5 px-3 text-left">{tStudents('student')}</th>
                  <th className="py-2.5 px-3 text-left">{tFinance('class')}</th>
                  <th className="py-2.5 px-3 text-right">{tFinance('amount')}</th>
                  <th className="py-2.5 px-3 text-right">{tFinance('balance')}</th>
                  <th className="py-2.5 px-3 text-center">{tFinance('dueDate')}</th>
                  <th className="py-2.5 px-3 text-center">{tCommon('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400">{tFinance('noInvoicesFound')}</td></tr>
                )}
                {filtered.map((inv) => {
                  const balance = Number(inv.netAmount) - Number(inv.paidAmount);
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => setSelectedId(inv.id)}
                      className={`cursor-pointer transition-colors ${selectedId === inv.id ? 'bg-[#DCEBF4]/30' : 'hover:bg-slate-50/80'}`}
                    >
                      <td className="py-2.5 px-3 font-mono font-semibold text-[#2487B8]">{inv.invoiceNumber}</td>
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-[#16212B]">{inv.studentName}</p>
                        <p className="text-[9px] text-slate-400">{inv.guardianName ?? ''}</p>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{inv.className ?? '—'}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-[#16212B]">{Number(inv.netAmount).toLocaleString('fr-FR')} {tCommon('currency')}</td>
                      <td className={`py-2.5 px-3 text-right font-bold ${balance > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{balance.toLocaleString('fr-FR')} {tCommon('currency')}</td>
                      <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[10px]">{inv.dueDate}</td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge className={`text-[9px] border-none font-bold ${STATUS_BADGE[inv.status]}`}>{tStatus(inv.status)}</Badge>
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
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4 sticky top-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className={`text-[10px] border-none font-bold ${STATUS_BADGE[detail.status]}`}>{tStatus(detail.status)}</Badge>
                <span className="text-[11px] font-mono text-slate-500">{detail.invoiceNumber}</span>
              </div>
              <button onClick={() => setSelectedId(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <p className="text-sm font-extrabold text-[#16212B]">{detail.studentName}</p>
              <p className="text-[11px] text-slate-500">{detail.guardianName ?? tFinance('guardianNotSpecified')} · {detail.className ?? '—'}</p>
            </div>

            {detail.items.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-extrabold text-[#16212B]">{tFinance('invoiceDetails')}</p>
                <table className="w-full text-[11px]">
                  <tbody className="divide-y divide-slate-100">
                    {detail.items.map(line => (
                      <tr key={line.id}>
                        <td className="py-1.5 font-semibold text-[#16212B]">{line.description}</td>
                        <td className="py-1.5 text-right font-bold text-[#16212B]">{Number(line.amount).toLocaleString('fr-FR')} {tCommon('currency')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="space-y-1 text-[11px] border-t border-slate-100 pt-2">
              <div className="flex justify-between"><span className="text-slate-500">{tFinance('amount')}</span><span className="font-bold">{Number(detail.amount).toLocaleString('fr-FR')} {tCommon('currency')}</span></div>
              {Number(detail.discountAmount) > 0 && (
                <div className="flex justify-between text-rose-600"><span>{tFinance('discount')}</span><span className="font-bold">-{Number(detail.discountAmount).toLocaleString('fr-FR')} {tCommon('currency')}</span></div>
              )}
              <div className="flex justify-between text-sm font-extrabold text-[#16212B] border-t border-slate-200 pt-1">
                <span>{tFinance('netTotal')}</span><span>{Number(detail.netAmount).toLocaleString('fr-FR')} {tCommon('currency')}</span>
              </div>
              <div className="flex justify-between"><span className="text-slate-500">{tFinance('paidAmount')}</span><span className="font-bold text-[#17A673]">{Number(detail.paidAmount).toLocaleString('fr-FR')} {tCommon('currency')}</span></div>
              <div className="flex justify-between font-extrabold text-rose-600">
                <span>{tFinance('remainingBalance')}</span><span>{(Number(detail.netAmount) - Number(detail.paidAmount)).toLocaleString('fr-FR')} {tCommon('currency')}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-extrabold text-[#16212B]">{tFinance('paymentHistory')} ({detail.payments.length})</p>
              {detail.payments.length === 0 && <p className="text-[10px] text-slate-400">{tFinance('noPaymentRecorded')}</p>}
              {detail.payments.map(p => (
                <div key={p.id} className="flex items-center justify-between text-[10px] border-b border-slate-100 pb-1.5 gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#16212B] flex items-center gap-1.5">
                      {p.paymentDate} · {p.paymentMethod}
                      {p.status === 'reversed' && <Badge className="text-[8px] border-none font-bold bg-rose-100 text-rose-600">{tStatus('reversed')}</Badge>}
                      {p.status === 'refunded' && <Badge className="text-[8px] border-none font-bold bg-violet-100 text-violet-600">{tStatus('refunded')}</Badge>}
                    </p>
                    {p.referenceId && <p className="text-slate-400 font-mono">Réf. {p.referenceId}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`font-extrabold ${p.status === 'posted' ? 'text-[#17A673]' : 'text-slate-400 line-through'}`}>{Number(p.amount).toLocaleString('fr-FR')} {tCommon('currency')}</span>
                    {p.status === 'posted' && (
                      <button
                        type="button"
                        onClick={() => handleReversePayment(p)}
                        className="text-[9px] font-bold text-rose-600 hover:underline"
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

            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
              {detail.status === 'draft' && (
                <Button variant="default" size="sm" onClick={() => runLifecycleAction('issue')} className="h-8 text-[11px] rounded-xl bg-[#0066FF] gap-1">
                  <Send className="w-3 h-3" />{tFinance('issue')}
                </Button>
              )}
              {detail.status === 'pending' && (
                <Button variant="outline" size="sm" onClick={() => runLifecycleAction('cancel')} className="h-8 text-[11px] rounded-xl border-slate-200 text-rose-600 hover:text-rose-600 gap-1">
                  <Ban className="w-3 h-3" />{tCommon('cancel')}
                </Button>
              )}
              {(detail.status === 'pending' || detail.status === 'partial') && (
                <Button variant="outline" size="sm" onClick={() => runLifecycleAction('credit')} className="h-8 text-[11px] rounded-xl border-slate-200 text-violet-600 hover:text-violet-600 gap-1">
                  <RotateCcw className="w-3 h-3" />{tFinance('credit')}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8 text-[11px] rounded-xl border-slate-200 gap-1 ml-auto">
                <Printer className="w-3 h-3" />{tFinance('print')}
              </Button>
            </div>
          </Card>
        )}

        {!selectedId && (
          <Card className="p-8 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center text-center gap-2 sticky top-4">
            <AlertCircle className="w-6 h-6 text-slate-300" />
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
              {selectedStudent ? (
                <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <span className="text-xs font-semibold text-slate-800">{selectedStudent.name}</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedStudent(null); setCreateForm(f => ({ ...f, studentId: '' })); }}
                    className="text-[11px] font-semibold text-[#2487B8] hover:underline"
                  >
                    {tFinance('change')}
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Input value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder={tFinance('searchStudentPlaceholder')} className="h-9 rounded-xl" />
                  {studentResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-lg">
                      {studentResults.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => selectStudent(s)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                        >
                          <span className="text-xs font-semibold text-slate-800">{s.name}</span>
                          {s.matricule && <span className="text-[10px] text-slate-400">{s.matricule}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{tFinance('amount')} ({tCommon('currency')})</label>
              <Input type="number" value={createForm.amount} onChange={e => setCreateForm({ ...createForm, amount: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{tFinance('dueDate')}</label>
              <Input type="date" value={createForm.dueDate} onChange={e => setCreateForm({ ...createForm, dueDate: e.target.value })} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-slate-600">{tFinance('notes')}</label>
              <Input value={createForm.note} onChange={e => setCreateForm({ ...createForm, note: e.target.value })} className="h-9 rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" disabled={saving} onClick={handleCreate} className="h-9 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold">
              {saving ? tFinance('creating') : tFinance('createInvoice')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
