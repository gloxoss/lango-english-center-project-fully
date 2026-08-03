'use client';

import React, { useEffect, useState } from 'react';
import { MONTH_NAMES_FR } from '@/libs/i18n/months';

type Period = {
  id: string;
  year: number;
  month: number;
  status: 'draft' | 'locked';
  lockedAt?: string | null;
};


function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: 'bg-amber-900/50 text-amber-300 border-amber-500/30',
    locked: 'bg-emerald-900/50 text-emerald-300 border-emerald-500/30',
  };
  const labels: Record<string, string> = { draft: 'Brouillon', locked: 'Verrouillée' };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${colors[status] ?? ''}`}>
      {labels[status] ?? status}
    </span>
  );
}

export function PayrollRunPanel() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [newYear, setNewYear] = useState(new Date().getFullYear());
  const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1);

  async function fetchPeriods() {
    const res = await fetch('/api/hr/payroll/periods');
    const data = await res.json();
    if (data.success) {
      setPeriods(data.data);
    }
    setLoading(false);
  }

  useEffect(() => { void fetchPeriods(); }, []);

  function showMsg(type: 'ok' | 'err', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }

  async function createPeriod() {
    setBusy('creating');
    const res = await fetch('/api/hr/payroll/periods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: newYear, month: newMonth }),
    });
    const data = await res.json();
    if (data.success) {
      showMsg('ok', `Période ${MONTH_NAMES_FR[newMonth - 1]} ${newYear} créée.`);
      await fetchPeriods();
    } else {
      showMsg('err', data.error?.message ?? 'Erreur création période.');
    }
    setBusy(null);
  }

  async function calculatePeriod(id: string) {
    setBusy(id + '-calc');
    const res = await fetch(`/api/hr/payroll/periods/${id}/calculate`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showMsg('ok', `Calcul terminé: ${data.data.linesCalculated} ligne(s).`);
    } else {
      showMsg('err', data.error?.message ?? 'Erreur de calcul.');
    }
    setBusy(null);
  }

  async function lockPeriod(id: string) {
    if (!window.confirm('Verrouiller cette période? Cette action est irréversible.')) return;
    setBusy(id + '-lock');
    const res = await fetch(`/api/hr/payroll/periods/${id}/lock`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showMsg('ok', `Période verrouillée. ${data.data.payslipsGenerated} bulletin(s) émis. GL: ${data.data.glPosted ? '✓ Posté' : '⚠ Non posté (pas de plan comptable)'}.`);
      await fetchPeriods();
    } else {
      showMsg('err', data.error?.message ?? 'Erreur verrouillage.');
    }
    setBusy(null);
  }

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-900/20 to-slate-900 p-6 shadow-lg backdrop-blur-md">
      <h2 className="mb-5 text-lg font-bold text-white">Gestion de la Paie</h2>

      {/* Create period form */}
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-700/40 bg-slate-800/30 p-4">
        <div>
          <label className="mb-1 block text-xs text-slate-400">Année</label>
          <input
            type="number"
            value={newYear}
            onChange={e => setNewYear(Number(e.target.value))}
            className="w-24 rounded-lg bg-slate-700/60 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Mois</label>
          <select
            value={newMonth}
            onChange={e => setNewMonth(Number(e.target.value))}
            className="rounded-lg bg-slate-700/60 px-3 py-2 text-sm text-white"
          >
            {MONTH_NAMES_FR.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={busy === 'creating'}
          onClick={() => void createPeriod()}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {busy === 'creating' ? 'Création…' : 'Créer période'}
        </button>
      </div>

      {message && (
        <div className={`mb-4 rounded-lg px-4 py-2 text-sm ${message.type === 'ok' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>
          {message.text}
        </div>
      )}

      {loading
        ? <p className="text-sm text-slate-400">Chargement…</p>
        : (
            <div className="space-y-3">
              {periods.length === 0 && (
                <p className="text-sm text-slate-400">Aucune période créée.</p>
              )}
              {periods.map(p => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/30 bg-slate-800/40 px-4 py-3">
                  <div>
                    <p className="font-semibold text-white">
                      {MONTH_NAMES_FR[(p.month ?? 1) - 1]}
                      {' '}
                      {p.year}
                    </p>
                    <StatusBadge status={p.status} />
                  </div>
                  {p.status === 'draft' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy === `${p.id}-calc`}
                        onClick={() => void calculatePeriod(p.id)}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                      >
                        {busy === `${p.id}-calc` ? 'Calcul…' : 'Calculer'}
                      </button>
                      <button
                        type="button"
                        disabled={busy === `${p.id}-lock`}
                        onClick={() => void lockPeriod(p.id)}
                        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {busy === `${p.id}-lock` ? 'Verrouillage…' : 'Verrouiller & Émettre'}
                      </button>
                    </div>
                  )}
                  {p.status === 'locked' && (
                    <a
                      href={`/api/hr/payroll/periods/${p.id}/lines`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-500"
                    >
                      Voir les lignes
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
    </div>
  );
}
