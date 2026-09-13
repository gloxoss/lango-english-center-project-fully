'use client';

import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Lock,
  PlusCircle,
  RefreshCw,
  Search,
  Unlock,
  User,
  Wallet,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

interface CashierSession {
  id: string;
  openedAt: string;
  startingFloat: number;
  expectedCash: number;
  totalCollected: number;
  status: string;
}

interface StudentResult {
  id: string;
  name: string;
  email: string | null;
  matricule: string | null;
}

interface StudentInvoice {
  id: string;
  invoiceNumber: string;
  netAmount: string;
  paidAmount: string;
  status: string;
  dueDate: string;
}

interface CollectRow {
  invoiceId: string;
  invoiceNumber: string;
  balance: number;
  amount: string;
  included: boolean;
}

interface PersistedReceipt {
  id: string;
  receiptNumber: string;
  studentName: string;
  studentEmail: string | null;
  amount: number;
  paymentDate: string;
  allocations: { invoiceId: string; invoiceNumber: string; amount: string }[];
  method: string;
}

type MethodOption = { methodCode: string; labelFr: string };
type ClassSectionOption = { id: string; className: string; sectionName: string };
type AgingRow = { studentId: string; studentName: string | null; studentEmail: string | null; balance: string | number; dueDate: string; daysOverdue: number };

export default function CollectionDeskPage() {
  const t = useTranslations('Finance');
  const tCommon = useTranslations('Common');

  const legacyMethods: MethodOption[] = [
    { methodCode: 'cash', labelFr: t('methodCash') },
    { methodCode: 'card', labelFr: t('methodCard') },
    { methodCode: 'transfer', labelFr: t('methodTransfer') },
    { methodCode: 'check', labelFr: t('methodCheck') },
  ];

  const searchParams = useSearchParams();
  const studentIdParam = searchParams.get('studentId');

  const [sessionData, setSessionData] = useState<{ activeSession: CashierSession | null; recentSessions: any[] }>({
    activeSession: null,
    recentSessions: [],
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Open drawer modal state
  const [openModal, setOpenModal] = useState(false);
  const [startingFloat, setStartingFloat] = useState('500');

  // Close drawer modal state
  const [closeModal, setCloseModal] = useState(false);
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');

  // Collection desk: search -> student -> invoices -> multi-invoice collect
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<StudentResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);
  const [studentInvoices, setStudentInvoices] = useState<StudentInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  const [collectRows, setCollectRows] = useState<CollectRow[]>([]);
  const [collectMethod, setCollectMethod] = useState<string>('cash');
  const [collecting, setCollecting] = useState(false);
  const [receipt, setReceipt] = useState<PersistedReceipt | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<MethodOption[]>(legacyMethods);
  const [deskMode, setDeskMode] = useState<'search' | 'class' | 'due'>('search');
  const [classSections, setClassSections] = useState<ClassSectionOption[]>([]);
  const [selectedClassSection, setSelectedClassSection] = useState('');
  const [roster, setRoster] = useState<StudentResult[]>([]);
  const [agingRows, setAgingRows] = useState<AgingRow[]>([]);

  const fetchSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/accountant/me/cashier');
      const json = await res.json();
      if (json.success) {
        setSessionData(json.data);
      } else {
        setError(json.error?.message || t('fetchSessionError'));
      }
    } catch (err: any) {
      setError(err.message || tCommon('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
    fetch('/api/academics/class-sections?pageSize=200').then(r => r.json()).then(j => j.success && setClassSections(j.data)).catch(() => {});
    fetch('/api/accountant/me/receivables').then(r => r.json()).then(j => j.success && setAgingRows(j.data.invoices || [])).catch(() => {});
  }, []);

  const loadRoster = async (classSectionId: string) => {
    setSelectedClassSection(classSectionId);
    if (!classSectionId) { setRoster([]); return; }
    const json = await fetch(`/api/students?classSectionId=${encodeURIComponent(classSectionId)}&pageSize=200`).then(r => r.json());
    if (json.success) setRoster(json.data.map((s: any) => ({ id: s.id, name: s.fullName || s.name, email: s.email || null, matricule: s.matricule || null })));
  };

  // Load tenant's configured payment methods
  useEffect(() => {
    fetch('/api/finance/payment-methods')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.success && Array.isArray(json.data)) {
          const active = json.data
            .filter((m: { isActive?: boolean }) => m.isActive)
            .map((m: { methodCode: string; labelFr: string }) => ({ methodCode: m.methodCode, labelFr: m.labelFr }));
          if (active.length > 0) setPaymentMethods(active);
        }
      })
      .catch(() => {});
  }, []);

  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/accountant/me/cashier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startingFloat: Number(startingFloat) }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg(t('sessionOpenSuccess'));
        setOpenModal(false);
        fetchSession();
      } else {
        setError(json.error?.message || t('cannotOpenSession'));
      }
    } catch (err: any) {
      setError(err.message || tCommon('error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/accountant/me/cashier', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualCash: Number(actualCash),
          notes,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg(t('sessionCloseSuccess'));
        setCloseModal(false);
        fetchSession();
      } else {
        setError(json.error?.message || t('cannotCloseSession'));
      }
    } catch (err: any) {
      setError(err.message || tCommon('error'));
    } finally {
      setActionLoading(false);
    }
  };

  const activeSession = sessionData.activeSession;
  const variance = activeSession && actualCash ? Number(actualCash) - activeSession.expectedCash : 0;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length < 2) {
      return;
    }
    setSearching(true);
    setError(null);
    setSelectedStudent(null);
    setStudentInvoices([]);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const json = await res.json();
      if (json.success) {
        setSearchResults(json.data.students ?? []);
      } else {
        setError(json.error?.message || tCommon('error'));
      }
    } catch (err: any) {
      setError(err.message || tCommon('error'));
    } finally {
      setSearching(false);
    }
  };

  const handleSelectStudent = async (student: StudentResult) => {
    setSelectedStudent(student);
    setSearchResults([]);
    setLoadingInvoices(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/invoices?studentId=${student.id}`);
      const json = await res.json();
      if (json.success) {
        const outstanding = (json.data as StudentInvoice[]).filter(
          inv => inv.status !== 'draft' && inv.status !== 'cancelled' && Number(inv.netAmount) - Number(inv.paidAmount) > 0,
        );
        setStudentInvoices(outstanding);
      } else {
        setError(json.error?.message || json.message || t('invoicesFetchError'));
      }
    } catch (err: any) {
      setError(err.message || tCommon('error'));
    } finally {
      setLoadingInvoices(false);
    }
  };

  useEffect(() => {
    if (!studentIdParam) return;
    (async () => {
      try {
        const res = await fetch(`/api/students?id=${encodeURIComponent(studentIdParam)}`);
        const json = await res.json();
        if (!json.success || !json.data) return;
        handleSelectStudent({
          id: json.data.id,
          name: json.data.fullName,
          email: json.data.email ?? null,
          matricule: json.data.matricule ?? null,
        });
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentIdParam]);

  const openCollect = () => {
    setCollectRows(studentInvoices.map(inv => {
      const balance = Number(inv.netAmount) - Number(inv.paidAmount);
      return { invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, balance, amount: balance.toFixed(2), included: true };
    }));
    setCollectMethod(paymentMethods[0]?.methodCode ?? 'cash');
    setCollectOpen(true);
  };

  const toggleRow = (invoiceId: string) => {
    setCollectRows(rows => rows.map(r => r.invoiceId === invoiceId ? { ...r, included: !r.included } : r));
  };

  const setRowAmount = (invoiceId: string, amount: string) => {
    setCollectRows(rows => rows.map(r => r.invoiceId === invoiceId ? { ...r, amount } : r));
  };

  const collectTotal = collectRows
    .filter(r => r.included)
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      return;
    }
    const selected = collectRows.filter(r => r.included && Number(r.amount) > 0);
    if (selected.length === 0) {
      setError(t('selectAtLeastOneInvoice'));
      return;
    }
    const totalBalance = collectRows.reduce((sum, r) => sum + r.balance, 0);
    if (collectTotal > totalBalance) {
      setError(t('totalExceedsRemaining'));
      return;
    }
    for (const r of selected) {
      if (Number(r.amount) > r.balance) {
        setError(t('amountExceedsRemaining', { number: r.invoiceNumber }));
        return;
      }
    }
    setCollecting(true);
    setError(null);
    try {
      const res = await fetch('/api/finance/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocations: selected.map(r => ({ invoiceId: r.invoiceId, amount: Number(r.amount) })),
          paymentMethod: collectMethod,
        }),
      });
      const json = await res.json();
      if (json.success) {
        const recRes = await fetch(`/api/finance/receipts/${json.data.receipt.id}`);
        const recJson = await recRes.json();
        setReceipt(recJson.success
          ? { ...recJson.data, method: collectMethod }
          : {
              id: json.data.receipt.id,
              receiptNumber: json.data.receipt.receiptNumber,
              studentName: selectedStudent.name,
              studentEmail: null,
              amount: Number(json.data.receipt.amount),
              paymentDate: json.data.receipt.paymentDate,
              allocations: selected.map(r => ({ invoiceId: r.invoiceId, invoiceNumber: r.invoiceNumber, amount: r.amount })),
              method: collectMethod,
            });
        setCollectOpen(false);
        handleSelectStudent(selectedStudent);
        fetchSession();
      } else {
        setError(json.error?.message || json.message || t('paymentFailed'));
      }
    } catch (err: any) {
      setError(err.message || tCommon('error'));
    } finally {
      setCollecting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('deskTitle')}
          </h1>
          <p className="text-sm text-slate-500">
            {t('deskSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSession}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            {tCommon('refresh')}
          </button>
          {activeSession ? (
            <button
              onClick={() => {
                setActualCash(String(activeSession.expectedCash));
                setCloseModal(true);
              }}
              className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700"
            >
              <Lock className="size-4" />
              {t('closeRegisterBtn')}
            </button>
          ) : (
            <button
              onClick={() => setOpenModal(true)}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
            >
              <Unlock className="size-4" />
              {t('openRegisterBtn')}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 className="size-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Cashier Status Banner */}
      <div className={`rounded-xl border p-6 shadow-xs ${activeSession ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex size-12 items-center justify-center rounded-xl ${activeSession ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'}`}>
              <Wallet className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {activeSession ? t('activeSessionBadge') : t('noSessionBadge')}
                </h2>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${activeSession ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                  {activeSession ? t('drawerOpenBadge') : t('drawerClosedBadge')}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {activeSession
                  ? t('sessionOpenedAt', { date: new Date(activeSession.openedAt).toLocaleDateString() })
                  : t('openDrawerNotice')}
              </p>
            </div>
          </div>

          {activeSession && (
            <div className="grid grid-cols-3 gap-6 border-t border-emerald-200/60 pt-4 md:border-t-0 md:pt-0">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase">{t('initialFloatLabel')}</span>
                <div className="text-base font-extrabold text-slate-900">{activeSession.startingFloat} {tCommon('currency')}</div>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase">{t('collectedTotalLabel')}</span>
                <div className="text-base font-extrabold text-emerald-700">+{activeSession.totalCollected} {tCommon('currency')}</div>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase">{t('expectedCashLabel')}</span>
                <div className="text-base font-extrabold text-blue-700">{activeSession.expectedCash} {tCommon('currency')}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fast Receipt Desk Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900">{t('quickCollectTitle')}</h3>
        <p className="text-xs text-slate-500">{t('quickCollectSubtitle')}</p>

        <div className="mt-4 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          {([['search', t('tabSearchStudent')], ['class', t('tabByClass')], ['due', t('tabOverdue')]] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDeskMode(value)}
              className={`rounded-lg px-3 py-2 text-xs font-bold ${deskMode === value ? 'bg-[#2487B8] text-white shadow-xs' : 'text-slate-600 hover:bg-white'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {!activeSession && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-700">
            <AlertCircle className="size-4 shrink-0" />
            {t('openSessionFirstWarning')}
          </div>
        )}

        {deskMode === 'search' && (
          <form onSubmit={handleSearch} className="mt-4 flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute start-3.5 top-3 size-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('searchStudentPlaceholder')}
                className="w-full rounded-lg border border-slate-200 py-2.5 ps-10 pe-4 text-sm text-slate-900 focus:border-[#0066FF] focus:outline-hidden"
              />
            </div>
            <button
              type="submit"
              disabled={searching || searchQuery.trim().length < 2}
              className="rounded-lg bg-[#0066FF] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#0052CC] disabled:opacity-50"
            >
              {searching ? t('searchingBtn') : t('searchBtn')}
            </button>
          </form>
        )}

        {deskMode === 'class' && (
          <div className="mt-4 space-y-3">
            <select
              value={selectedClassSection}
              onChange={e => loadRoster(e.target.value)}
              className="h-10 w-full max-w-md rounded-xl border border-slate-200 px-3 text-sm"
            >
              <option value="">{t('selectClassPlaceholder')}</option>
              {classSections.map(s => (
                <option key={s.id} value={s.id}>{s.className} · {s.sectionName}</option>
              ))}
            </select>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {roster.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleSelectStudent(s)}
                  className="rounded-xl border border-slate-200 p-3 text-start hover:border-[#2487B8] hover:bg-[#DCEBF4]/30"
                >
                  <p className="text-sm font-bold text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.matricule || s.email || '—'}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {deskMode === 'due' && (
          <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {agingRows.filter(r => r.daysOverdue > 0 || r.dueDate <= new Date().toISOString().slice(0, 10)).map((row, index) => (
              <button
                key={`${row.studentId}-${index}`}
                onClick={() => handleSelectStudent({ id: row.studentId, name: row.studentName || t('studentFallback'), email: row.studentEmail, matricule: null })}
                className="flex w-full items-center justify-between gap-4 p-3 text-start hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">{row.studentName || t('studentFallback')}</p>
                  <p className="text-xs text-slate-500">
                    {t('dueOn', { date: row.dueDate })} · {t('overdueDaysCount', { days: row.daysOverdue })}
                  </p>
                </div>
                <span className="font-bold text-[#E5544B]">{Number(row.balance).toFixed(2)} {tCommon('currency')}</span>
              </button>
            ))}
          </div>
        )}

        {deskMode === 'search' && searchResults.length > 0 && (
          <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {searchResults.map(s => (
              <button
                key={s.id}
                onClick={() => handleSelectStudent(s)}
                className="flex w-full items-center gap-3 p-3 text-start hover:bg-slate-50"
              >
                <User className="size-4 text-slate-400" />
                <div>
                  <div className="text-sm font-bold text-slate-900">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.matricule ?? s.email}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedStudent && (
          <div className="mt-4 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="size-4 text-[#0066FF]" />
                <span className="text-sm font-bold text-slate-900">{selectedStudent.name}</span>
                {selectedStudent.matricule && <span className="text-xs text-slate-400">({selectedStudent.matricule})</span>}
              </div>
              <button onClick={() => { setSelectedStudent(null); setStudentInvoices([]); }} className="text-xs text-slate-400 hover:text-slate-700">
                {t('changeStudent')}
              </button>
            </div>

            {loadingInvoices && <p className="mt-3 text-xs text-slate-500">{t('invoicesLoading')}</p>}

            {!loadingInvoices && studentInvoices.length === 0 && (
              <p className="mt-3 text-xs text-slate-500">{t('noInvoicesFound')}</p>
            )}

            {!loadingInvoices && studentInvoices.length > 0 && (
              <div className="mt-3">
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {studentInvoices.map((inv) => {
                    const balance = Number(inv.netAmount) - Number(inv.paidAmount);
                    return (
                      <div key={inv.id} className="flex items-center justify-between px-3 py-2.5">
                        <div>
                          <div className="text-xs font-bold text-slate-900">{inv.invoiceNumber}</div>
                          <div className="text-[11px] text-slate-500">
                            {t('dueOn', { date: inv.dueDate })} · {t('balanceRemaining', { balance: balance.toFixed(2) })} {tCommon('currency')}
                          </div>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${inv.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                          {inv.status === 'overdue' ? t('statusOverdue') : t('statusPending')}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={openCollect}
                  disabled={!activeSession}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  <PlusCircle className="size-4" />
                  {t('collectInvoicesBtn', { count: studentInvoices.length, plural: studentInvoices.length > 1 ? 's' : '' })}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Collect Payment Modal — multi-invoice */}
      {collectOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">{t('collectModalTitle', { name: selectedStudent.name })}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {t('collectModalSubtitle')}
            </p>

            <form onSubmit={handleCollectPayment} className="mt-4 space-y-4">
              <div className="space-y-1.5 max-h-64 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {collectRows.map(r => (
                  <div key={r.invoiceId} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
                    <input
                      type="checkbox"
                      checked={r.included}
                      onChange={() => toggleRow(r.invoiceId)}
                      className="size-3.5 accent-emerald-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900">{r.invoiceNumber}</div>
                      <div className="text-[10px] text-slate-500">
                        {t('balanceRemaining', { balance: r.balance.toFixed(2) })} {tCommon('currency')}
                      </div>
                    </div>
                    <input
                      type="number"
                      min="0.01"
                      max={r.balance}
                      step="0.01"
                      disabled={!r.included}
                      value={r.amount}
                      onChange={e => setRowAmount(r.invoiceId, e.target.value)}
                      className={`w-28 rounded-lg border border-slate-200 p-1.5 text-end text-xs font-semibold text-slate-900 focus:border-[#0066FF] focus:outline-hidden ${!r.included ? 'opacity-40' : ''}`}
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2.5">
                <span className="text-xs font-bold text-slate-700">{t('totalToCollectLabel')}</span>
                <span className="text-sm font-extrabold text-emerald-700">{collectTotal.toFixed(2)} {tCommon('currency')}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">{t('paymentMethodLabel')}</label>
                <select
                  value={collectMethod}
                  onChange={e => setCollectMethod(e.target.value as typeof collectMethod)}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm font-semibold text-slate-900 focus:border-[#0066FF] focus:outline-hidden"
                >
                  {paymentMethods.map(m => (
                    <option key={m.methodCode} value={m.methodCode}>{m.labelFr}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setCollectOpen(false)} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                  {tCommon('cancel')}
                </button>
                <button type="submit" disabled={collecting} className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {collecting ? t('collectingBtn') : t('confirmCollectionBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal — persisted RC- receipt */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
            <h3 className="mt-3 text-lg font-bold text-slate-900">{t('receiptModalSuccessTitle')}</h3>
            <p className="mt-0.5 text-xs font-mono font-bold text-slate-500">{t('receiptNumberLabel', { number: receipt.receiptNumber })}</p>
            <div className="mt-4 space-y-1 rounded-lg bg-slate-50 p-4 text-start text-xs">
              <div className="flex justify-between"><span className="text-slate-500">{t('studentFallback')}</span><span className="font-bold text-slate-900">{receipt.studentName}</span></div>
              <div className="mt-1.5 border-t border-slate-200 pt-1.5">
                {receipt.allocations.map(a => (
                  <div key={a.invoiceId} className="flex justify-between py-0.5">
                    <span className="text-slate-500">{a.invoiceNumber}</span>
                    <span className="font-bold text-slate-900">{Number(a.amount).toFixed(2)} {tCommon('currency')}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5"><span className="text-slate-500">{t('totalAmountLabel')}</span><span className="font-bold text-emerald-700">{receipt.amount.toFixed(2)} {tCommon('currency')}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{t('paymentMethodLabel')}</span><span className="font-bold text-slate-900">{paymentMethods.find(m => m.methodCode === receipt.method)?.labelFr ?? receipt.method}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">{tCommon('date')}</span><span className="font-bold text-slate-900">{receipt.paymentDate}</span></div>
            </div>
            <button onClick={() => window.print()} className="mt-4 w-full rounded-lg border border-slate-200 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              {t('printReceiptBtn')}
            </button>
            <button onClick={() => setReceipt(null)} className="mt-2 w-full rounded-lg bg-[#0066FF] py-2 text-xs font-bold text-white hover:bg-[#0052CC]">
              {tCommon('close')}
            </button>
          </div>
        </div>
      )}

      {/* Open Session Modal */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">{t('openSessionTitle')}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {t('openSessionSubtitle')}
            </p>

            <form onSubmit={handleOpenSession} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">{t('startingFloatLabel')}</label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  required
                  value={startingFloat}
                  onChange={e => setStartingFloat(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm font-semibold text-slate-900 focus:border-[#0066FF] focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpenModal(false)}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  {tCommon('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  {actionLoading ? t('openingSessionBtn') : t('confirmOpenBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Session Modal */}
      {closeModal && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">{t('closeSessionTitle')}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {t('closeSessionSubtitle')}
            </p>

            <div className="my-4 rounded-lg bg-slate-50 p-3 text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>{t('initialFloatLabel')}:</span>
                <span className="font-bold">{activeSession.startingFloat} {tCommon('currency')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{t('collectedTotalLabel')}:</span>
                <span className="font-bold text-emerald-600">+{activeSession.totalCollected} {tCommon('currency')}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1">
                <span>{t('theoreticalExpected')}</span>
                <span className="text-blue-700">{activeSession.expectedCash} {tCommon('currency')}</span>
              </div>
            </div>

            <form onSubmit={handleCloseSession} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">{t('countedCashLabel')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={actualCash}
                  onChange={e => setActualCash(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm font-semibold text-slate-900 focus:border-[#0066FF] focus:outline-hidden"
                />
              </div>

              {actualCash !== '' && (
                <div className={`rounded-lg p-3 text-xs font-bold ${variance === 0 ? 'bg-emerald-50 text-emerald-700' : variance > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                  {t('balanceDiscrepancyLabel', { amount: variance > 0 ? `+${variance}` : String(variance) })}
                  {variance === 0 && t('perfectBalance')}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700">{t('sessionNotesLabel')}</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={t('sessionNotesPlaceholder')}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 focus:border-[#0066FF] focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCloseModal(false)}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  {tCommon('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700"
                >
                  {actionLoading ? t('closingSessionBtn') : t('closeAndReconcileBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
