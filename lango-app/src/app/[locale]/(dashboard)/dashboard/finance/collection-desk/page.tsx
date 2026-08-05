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

interface CashierSession {
  id: string;
  openedAt: string;
  startingFloat: number;
  expectedCash: number;
  totalCollected: number;
  status: string;
}

export default function CollectionDeskPage() {
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
        <p className="text-xs text-slate-500">Recherchez un élève par nom, matricule ou code pour enregistrer un versement immédiat.</p>

        <div className="mt-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par nom d'élève, CIN tuteur, ou matricule..."
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-[#0066FF] focus:outline-hidden"
            />
          </div>
          <button className="rounded-lg bg-[#0066FF] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#0052CC]">
            Rechercher
          </button>
        </div>
      </div>

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
