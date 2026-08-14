'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

type ScopeRow = { id: string; userId: string; userName: string; scopeType: 'tenant' | 'branch' | 'department'; branchId: string | null; branchName: string | null; departmentId: string | null; departmentName: string | null; startsOn: string; endsOn: string | null; status: string };
type AuthorityRow = { id: string; assignmentId: string; userId: string; userName: string; domain: string; action: string; maxAmount: string | null; startsOn: string; endsOn: string | null; delegatedFromAuthorityId: string | null; status: string };
type UserOption = { id: string; fullName: string };
type BranchOption = { id: string; name: string };
type DepartmentOption = { id: string; name: string };

const SCOPE_LABELS: Record<ScopeRow['scopeType'], string> = { tenant: 'Établissement', branch: 'Filiale', department: 'Département' };
const DOMAIN_LABELS: Record<string, string> = { academics: 'Académique', attendance: 'Présences', finance: 'Finances', workforce: 'Personnel', operations: 'Opérations', reporting: 'Reporting' };
const DOMAINS: [string, string][] = [['academics', 'Académique'], ['attendance', 'Présences'], ['finance', 'Finances'], ['workforce', 'Personnel'], ['operations', 'Opérations'], ['reporting', 'Reporting']];
const money = (n: string) => `${Number(n).toLocaleString('fr-FR')} DH`;
const dateLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR');

function ScopeForm({ users, branches, departments, onCreated }: { users: UserOption[]; branches: BranchOption[]; departments: DepartmentOption[]; onCreated: () => void }) {
  const [userId, setUserId] = useState('');
  const [scopeType, setScopeType] = useState<ScopeRow['scopeType']>('tenant');
  const [branchId, setBranchId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const submit = async () => {
    setError(null); setSaving(true);
    try {
      const r = await fetch('/api/leadership/admin/scopes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, scopeType, branchId: scopeType === 'branch' ? branchId : null, departmentId: scopeType === 'department' ? departmentId : null, startsOn, endsOn: endsOn || null }),
      });
      const j = await r.json();
      if (j.success) { setOpen(false); onCreated(); }
      else setError(j.error?.message ?? 'Création impossible.');
    } catch { setError('Erreur réseau.'); } finally { setSaving(false); }
  };

  return <Dialog open={open} onOpenChange={setOpen}>
    <Button size="sm" onClick={() => setOpen(true)} className="bg-[#2487B8] hover:bg-[#1B6C93]"><Plus className="mr-1 h-4 w-4" />Nouveau périmètre</Button>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Nouveau périmètre de direction</DialogTitle></DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2"><Label>Utilisateur</Label><Select value={userId} onValueChange={setUserId}><SelectTrigger><SelectValue placeholder="Choisir un utilisateur" /></SelectTrigger><SelectContent>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-2"><Label>Périmètre</Label><Select value={scopeType} onValueChange={v => setScopeType(v as ScopeRow['scopeType'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(['tenant', 'branch', 'department'] as const).map(t => <SelectItem key={t} value={t}>{SCOPE_LABELS[t]}</SelectItem>)}</SelectContent></Select></div>
        {scopeType === 'branch' && <div className="grid gap-2"><Label>Filiale</Label><Select value={branchId} onValueChange={setBranchId}><SelectTrigger><SelectValue placeholder="Choisir une filiale" /></SelectTrigger><SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>}
        {scopeType === 'department' && <div className="grid gap-2"><Label>Département</Label><Select value={departmentId} onValueChange={setDepartmentId}><SelectTrigger><SelectValue placeholder="Choisir un département" /></SelectTrigger><SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2"><Label>Début</Label><Input type="date" value={startsOn} onChange={e => setStartsOn(e.target.value)} /></div>
          <div className="grid gap-2"><Label>Fin (optionnelle)</Label><Input type="date" value={endsOn} onChange={e => setEndsOn(e.target.value)} /></div>
        </div>
        {error && <p className="flex items-center gap-2 text-sm text-rose-600"><AlertTriangle className="h-4 w-4" />{error}</p>}
      </div>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={() => void submit()} disabled={saving || !userId || !startsOn || (scopeType === 'branch' && !branchId) || (scopeType === 'department' && !departmentId)}>{saving ? 'Création…' : 'Créer'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function AuthorityForm({ scopes, authorities, onCreated }: { scopes: ScopeRow[]; authorities: AuthorityRow[]; onCreated: () => void }) {
  const [assignmentId, setAssignmentId] = useState('');
  const [domain, setDomain] = useState('finance');
  const [action, setAction] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [delegatedFromAuthorityId, setDelegatedFromAuthorityId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const scopeLabel = (a: ScopeRow) => `${a.userName} — ${SCOPE_LABELS[a.scopeType]}${a.scopeType === 'branch' && a.branchName ? ` (${a.branchName})` : ''}${a.scopeType === 'department' && a.departmentName ? ` (${a.departmentName})` : ''}`;

  const submit = async () => {
    setError(null); setSaving(true);
    try {
      const r = await fetch('/api/leadership/admin/authorities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId, domain, action, maxAmount: maxAmount || null, startsOn, endsOn: endsOn || null, delegatedFromAuthorityId: delegatedFromAuthorityId || null }),
      });
      const j = await r.json();
      if (j.success) { setOpen(false); onCreated(); }
      else setError(j.error?.message ?? 'Création impossible.');
    } catch { setError('Erreur réseau.'); } finally { setSaving(false); }
  };

  return <Dialog open={open} onOpenChange={setOpen}>
    <Button size="sm" onClick={() => setOpen(true)} className="bg-[#2487B8] hover:bg-[#1B6C93]"><Plus className="mr-1 h-4 w-4" />Nouvelle autorité</Button>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Nouvelle autorité d'approbation</DialogTitle></DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2"><Label>Périmètre</Label><Select value={assignmentId} onValueChange={setAssignmentId}><SelectTrigger><SelectValue placeholder="Choisir un périmètre" /></SelectTrigger><SelectContent>{scopes.map(s => <SelectItem key={s.id} value={s.id}>{scopeLabel(s)}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-2"><Label>Domaine</Label><Select value={domain} onValueChange={setDomain}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DOMAINS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-2"><Label>Action</Label><Input value={action} onChange={e => setAction(e.target.value)} placeholder="ex. Valider une note de crédit" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2"><Label>Plafond (DH, optionnel)</Label><Input type="number" min="0" step="0.01" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} /></div>
          <div className="grid gap-2"><Label>Délégation (optionnel)</Label><Select value={delegatedFromAuthorityId} onValueChange={setDelegatedFromAuthorityId}><SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger><SelectContent>{authorities.map(a => <SelectItem key={a.id} value={a.id}>{a.userName} — {DOMAIN_LABELS[a.domain] ?? a.domain} · {a.action}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2"><Label>Début</Label><Input type="date" value={startsOn} onChange={e => setStartsOn(e.target.value)} /></div>
          <div className="grid gap-2"><Label>Fin (optionnelle)</Label><Input type="date" value={endsOn} onChange={e => setEndsOn(e.target.value)} /></div>
        </div>
        {error && <p className="flex items-center gap-2 text-sm text-rose-600"><AlertTriangle className="h-4 w-4" />{error}</p>}
      </div>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={() => void submit()} disabled={saving || !assignmentId || !action.trim() || !startsOn}>{saving ? 'Création…' : 'Créer'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function LeadershipAdminClient() {
  const [scopes, setScopes] = useState<ScopeRow[]>([]);
  const [authorities, setAuthorities] = useState<AuthorityRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadScopes = useCallback(async () => {
    try { const r = await fetch('/api/leadership/admin/scopes', { cache: 'no-store' }); const j = await r.json(); if (j.success) setScopes(j.data); else setError(j.error?.message ?? 'Impossible de charger les périmètres.'); } catch { setError('Erreur réseau.'); }
  }, []);

  const loadAuthorities = useCallback(async () => {
    try { const r = await fetch('/api/leadership/admin/authorities', { cache: 'no-store' }); const j = await r.json(); if (j.success) setAuthorities(j.data); else setError(j.error?.message ?? 'Impossible de charger les autorités.'); } catch { setError('Erreur réseau.'); }
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    await Promise.all([loadScopes(), loadAuthorities()]);
    setLoading(false);
  }, [loadScopes, loadAuthorities]);

  const loadOptions = useCallback(async () => {
    const [u, b, d] = await Promise.all([
      fetch('/api/users?status=active', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
      fetch('/api/settings/branches', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
      fetch('/api/hr/departments?status=active', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
    ]);
    if (u?.success) setUsers(u.data.map((x: { id: string; fullName: string }) => ({ id: x.id, fullName: x.fullName })));
    if (b?.success) setBranches(b.data);
    if (d?.success) setDepartments(d.data);
  }, []);

  useEffect(() => { void load(); void loadOptions(); }, [load, loadOptions]);

  const scopeBadge = (s: ScopeRow) => <Badge variant="info">{SCOPE_LABELS[s.scopeType]}</Badge>;
  const scopeTarget = (s: ScopeRow) => s.scopeType === 'branch' ? (s.branchName ?? '—') : s.scopeType === 'department' ? (s.departmentName ?? '—') : null;

  return <div className="space-y-6">
    <div className="flex items-center justify-between"><div><h1 className="text-2xl font-extrabold text-[#16212B]">Administration de la direction</h1><p className="mt-1 text-sm text-slate-500">Attribuez des périmètres et autorités d'approbation aux responsables.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Actualiser</Button></div>

    {error ? <Card className="p-10 text-center"><AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" /><p className="font-medium">{error}</p></Card> : <Tabs defaultValue="scopes">
      <TabsList><TabsTrigger value="scopes">Périmètres</TabsTrigger><TabsTrigger value="authorities">Autorités</TabsTrigger></TabsList>

      <TabsContent value="scopes" className="space-y-4">
        <div className="flex justify-end"><ScopeForm users={users} branches={branches} departments={departments} onCreated={() => void load()} /></div>
        <Card className="p-2">
          {loading ? <div className="py-12 text-center text-sm text-slate-500">Chargement…</div> : scopes.length === 0 ? <div className="py-12 text-center"><ShieldCheck className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="font-medium">Aucun périmètre défini.</p></div> :
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Responsable</th><th className="p-3">Périmètre</th><th className="p-3">Cible</th><th className="p-3">Validité</th><th className="p-3">Statut</th></tr></thead><tbody>{scopes.map(s => <tr key={s.id} className="border-b last:border-0"><td className="p-3 font-medium">{s.userName}</td><td className="p-3">{scopeBadge(s)}</td><td className="p-3">{scopeTarget(s) ?? "Tout l'établissement"}</td><td className="p-3 text-slate-600">{dateLabel(s.startsOn)}{s.endsOn ? ` → ${dateLabel(s.endsOn)}` : ' → illimité'}</td><td className="p-3"><Badge variant={s.status === 'active' ? 'success' : 'neutral'}>{s.status}</Badge></td></tr>)}</tbody></table></div>}
        </Card>
      </TabsContent>

      <TabsContent value="authorities" className="space-y-4">
        <div className="flex justify-end"><AuthorityForm scopes={scopes} authorities={authorities} onCreated={() => void load()} /></div>
        <Card className="p-2">
          {loading ? <div className="py-12 text-center text-sm text-slate-500">Chargement…</div> : authorities.length === 0 ? <div className="py-12 text-center"><ShieldCheck className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="font-medium">Aucune autorité définie.</p></div> :
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Responsable</th><th className="p-3">Domaine</th><th className="p-3">Action</th><th className="p-3">Plafond</th><th className="p-3">Validité</th><th className="p-3">Statut</th></tr></thead><tbody>{authorities.map(a => <tr key={a.id} className="border-b last:border-0"><td className="p-3 font-medium">{a.userName}</td><td className="p-3"><Badge variant="neutral">{DOMAIN_LABELS[a.domain] ?? a.domain}</Badge></td><td className="p-3">{a.action}</td><td className="p-3">{a.maxAmount != null ? money(a.maxAmount) : '—'}</td><td className="p-3 text-slate-600">{dateLabel(a.startsOn)}{a.endsOn ? ` → ${dateLabel(a.endsOn)}` : ' → illimité'}</td><td className="p-3"><Badge variant={a.status === 'active' ? 'success' : 'neutral'}>{a.status}</Badge></td></tr>)}</tbody></table></div>}
        </Card>
      </TabsContent>
    </Tabs>}
  </div>;
}
