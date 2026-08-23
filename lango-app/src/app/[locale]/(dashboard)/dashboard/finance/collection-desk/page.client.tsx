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
  method: 'cash' | 'card' | 'transfer' | 'check';
}

export default function CollectionDeskPage() {
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
  const [collectMethod, setCollectMethod] = useState<'cash' | 'card' | 'transfer' | 'check'>('cash');
  const [collecting, setCollecting] = useState(false);
  const [receipt, setReceipt] = useState<PersistedReceipt | null>(null);

  const fetchSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/accountant/me/cashier');
      const json = await res.json();
      if (json.success) {
        setSessionData(json.data);
      } else {
        setError(json.error?.message || 'Erreur lors de la récupération de la session.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
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
        setSuccessMsg('Session de caisse ouverte avec succès.');
        setOpenModal(false);
        fetchSession();
      } else {
        setError(json.error?.message || 'Impossible d\'ouvrir la caisse.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau.');
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
        setSuccessMsg('Session de caisse clôturée et réconciliée avec succès.');
        setCloseModal(false);
        fetchSession();
      } else {
        setError(json.error?.message || 'Impossible de clôturer la caisse.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau.');
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
        setError(json.error?.message || 'Erreur lors de la recherche.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau.');
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
        // Draft invoices aren't collectable until issued; cancelled ones never
        // are. Only pending/partial/overdue balances belong on the desk.
        const outstanding = (json.data as StudentInvoice[]).filter(
          inv => inv.status !== 'draft' && inv.status !== 'cancelled' && Number(inv.netAmount) - Number(inv.paidAmount) > 0,
        );
        setStudentInvoices(outstanding);
      } else {
        setError(json.error?.message || json.message || 'Erreur lors de la récupération des factures.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau.');
    } finally {
      setLoadingInvoices(false);
    }
  };

  // Deep-link support: /finance/collection-desk?studentId=... skips the search
  // step and pre-selects that student (used by the invoice detail "Enregistrer
  // un paiement" button so the cashier doesn't re-search the same student).
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
        // ignore — fall back to the normal search step
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentIdParam]);

  const openCollect = () => {
    // Default: every outstanding invoice included at its full remaining
    // balance. The cashier unticks invoices or trims amounts as needed.
    setCollectRows(studentInvoices.map(inv => {
      const balance = Number(inv.netAmount) - Number(inv.paidAmount);
      return { invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, balance, amount: balance.toFixed(2), included: true };
    }));
    setCollectMethod('cash');
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
      setError('Sélectionnez au moins une facture avec un montant valide.');
      return;
    }
    // Strict overpay guard mirrors the server rule (PAYMENT_EXCEEDS_BALANCE):
    // the sum of allocated amounts may never exceed the outstanding balances.
    const totalBalance = collectRows.reduce((sum, r) => sum + r.balance, 0);
    if (collectTotal > totalBalance) {
      setError('Le montant total dépasse le solde restant des factures sélectionnées.');
      return;
    }
    for (const r of selected) {
      if (Number(r.amount) > r.balance) {
        setError(`Le montant alloué à la facture ${r.invoiceNumber} dépasse son solde restant.`);
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
        // Open the persisted receipt (RC-...) for display + window.print, not a
        // client-built lookalike.
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
        // Refresh this student's remaining invoices and the cashier session's
        // running total - the session's totalCollected is recomputed
        // server-side from real payments rows, not tracked client-side.
        handleSelectStudent(selectedStudent);
        fetchSession();
      } else {
        setError(json.error?.message || json.message || 'Impossible d\'enregistrer le paiement.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau.');
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
            Guichet de Caisse & Encaissements
          </h1>
          <p className="text-sm text-slate-500">
            Gestion du fond de caisse, encaissements physiques et arrêtés comptables quotidiens.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSession}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser Statut
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
              Clôturer la Caisse
            </button>
          ) : (
            <button
              onClick={() => setOpenModal(true)}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
            >
              <Unlock className="size-4" />
              Ouvrir la Caisse
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
                  {activeSession ? 'Session de Caisse Active' : 'Caisse Actuellement Fermée'}
                </h2>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${activeSession ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                  {activeSession ? 'OUVERTE' : 'FERMÉE'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {activeSession
                  ? `Ouverte le ${new Date(activeSession.openedAt).toLocaleString('fr-FR')}`
                  : 'Veuillez ouvrir votre session de caisse avec le fond de caisse initial pour encaisser.'}
              </p>
            </div>
          </div>

          {activeSession && (
            <div className="grid grid-cols-3 gap-6 border-t border-emerald-200/60 pt-4 md:border-t-0 md:pt-0">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Fond Initial</span>
                <div className="text-base font-extrabold text-slate-900">{activeSession.startingFloat} MAD</div>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Encaissements Espèces</span>
                <div className="text-base font-extrabold text-emerald-700">+{activeSession.totalCollected} MAD</div>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Attendu</span>
                <div className="text-base font-extrabold text-blue-700">{activeSession.expectedCash} MAD</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fast Receipt Desk Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900">Encaissement Rapide de Scolarité</h3>
        <p className="text-xs text-slate-500">Recherchez un élève par nom, matricule ou email pour enregistrer un versement immédiat.</p>

        {!activeSession && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-700">
            <AlertCircle className="size-4 shrink-0" />
            Ouvrez votre session de caisse ci-dessus avant d'encaisser un paiement.
          </div>
        )}

        <form onSubmit={handleSearch} className="mt-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom d'élève, matricule, ou email..."
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-[#0066FF] focus:outline-hidden"
            />
          </div>
          <button
            type="submit"
            disabled={searching || searchQuery.trim().length < 2}
            className="rounded-lg bg-[#0066FF] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#0052CC] disabled:opacity-50"
          >
            {searching ? 'Recherche...' : 'Rechercher'}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {searchResults.map(s => (
              <button
                key={s.id}
                onClick={() => handleSelectStudent(s)}
                className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50"
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
                Changer
              </button>
            </div>

            {loadingInvoices && <p className="mt-3 text-xs text-slate-500">Chargement des factures...</p>}

            {!loadingInvoices && studentInvoices.length === 0 && (
              <p className="mt-3 text-xs text-slate-500">Aucune facture impayée pour cet élève.</p>
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
                          <div className="text-[11px] text-slate-500">Échéance {inv.dueDate} · Solde dû {balance.toFixed(2)} MAD</div>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${inv.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                          {inv.status === 'overdue' ? 'En retard' : 'En attente'}
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
                  Encaisser ({studentInvoices.length} facture{studentInvoices.length > 1 ? 's' : ''})
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
            <h3 className="text-lg font-bold text-slate-900">Encaissement — {selectedStudent.name}</h3>
            <p className="mt-1 text-xs text-slate-500">
              Cochez les factures à régler et ajustez les montants si nécessaire.
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
                      <div className="text-[10px] text-slate-500">Solde dû {r.balance.toFixed(2)} MAD</div>
                    </div>
                    <input
                      type="number"
                      min="0.01"
                      max={r.balance}
                      step="0.01"
                      disabled={!r.included}
                      value={r.amount}
                      onChange={e => setRowAmount(r.invoiceId, e.target.value)}
                      className={`w-28 rounded-lg border border-slate-200 p-1.5 text-right text-xs font-semibold text-slate-900 focus:border-[#0066FF] focus:outline-hidden ${!r.included ? 'opacity-40' : ''}`}
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2.5">
                <span className="text-xs font-bold text-slate-700">Total encaissé</span>
                <span className="text-sm font-extrabold text-emerald-700">{collectTotal.toFixed(2)} MAD</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Mode de paiement</label>
                <select
                  value={collectMethod}
                  onChange={e => setCollectMethod(e.target.value as typeof collectMethod)}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm font-semibold text-slate-900 focus:border-[#0066FF] focus:outline-hidden"
                >
                  <option value="cash">Espèces</option>
                  <option value="check">Chèque</option>
                  <option value="card">Carte (TPE)</option>
                  <option value="transfer">Virement</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setCollectOpen(false)} className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                  Annuler
                </button>
                <button type="submit" disabled={collecting} className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                  {collecting ? 'Encaissement...' : 'Confirmer & Encaisser'}
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
            <h3 className="mt-3 text-lg font-bold text-slate-900">Paiement Encaissé</h3>
            <p className="mt-0.5 text-xs font-mono font-bold text-slate-500">Reçu N° {receipt.receiptNumber}</p>
            <div className="mt-4 space-y-1 rounded-lg bg-slate-50 p-4 text-left text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Élève</span><span className="font-bold text-slate-900">{receipt.studentName}</span></div>
              <div className="mt-1.5 border-t border-slate-200 pt-1.5">
                {receipt.allocations.map(a => (
                  <div key={a.invoiceId} className="flex justify-between py-0.5">
                    <span className="text-slate-500">{a.invoiceNumber}</span>
                    <span className="font-bold text-slate-900">{Number(a.amount).toFixed(2)} MAD</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5"><span className="text-slate-500">Montant total</span><span className="font-bold text-emerald-700">{receipt.amount.toFixed(2)} MAD</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Mode</span><span className="font-bold text-slate-900">{{ cash: 'Espèces', check: 'Chèque', card: 'Carte (TPE)', transfer: 'Virement' }[receipt.method]}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-bold text-slate-900">{receipt.paymentDate}</span></div>
            </div>
            <button onClick={() => window.print()} className="mt-4 w-full rounded-lg border border-slate-200 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              Imprimer le reçu
            </button>
            <button onClick={() => setReceipt(null)} className="mt-2 w-full rounded-lg bg-[#0066FF] py-2 text-xs font-bold text-white hover:bg-[#0052CC]">
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Open Session Modal */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Ouverture de Session Caisse</h3>
            <p className="mt-1 text-xs text-slate-500">
              Saisissez le montant du fond de caisse présent physiquement dans le tiroir au démarrage.
            </p>

            <form onSubmit={handleOpenSession} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">Fond de caisse initial (MAD)</label>
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
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  {actionLoading ? 'Ouverture...' : 'Confirmer Ouverture'}
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
            <h3 className="text-lg font-bold text-slate-900">Clôture & Arrêté de Caisse</h3>
            <p className="mt-1 text-xs text-slate-500">
              Comptage physique des espèces et réconciliation financière.
            </p>

            <div className="my-4 rounded-lg bg-slate-50 p-3 text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Fond Initial:</span>
                <span className="font-bold">{activeSession.startingFloat} MAD</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Encaissements de la session:</span>
                <span className="font-bold text-emerald-600">+{activeSession.totalCollected} MAD</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1">
                <span>Total Théorique Attendu:</span>
                <span className="text-blue-700">{activeSession.expectedCash} MAD</span>
              </div>
            </div>

            <form onSubmit={handleCloseSession} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">Comptage Physique Réel (MAD)</label>
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
                  Écart de caisse: {variance > 0 ? `+${variance}` : variance} MAD
                  {variance === 0 && ' (Caisse Parfaite)'}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700">Notes / Justification éventuelle</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Explication en cas d'écart de caisse ou observation..."
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 focus:border-[#0066FF] focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCloseModal(false)}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700"
                >
                  {actionLoading ? 'Clôture en cours...' : 'Valider la Clôture'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
