'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertCircle, KeyRound, Loader2, LogIn, RotateCcw, UserRoundX, Users,
} from 'lucide-react';
import {
  EMPLOYMENT_STATUS_LABELS, EMPLOYMENT_STATUS_STYLES,
  type EmployeeRow, type EmploymentStatus,
} from '@/features/hr/model/types';

type ApiErrorShape = { code?: string; message?: string };

type CandidateRow = { id: string; name: string; email: string; role: string };
type AccessData = { employees: EmployeeRow[]; candidates: CandidateRow[] };

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin', school_admin: 'Admin', teacher: 'Enseignant', accountant: 'Comptable',
  student: 'Élève', alumni: 'Ancien(ne) élève', parent: 'Tuteur', receptionist: 'Réceptionniste', guard: 'Gardien',
};

type Filter = 'all' | 'linked' | 'unlinked' | 'offboarded';

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data?: T; error?: ApiErrorShape }> {
  try {
    const res = await fetch(url, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...json };
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Impossible de joindre le serveur.' } };
  }
}

type Action = 'link' | 'offboard' | 'reactivate' | null;

export function AccessLifecycleView() {
  const router = useRouter();
  const [data, setData] = useState<AccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const [action, setAction] = useState<Action>(null);
  const [target, setTarget] = useState<EmployeeRow | null>(null);
  const [candidateId, setCandidateId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api<AccessData>('/api/hr/access');
    if (res.ok && res.data) setData(res.data);
    else setError(res.error?.message ?? 'Impossible de charger les accès.');
    setLoading(false);
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);

  const openAction = (a: Action, row: EmployeeRow) => {
    setAction(a);
    setTarget(row);
    setCandidateId('');
    setReason('');
    setActionError(null);
  };

  const submit = async () => {
    if (!action || !target) return;
    setBusy(true);
    setActionError(null);
    let res: { ok: boolean; error?: ApiErrorShape };
    if (action === 'link') {
      if (!candidateId) {
        setActionError('Choisissez un compte à lier.');
        setBusy(false);
        return;
      }
      res = await api(`/api/hr/employees/${target.id}/link-account`, {
        method: 'POST', body: JSON.stringify({ userId: candidateId }),
      });
    } else if (action === 'offboard') {
      res = await api(`/api/hr/employees/${target.id}/offboard`, {
        method: 'POST', body: JSON.stringify({ reason: reason || null }),
      });
    } else {
      res = await api(`/api/hr/employees/${target.id}/reactivate`, {
        method: 'POST', body: JSON.stringify({ reason: reason || null }),
      });
    }
    setBusy(false);
    if (res.ok) {
      setAction(null);
      await load();
    } else {
      setActionError(res.error?.message ?? 'Opération impossible.');
    }
  };

  const counts = useMemo(() => {
    const list = data?.employees ?? [];
    return {
      total: list.length,
      linked: list.filter(e => e.userId).length,
      unlinked: list.filter(e => !e.userId).length,
      offboarded: list.filter(e => e.employmentStatus === 'offboarded').length,
    };
  }, [data]);

  const rows = useMemo(() => {
    const list = data?.employees ?? [];
    if (filter === 'linked') return list.filter(e => e.userId);
    if (filter === 'unlinked') return list.filter(e => !e.userId);
    if (filter === 'offboarded') return list.filter(e => e.employmentStatus === 'offboarded');
    return list;
  }, [data, filter]);

  const kpis: Array<{ label: string; value: number; cls?: string }> = [
    { label: 'Effectif', value: counts.total },
    { label: 'Avec compte', value: counts.linked, cls: 'text-[#0b5c3a]' },
    { label: 'Sans compte', value: counts.unlinked, cls: 'text-amber-600' },
    { label: 'Désactivés', value: counts.offboarded, cls: 'text-red-600' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#16212B]">Accès & Sorties</h1>
          <p className="mt-1 text-sm text-slate-500">Cycle de vie des comptes employés : liaison, désactivation et réactivation.</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/dashboard/hr/employees/new')}><LogIn className="mr-2 h-4 w-4" /> Nouvel employé</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(k => (
          <Card key={k.label} className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs ${k.cls ?? ''}`}>
            <p className="text-sm text-slate-500">{k.label}</p>
            <p className="mt-1 text-3xl font-bold text-[#16212B]">{k.value}</p>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="w-48">
          <Select value={filter} onValueChange={v => setFilter(v as Filter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="linked">Avec compte</SelectItem>
              <SelectItem value="unlinked">Sans compte</SelectItem>
              <SelectItem value="offboarded">Désactivés</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-slate-500">{rows.length} employé(s)</p>
      </div>

      <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        {loading ? (
          <p className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</p>
        ) : error ? (
          <p className="flex items-center gap-1 p-6 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">Aucun employé dans ce filtre.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-4 font-medium">Employé</th>
                  <th className="py-2 pr-4 font-medium">Statut</th>
                  <th className="py-2 pr-4 font-medium">Compte</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(emp => (
                  <tr key={emp.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="py-3 pr-4">
                      <button className="text-left" onClick={() => router.push(`/dashboard/hr/employees/${emp.id}`)}>
                        <p className="font-medium text-[#16212B]">{emp.displayName}</p>
                        <p className="font-mono text-xs text-slate-400">{emp.employeeId || '—'}</p>
                      </button>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge className={EMPLOYMENT_STATUS_STYLES[emp.employmentStatus]}>
                        {EMPLOYMENT_STATUS_LABELS[emp.employmentStatus as EmploymentStatus]}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4">
                      {emp.userId ? (
                        <div>
                          <span className="flex items-center gap-1 text-[#0b5c3a]"><KeyRound className="h-3.5 w-3.5" /> Lié</span>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{emp.accountEmail || emp.accountName}</p>
                        </div>
                      ) : (
                        <span className="text-amber-600">Sans compte</span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!emp.userId && emp.employmentStatus !== 'offboarded' && (
                          <Button size="sm" variant="outline" onClick={() => openAction('link', emp)}>
                            <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Lier un compte
                          </Button>
                        )}
                        {emp.employmentStatus === 'offboarded' ? (
                          <Button size="sm" variant="outline" className="text-[#0b5c3a]" onClick={() => openAction('reactivate', emp)}>
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Réactiver
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="text-red-600" onClick={() => openAction('offboard', emp)}>
                            <UserRoundX className="mr-1.5 h-3.5 w-3.5" /> Désactiver
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={action !== null} onOpenChange={o => { if (!o && !busy) setAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'link' && 'Lier un compte utilisateur'}
              {action === 'offboard' && `Désactiver ${target?.displayName ?? ''}`}
              {action === 'reactivate' && `Réactiver ${target?.displayName ?? ''}`}
            </DialogTitle>
          </DialogHeader>

          {action === 'link' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                Associez un compte existant (non lié) à ce dossier employé. Cette liaison est définitive.
              </p>
              <div>
                <Label className="mb-1 block text-sm font-medium text-slate-700">Compte utilisateur</Label>
                <Select value={candidateId} onValueChange={setCandidateId}>
                  <SelectTrigger><SelectValue placeholder="Choisir un compte" /></SelectTrigger>
                  <SelectContent>
                    {(data?.candidates ?? []).map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — {c.email} ({ROLE_LABELS[c.role] ?? c.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(data?.candidates ?? []).length === 0 && (
                  <p className="mt-2 text-xs text-amber-600">Aucun compte non lié disponible dans cet établissement.</p>
                )}
              </div>
            </div>
          )}

          {action !== 'link' && (
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">Motif (facultatif)</Label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Raison de la sortie / de la réactivation…" />
              <p className="mt-2 text-xs text-slate-500">
                {action === 'offboard'
                  ? 'La sortie désactive l\'accès au compte lié tout en conservant l\'historique (paie, congés, documents).'
                  : 'La réactivation rétablit le statut actif et réactive l\'accès du compte lié.'}
              </p>
            </div>
          )}

          {actionError && (
            <p className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{actionError}</p>
          )}

          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setAction(null)}>Annuler</Button>
            <Button onClick={submit} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {action === 'link' && 'Lier le compte'}
              {action === 'offboard' && 'Confirmer la sortie'}
              {action === 'reactivate' && 'Confirmer la réactivation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
