'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, RefreshCw, UserRound } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type ActiveLoan = { loanId: string; dueDate: string; issuedAt: string; renewedCount: number; accessionNumber: string; title: string };
type OpenCharge = { id: string; amount: string; reason: string; state: string; createdAt: string };
type WaitingHold = { id: string; placedAt: string; expiresAt: string | null; accessionNumber: string; title: string };
type MemberDetail = { id: string; memberNumber: string; state: string; blockReason: string | null; blockUntil: string | null; branchId: string; branchName: string; userId: string; name: string; email: string | null; role: string; activeLoans: ActiveLoan[]; openCharges: OpenCharge[]; waitingHolds: WaitingHold[] };

const STATE_LABELS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Actif', cls: 'bg-[#DDF5EC] text-[#17A673]' },
  blocked: { label: 'Bloqué', cls: 'bg-rose-50 text-rose-600' },
  suspended: { label: 'Suspendu', cls: 'bg-amber-50 text-amber-700' },
  closed: { label: 'Clôturé', cls: 'bg-slate-100 text-slate-500' },
};
const CHARGE_REASONS: Record<string, string> = { overdue_fine: 'Amende de retard', lost_copy: 'Exemplaire perdu', damage: 'Dommage' };

export function LibraryMemberDetailClient({ memberId }: { memberId: string }) {
  const [member, setMember] = useState<MemberDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`/api/addons/library/members/${memberId}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok || !j.success) throw new Error(j.error?.message ?? 'Adhérent introuvable.');
      setMember(j.data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Adhérent introuvable.'); }
  }, [memberId]);

  useEffect(() => { void load(); }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const s = member ? (STATE_LABELS[member.state] ?? { label: member.state, cls: 'bg-slate-100 text-slate-500' }) : null;
  const overdueCount = member?.activeLoans.filter(l => l.dueDate < today).length ?? 0;

  return <div className="mx-auto max-w-5xl space-y-6 p-6">
    <div className="flex items-center justify-between"><Link href="/dashboard/portals/librarian/members" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Retour aux adhérents</Link><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Actualiser</Button></div>
    {error ? <Card className="p-10 text-center"><UserRound className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="font-medium">{error}</p></Card> : !member ? <Card className="p-10 text-center text-sm text-slate-500">Chargement…</Card> : <>
      <Card className="p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-extrabold text-[#16212B]">{member.name}</h1><div className="mt-2 flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-slate-500">{member.memberNumber}</span><Badge className={s!.cls}>{s!.label}</Badge><Badge variant="neutral" className="capitalize">{member.role}</Badge><Badge variant="neutral">{member.branchName}</Badge></div>{member.email && <p className="mt-2 text-sm text-slate-500">{member.email}</p>}</div><div className="text-right text-sm"><p className="text-slate-500">Prêts en cours</p><p className="text-2xl font-bold">{member.activeLoans.length}</p>{overdueCount > 0 && <p className="text-sm font-semibold text-red-600">{overdueCount} en retard</p>}</div></div>{member.blockReason && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">Bloqué : {member.blockReason}{member.blockUntil ? ` jusqu’au ${member.blockUntil}` : ''}</p>}</Card>

      <Card className="p-5"><div className="mb-3 flex items-center gap-2"><BookOpen className="h-4 w-4 text-[#2487B8]" /><h2 className="font-semibold">Prêts en cours ({member.activeLoans.length})</h2></div>{member.activeLoans.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aucun prêt actif.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Ouvrage</th><th className="p-3">Émis le</th><th className="p-3">Échéance</th><th className="p-3 text-right">Renouvellements</th></tr></thead><tbody>{member.activeLoans.map(loan => <tr key={loan.loanId} className="border-b last:border-0"><td className="p-3"><div className="font-semibold">{loan.title}</div><div className="font-mono text-xs text-slate-500">{loan.accessionNumber}</div></td><td className="p-3">{new Date(loan.issuedAt).toLocaleDateString('fr-FR')}</td><td className="p-3"><span className={loan.dueDate < today ? 'font-semibold text-red-600' : ''}>{loan.dueDate}</span></td><td className="p-3 text-right">{loan.renewedCount}</td></tr>)}</tbody></table></div>}</Card>

      <Card className="p-5"><h2 className="mb-3 font-semibold">Frais ouverts ({member.openCharges.length})</h2>{member.openCharges.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aucun frais ouvert.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Motif</th><th className="p-3 text-right">Montant</th><th className="p-3">Date</th></tr></thead><tbody>{member.openCharges.map(charge => <tr key={charge.id} className="border-b last:border-0"><td className="p-3">{CHARGE_REASONS[charge.reason] ?? charge.reason}</td><td className="p-3 text-right font-bold">{Number(charge.amount).toFixed(2)} DH</td><td className="p-3">{new Date(charge.createdAt).toLocaleDateString('fr-FR')}</td></tr>)}</tbody></table></div>}</Card>

      <Card className="p-5"><h2 className="mb-3 font-semibold">Réservations en attente ({member.waitingHolds.length})</h2>{member.waitingHolds.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aucune réservation en attente.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Ouvrage</th><th className="p-3">Placée le</th><th className="p-3">Expire le</th></tr></thead><tbody>{member.waitingHolds.map(hold => <tr key={hold.id} className="border-b last:border-0"><td className="p-3"><div className="font-semibold">{hold.title}</div><div className="font-mono text-xs text-slate-500">{hold.accessionNumber}</div></td><td className="p-3">{new Date(hold.placedAt).toLocaleDateString('fr-FR')}</td><td className="p-3">{hold.expiresAt ? new Date(hold.expiresAt).toLocaleDateString('fr-FR') : '—'}</td></tr>)}</tbody></table></div>}</Card>
    </>}
  </div>;
}
