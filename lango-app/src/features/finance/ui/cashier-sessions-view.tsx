'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Clock, Lock, RefreshCw, Wallet } from 'lucide-react';

type SessionRow = {
  id: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  closedAt: string | null;
  startingFloat: number;
  expectedCash: number;
  actualCash: number | null;
  totalCollected: number;
  status: 'open' | 'closed' | 'reconciled';
  notes: string | null;
  reconciledAt: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<SessionRow['status'], string> = {
  open: 'Ouverte',
  closed: 'Clôturée',
  reconciled: 'Rapprochée',
};

const STATUS_BADGE: Record<SessionRow['status'], string> = {
  open: 'bg-[#DCEBF4] text-[#2487B8]',
  closed: 'bg-amber-100 text-amber-700',
  reconciled: 'bg-[#DDF5EC] text-[#17A673]',
};

const fmt = (n: number | null) => (n === null || n === undefined ? '—' : `${Number(n).toLocaleString('fr-FR')} MAD`);
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString('fr-FR') : '—');

export function CashierSessionsView({ locale: _locale }: { locale?: string }) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | SessionRow['status']>('all');

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/cashier-sessions');
      const json = await res.json();
      if (json.success) setSessions(json.data);
    } catch (e) {
      console.error('Failed to load cashier sessions', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const filtered = useMemo(
    () => (filter === 'all' ? sessions : sessions.filter(s => s.status === filter)),
    [sessions, filter],
  );

  const openCount = sessions.filter(s => s.status === 'open').length;
  const totalVariance = sessions.reduce((sum, s) => {
    if (s.status === 'open' || s.actualCash === null) return sum;
    return sum + (Number(s.actualCash) - Number(s.expectedCash));
  }, 0);

  const handleClose = async (s: SessionRow) => {
    const raw = window.prompt(
      `Montant réel en caisse (MAD) pour la session de ${s.cashierName} ?`,
      String(s.expectedCash),
    );
    if (raw === null) return;
    const actualCash = Number(raw);
    if (Number.isNaN(actualCash) || actualCash < 0) {
      window.alert('Montant invalide.');
      return;
    }
    const res = await fetch(`/api/finance/cashier-sessions/${s.id}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actualCash }),
    });
    const json = await res.json();
    if (json.success) fetchSessions();
    else window.alert(json.error?.message ?? json.message ?? 'Erreur lors de la clôture.');
  };

  const handleReconcile = async (s: SessionRow) => {
    const res = await fetch(`/api/finance/cashier-sessions/${s.id}/reconcile`, { method: 'POST' });
    const json = await res.json();
    if (json.success) fetchSessions();
    else window.alert(json.error?.message ?? json.message ?? 'Erreur lors du rapprochement.');
  };

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Sessions de caisse</h1>
          <p className="text-xs text-slate-500 mt-1">{sessions.length} session(s), {openCount} ouverte(s).</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSessions} className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: <Wallet className="w-5 h-5 text-[#2487B8]" />, color: 'bg-[#DCEBF4]', label: 'Sessions', value: String(sessions.length) },
          { icon: <Clock className="w-5 h-5 text-amber-600" />, color: 'bg-amber-100', label: 'Ouvertes', value: String(openCount) },
          { icon: <CheckCircle2 className="w-5 h-5 text-[#17A673]" />, color: 'bg-[#DDF5EC]', label: 'Écart cumulé', value: `${totalVariance.toLocaleString('fr-FR')} MAD` },
          { icon: <Lock className="w-5 h-5 text-slate-500" />, color: 'bg-slate-100', label: 'Rapprochées', value: String(sessions.filter(s => s.status === 'reconciled').length) },
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

      <div className="flex items-center gap-2">
        {(['all', 'open', 'closed', 'reconciled'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${
              filter === f ? 'bg-[#16212B] text-white border-[#16212B]' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f === 'all' ? 'Toutes' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-slate-400 font-bold border-b border-slate-100 bg-slate-50/50">
                <th className="py-2.5 px-3 text-left">Caissier</th>
                <th className="py-2.5 px-3 text-center">Ouverture</th>
                <th className="py-2.5 px-3 text-right">Fond</th>
                <th className="py-2.5 px-3 text-right">Encaissé</th>
                <th className="py-2.5 px-3 text-right">Attendu</th>
                <th className="py-2.5 px-3 text-right">Réel</th>
                <th className="py-2.5 px-3 text-right">Écart</th>
                <th className="py-2.5 px-3 text-center">Statut</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-slate-400">Aucune session trouvée.</td></tr>
              )}
              {filtered.map(s => {
                const variance = s.status === 'open' || s.actualCash === null ? 0 : Number(s.actualCash) - Number(s.expectedCash);
                return (
                  <tr key={s.id} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-3 font-bold text-[#16212B]">{s.cashierName}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-[10px] text-slate-500">{fmtDate(s.openedAt)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-500">{fmt(s.startingFloat)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-500">{fmt(s.totalCollected)}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-[#16212B]">{fmt(s.expectedCash)}</td>
                    <td className="py-2.5 px-3 text-right font-semibold text-[#16212B]">{fmt(s.actualCash)}</td>
                    <td className={`py-2.5 px-3 text-right font-extrabold ${variance === 0 ? 'text-slate-400' : variance > 0 ? 'text-[#17A673]' : 'text-rose-600'}`}>
                      {s.status === 'open' ? '—' : `${variance >= 0 ? '+' : ''}${variance.toFixed(2)}`}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge className={`text-[9px] border-none font-bold ${STATUS_BADGE[s.status]}`}>{STATUS_LABEL[s.status]}</Badge>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {s.status === 'open' && (
                        <Button size="sm" onClick={() => handleClose(s)} className="h-7 text-[10px] rounded-lg bg-[#0066FF] hover:bg-[#0052CC]">
                          Clôturer
                        </Button>
                      )}
                      {s.status === 'closed' && (
                        <Button size="sm" variant="outline" onClick={() => handleReconcile(s)} className="h-7 text-[10px] rounded-lg border-slate-200">
                          Réconcilier
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
