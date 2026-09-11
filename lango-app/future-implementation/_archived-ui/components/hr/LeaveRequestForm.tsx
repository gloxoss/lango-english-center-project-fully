'use client';

import React, { useEffect, useState } from 'react';

type Category = { id: string; name: string; daysPerYear: number | null; isPaid: boolean };
type Balance = { categoryName: string; accruedDays: number; usedDays: number; remainingDays: number };

export function LeaveRequestForm() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [form, setForm] = useState({ categoryId: '', startDate: '', endDate: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/hr/leave/categories').then(r => r.json()),
      fetch('/api/hr/leave/balances').then(r => r.json()),
    ]).then(([catData, balData]) => {
      if (catData.success) setCategories(catData.data);
      if (balData.success) setBalances(balData.data);
    }).catch(() => {});
  }, []);

  async function submitRequest() {
    if (!form.categoryId || !form.startDate || !form.endDate) {
      setMessage({ type: 'err', text: 'Veuillez remplir tous les champs obligatoires.' });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/hr/leave/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, reason: form.reason || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'ok', text: 'Demande soumise avec succès. En attente de validation.' });
        setForm({ categoryId: '', startDate: '', endDate: '', reason: '' });
      } else {
        setMessage({ type: 'err', text: data.error?.message ?? 'Erreur.' });
      }
    } catch {
      setMessage({ type: 'err', text: 'Erreur réseau.' });
    } finally {
      setBusy(false);
      setTimeout(() => setMessage(null), 5000);
    }
  }

  const selectedBalance = balances.find(b => {
    const cat = categories.find(c => c.id === form.categoryId);
    return cat && b.categoryName === cat.name;
  });

  return (
    <div className="space-y-5">
      {/* Balances */}
      {balances.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {balances.map(b => (
            <div key={b.categoryName} className="rounded-xl border border-slate-700/40 bg-slate-800/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{b.categoryName}</p>
              <p className="mt-1 text-2xl font-bold text-white">{b.remainingDays}</p>
              <p className="text-xs text-slate-500">
                {b.usedDays}
                /
                {b.accruedDays}
                {' '}
                jours utilisés
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      <div className="space-y-4 rounded-xl border border-slate-700/40 bg-slate-800/30 p-5">
        <h3 className="font-semibold text-white">Nouvelle demande de congé</h3>

        {message && (
          <p className={`rounded-lg px-4 py-2 text-sm ${message.type === 'ok' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>
            {message.text}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Catégorie *</label>
            <select
              value={form.categoryId}
              onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
              className="w-full rounded-lg bg-slate-700/60 px-3 py-2 text-sm text-white"
            >
              <option value="">-- Choisir --</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {selectedBalance && (
            <div className="flex items-end">
              <p className="text-xs text-slate-400">
                Solde disponible:
                {' '}
                <span className="font-bold text-emerald-400">
                  {selectedBalance.remainingDays}
                  {' '}
                  jour(s)
                </span>
              </p>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-slate-400">Date de début *</label>
            <input
              type="date"
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              className="w-full rounded-lg bg-slate-700/60 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Date de fin *</label>
            <input
              type="date"
              value={form.endDate}
              onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              className="w-full rounded-lg bg-slate-700/60 px-3 py-2 text-sm text-white"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">Motif (facultatif)</label>
          <textarea
            value={form.reason}
            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            rows={2}
            className="w-full rounded-lg bg-slate-700/60 px-3 py-2 text-sm text-white"
            placeholder="Précisez si nécessaire…"
          />
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submitRequest()}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? 'Envoi…' : 'Soumettre la demande'}
        </button>
      </div>
    </div>
  );
}
