'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookCheck, BookOpen, Clock3, Receipt, RefreshCw, RotateCcw, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Home = { memberNumber: string; activeLoans: number; overdueLoans: number; waitingHolds: number; openCharges: number };
type Loan = { id: string; dueDate: string; returnedAt: string | null; renewedCount: number; accessionNumber: string; title: string; returnState?: string | null };
type Hold = { id: string; state: string; placedAt: string; expiresAt: string | null; accessionNumber: string; title: string };
type Charge = { id: string; amount: string; reason: string; state: string; createdAt: string; waiverReason: string | null; waivedAt: string | null };
type Child = { studentId: string; name: string; memberId: string | null; memberNumber: string | null; canAccessLibrary: boolean };

const HOLD_LABELS: Record<string, { label: string; cls: string }> = {
  waiting: { label: 'En attente', cls: 'bg-amber-50 text-amber-700' },
  fulfilled: { label: 'Honorée', cls: 'bg-[#DDF5EC] text-[#17A673]' },
  cancelled: { label: 'Annulée', cls: 'bg-slate-100 text-slate-500' },
  expired: { label: 'Expirée', cls: 'bg-rose-50 text-rose-600' },
};
const CHARGE_LABELS: Record<string, { label: string; cls: string }> = {
  open: { label: 'En attente', cls: 'bg-amber-50 text-amber-700' },
  waived: { label: 'Annulé', cls: 'bg-slate-100 text-slate-500' },
  posted: { label: 'Comptabilisé', cls: 'bg-[#DDF5EC] text-[#17A673]' },
};
const CHARGE_REASONS: Record<string, string> = { overdue_fine: 'Amende de retard', lost_copy: 'Exemplaire perdu' };

const TABS = [
  ['home', 'Vue d’ensemble', BookCheck],
  ['loans', 'Mes prêts', BookOpen],
  ['holds', 'Réservations', Users],
  ['charges', 'Frais', Receipt],
  ['history', 'Historique', Clock3],
  ['children', 'Mes enfants', Users],
] as const;

export function LibrarySelfServiceClient() {
  const [home, setHome] = useState<Home | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [history, setHistory] = useState<Loan[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [childLoans, setChildLoans] = useState<Loan[]>([]);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [tab, setTab] = useState<'home' | 'loans' | 'holds' | 'charges' | 'history' | 'children'>('home');
  const [message, setMessage] = useState<string | null>(null);
  const [notMember, setNotMember] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setMessage(null);
    const get = async (path: string) => { try { const r = await fetch(path, { cache: 'no-store' }); const j = await r.json(); return j.success ? j.data : null; } catch { return null; } };
    const [h, l, ho, c, hi, ch] = await Promise.all([
      get('/api/addons/library/me/home'), get('/api/addons/library/me/loans'), get('/api/addons/library/me/holds'),
      get('/api/addons/library/me/charges'), get('/api/addons/library/me/history'), get('/api/addons/library/me/children'),
    ]);
    if (!h) { setNotMember(true); return; }
    setNotMember(false); setHome(h); setLoans(l ?? []); setHolds(ho ?? []); setCharges(c ?? []); setHistory(hi ?? []); setChildren(ch ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function post(path: string, body: object, ok: string) {
    setBusy(true); setMessage(null);
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      setMessage(j.success ? ok : j.error?.message ?? 'Échec de l’opération.');
      if (j.success) await load();
    } finally { setBusy(false); }
  }
  function renew(loan: Loan) { void post('/api/addons/library/me/renew', { loanId: loan.id }, 'Prêt renouvelé.'); }
  function cancelHold(hold: Hold) { const reason = window.prompt('Motif de l’annulation'); if (reason) void post('/api/addons/library/me/holds', { holdId: hold.id, reason }, 'Réservation annulée.'); }

  async function selectChild(studentId: string) {
    setSelectedChild(studentId); setMessage(null);
    const r = await fetch(`/api/addons/library/me/children/${studentId}/loans`, { cache: 'no-store' });
    const j = await r.json(); if (j.success) setChildLoans(j.data ?? []);
  }

  if (notMember) return <div className="mx-auto max-w-7xl space-y-6 p-6"><Card className="p-10 text-center"><BookOpen className="mx-auto mb-4 h-10 w-10 text-slate-300" /><h1 className="text-xl font-bold">Espace Bibliothèque</h1><p className="mt-2 text-sm text-slate-500">Aucun compte bibliothèque n’est associé à votre profil. Contactez le bureau de la bibliothèque pour l’activation.</p></Card></div>;

  const today = new Date().toISOString().slice(0, 10);
  const homeKpis = home ? ([['Prêts actifs', home.activeLoans, BookOpen], ['Retards', home.overdueLoans, Clock3], ['Réservations en attente', home.waitingHolds, Users], ['Frais en attente', home.openCharges, Receipt]] as const) : [];

  return <div className="mx-auto max-w-7xl space-y-6 p-6">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Mon espace bibliothèque</h1><p className="text-sm text-slate-500">{home ? `Adhérent ${home.memberNumber} — données personnelles uniquement.` : 'Chargement…'}</p></div><Button variant="outline" onClick={() => void load()} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />Actualiser</Button></div>
    <div className="flex flex-wrap gap-2">{TABS.map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setTab(key)} className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${tab === key ? 'border-[#2487B8] bg-blue-50 text-[#1B6C93]' : 'bg-white text-slate-600'}`}><Icon className="h-4 w-4" />{label}</button>)}</div>
    {message && <p role="status" className="text-sm">{message}</p>}

    {tab === 'home' && home && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{homeKpis.map(([label, value, Icon]) => <Card key={label} className="p-4"><Icon className="mb-3 h-5 w-5 text-[#2487B8]" /><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold">{value}</p></Card>)}</div>}

    {tab === 'loans' && <Card className="p-5"><h2 className="mb-3 font-semibold">Prêts en cours</h2>{loans.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aucun prêt en cours.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Ouvrage</th><th className="p-3">Échéance</th><th className="p-3">Renouvellements</th><th className="p-3 text-right">Action</th></tr></thead><tbody>{loans.map(loan => <tr key={loan.id} className="border-b last:border-0"><td className="p-3"><div className="font-semibold">{loan.title}</div><div className="font-mono text-xs text-slate-500">{loan.accessionNumber}</div></td><td className="p-3"><span className={loan.dueDate < today ? 'font-semibold text-red-600' : ''}>{loan.dueDate}</span></td><td className="p-3">{loan.renewedCount}</td><td className="p-3 text-right"><Button variant="outline" size="sm" disabled={busy} onClick={() => renew(loan)}><RotateCcw className="mr-1 h-3.5 w-3.5" />Renouveler</Button></td></tr>)}</tbody></table></div>}</Card>}

    {tab === 'holds' && <Card className="p-5"><h2 className="mb-3 font-semibold">Mes réservations</h2>{holds.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aucune réservation.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Ouvrage</th><th className="p-3">Statut</th><th className="p-3">Placée le</th><th className="p-3 text-right">Action</th></tr></thead><tbody>{holds.map(hold => { const s = HOLD_LABELS[hold.state] ?? { label: hold.state, cls: 'bg-slate-100 text-slate-500' }; return <tr key={hold.id} className="border-b last:border-0"><td className="p-3"><div className="font-semibold">{hold.title}</div><div className="font-mono text-xs text-slate-500">{hold.accessionNumber}</div></td><td className="p-3"><Badge className={s.cls}>{s.label}</Badge></td><td className="p-3">{new Date(hold.placedAt).toLocaleDateString('fr-FR')}</td><td className="p-3 text-right">{hold.state === 'waiting' ? <Button variant="outline" size="sm" disabled={busy} onClick={() => cancelHold(hold)}>Annuler</Button> : '—'}</td></tr>; })}</tbody></table></div>}</Card>}

    {tab === 'charges' && <Card className="p-5"><h2 className="mb-3 font-semibold">Frais</h2>{charges.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aucun frais.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Motif</th><th className="p-3">Montant</th><th className="p-3">Statut</th><th className="p-3">Date</th></tr></thead><tbody>{charges.map(charge => { const s = CHARGE_LABELS[charge.state] ?? { label: charge.state, cls: 'bg-slate-100 text-slate-500' }; return <tr key={charge.id} className="border-b last:border-0"><td className="p-3">{CHARGE_REASONS[charge.reason] ?? charge.reason}</td><td className="p-3 font-bold">{Number(charge.amount).toFixed(2)} DH</td><td className="p-3"><Badge className={s.cls}>{s.label}</Badge></td><td className="p-3">{new Date(charge.createdAt).toLocaleDateString('fr-FR')}</td></tr>; })}</tbody></table></div>}</Card>}

    {tab === 'history' && <Card className="p-5"><h2 className="mb-3 font-semibold">Historique des emprunts</h2>{history.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aucun retour enregistré.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Ouvrage</th><th className="p-3">Échéance</th><th className="p-3">Retourné le</th><th className="p-3">État</th></tr></thead><tbody>{history.map(loan => <tr key={loan.id} className="border-b last:border-0"><td className="p-3"><div className="font-semibold">{loan.title}</div><div className="font-mono text-xs text-slate-500">{loan.accessionNumber}</div></td><td className="p-3">{loan.dueDate}</td><td className="p-3">{loan.returnedAt ? new Date(loan.returnedAt).toLocaleDateString('fr-FR') : '—'}</td><td className="p-3">{loan.returnState ?? '—'}</td></tr>)}</tbody></table></div>}</Card>}

    {tab === 'children' && <Card className="space-y-4 p-5"><h2 className="font-semibold">Emprunts de mes enfants</h2>{children.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aucun enfant avec accès bibliothèque.</p> : <><div className="flex flex-wrap gap-2">{children.map(child => <button key={child.studentId} type="button" onClick={() => void selectChild(child.studentId)} className={`rounded-lg border px-4 py-2 text-sm font-medium ${selectedChild === child.studentId ? 'border-[#2487B8] bg-blue-50 text-[#1B6C93]' : 'bg-white text-slate-600'}`}>{child.name}</button>)}</div>{selectedChild && (childLoans.length === 0 ? <p className="text-sm text-slate-500">Aucun prêt pour cet enfant.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Ouvrage</th><th className="p-3">Échéance</th><th className="p-3">Retourné</th><th className="p-3">Renouvel.</th></tr></thead><tbody>{childLoans.map(loan => <tr key={loan.id} className="border-b last:border-0"><td className="p-3 font-medium">{loan.title}</td><td className="p-3">{loan.dueDate}</td><td className="p-3">{loan.returnedAt ? 'Oui' : 'Non'}</td><td className="p-3">{loan.renewedCount}</td></tr>)}</tbody></table></div>)}</>}</Card>}
  </div>;
}
