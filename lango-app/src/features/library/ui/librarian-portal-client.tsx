'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookCheck, BookOpen, Clock3, Library, RefreshCw, RotateCcw, ShieldAlert, Undo2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

type Overview = { totalCopies: number; availableCopies: number; activeLoans: number; overdueLoans: number; waitingHolds: number; activeMembers: number };
type Member = { id: string; memberNumber: string; name: string; role: string; state: string };
type ActiveLoan = { loanId: string; dueDate: string; renewedCount: number; accessionNumber: string; title: string; memberNumber: string; memberName: string };

export function LibrarianPortalClient({ desk = false, viewingRole }: { desk?: boolean; viewingRole?: string }) {
  const isAdminViewing = viewingRole === 'school_admin' || viewingRole === 'super_admin';
  const [overview, setOverview] = useState<Overview | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loans, setLoans] = useState<ActiveLoan[]>([]);
  const [query, setQuery] = useState('');
  const [copyId, setCopyId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [condition, setCondition] = useState<'good' | 'damaged' | 'lost'>('good');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch('/api/addons/library/reports/overview', { cache: 'no-store' });
    const json = await response.json(); if (json.success) setOverview(json.data);
  }, []);
  const loadLoans = useCallback(async () => {
    const response = await fetch('/api/addons/library/circulation/loans', { cache: 'no-store' });
    const json = await response.json(); if (json.success) setLoans(json.data);
  }, []);
  useEffect(() => { void load(); if (desk) void loadLoans(); }, [load, loadLoans, desk]);

  async function searchMembers() { const response = await fetch(`/api/addons/library/members?q=${encodeURIComponent(query)}`); const json = await response.json(); if (json.success) setMembers(json.data); }

  async function post(path: string, body: object, okMessage: string) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await response.json();
      setMessage(json.success ? okMessage : json.error?.message ?? 'Échec de l’opération.');
      if (json.success) { void load(); if (desk) void loadLoans(); }
    } finally { setBusy(false); }
  }

  function issue() { void post('/api/addons/library/circulation/issue', { copyId, memberId }, 'Prêt créé.'); setCopyId(''); }
  function renew(loan: ActiveLoan) { void post('/api/addons/library/circulation/renew', { loanId: loan.loanId }, `Prêt renouvelé, nouvelle échéance.`); }
  function returnLoan(loan: ActiveLoan) { void post('/api/addons/library/circulation/return', { loanId: loan.loanId, condition }, `Retour enregistré (${condition}).`); }

  const cards = overview ? [
    ['Exemplaires', overview.totalCopies, Library], ['Disponibles', overview.availableCopies, BookOpen], ['Prêts actifs', overview.activeLoans, BookCheck], ['Retards', overview.overdueLoans, Clock3], ['Adhérents', overview.activeMembers, Users],
  ] as const : [];

  return <div className="mx-auto max-w-7xl space-y-6 p-6">{isAdminViewing && <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800"><ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" /><p className="text-sm font-medium">Vous consultez ce portail en tant qu'administrateur (vue de supervision). Pour opérer le comptoir de prêt, basculez sur le rôle Bibliothécaire via le sélecteur en bas de la barre latérale.</p></div>}<div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold">Portail Bibliothécaire</h1><p className="text-sm text-slate-500">Circulation et suivi opérationnel en temps réel.</p></div><Button variant="outline" onClick={() => { void load(); if (desk) void loadLoans(); }}><RefreshCw className="mr-2 h-4 w-4" />Actualiser</Button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{cards.map(([label,value,Icon]) => <Card key={label} className="p-4"><Icon className="mb-3 h-5 w-5 text-[#2487B8]"/><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold">{value}</p></Card>)}</div>
  {desk && <><Card className="space-y-5 p-5"><div><h2 className="font-semibold">Prêt au comptoir</h2><p className="text-sm text-slate-500">Recherchez l’adhérent puis saisissez ou scannez l’identifiant de l’exemplaire.</p></div><div className="flex gap-2"><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nom ou numéro d’adhérent"/><Button onClick={searchMembers}>Rechercher</Button></div>{members.length > 0 && <div className="grid gap-2">{members.map(member => <button type="button" key={member.id} onClick={() => setMemberId(member.id)} className={`rounded-lg border p-3 text-left ${memberId === member.id ? 'border-[#2487B8] bg-blue-50' : ''}`}><span className="font-medium">{member.name}</span><span className="ml-2 text-xs text-slate-500">{member.memberNumber} · {member.role}</span></button>)}</div>}<div className="flex gap-2"><Input value={copyId} onChange={e => setCopyId(e.target.value)} placeholder="UUID de l’exemplaire"/><Button disabled={busy || !copyId || !memberId} onClick={issue}>Enregistrer le prêt</Button></div>{message && <p role="status" className="text-sm">{message}</p>}</Card>
  <Card className="p-5"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold">Prêts en cours</h2><p className="text-sm text-slate-500">Renouvellement et retour au comptoir.</p></div><div className="flex items-center gap-2"><span className="text-xs text-slate-500">Retour :</span><Select value={condition} onValueChange={v => setCondition(v as 'good' | 'damaged' | 'lost')}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="good">Bon état</SelectItem><SelectItem value="damaged">Endommagé</SelectItem><SelectItem value="lost">Perdu</SelectItem></SelectContent></Select></div></div>
  {loans.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aucun prêt actif.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Ouvrage</th><th className="p-3">Adhérent</th><th className="p-3">Échéance</th><th className="p-3 text-right">Renouvel.</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{loans.map(loan => <tr key={loan.loanId} className="border-b last:border-0"><td className="p-3"><div className="font-semibold">{loan.title}</div><div className="font-mono text-xs text-slate-500">{loan.accessionNumber}</div></td><td className="p-3">{loan.memberName}<div className="text-xs text-slate-500">{loan.memberNumber}</div></td><td className="p-3"><span className={loan.dueDate < new Date().toISOString().slice(0, 10) ? 'font-semibold text-red-600' : ''}>{loan.dueDate}</span></td><td className="p-3 text-right">{loan.renewedCount}</td><td className="p-3 text-right"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={() => renew(loan)}><RotateCcw className="mr-1 h-3.5 w-3.5" />Renouveler</Button><Button variant="outline" size="sm" disabled={busy} onClick={() => returnLoan(loan)}><Undo2 className="mr-1 h-3.5 w-3.5" />Retour</Button></div></td></tr>)}</tbody></table></div>}</Card></>}</div>;
}
