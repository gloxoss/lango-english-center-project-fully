'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertCircle, AlertTriangle, CheckCircle2, Phone, Siren, Square,
} from 'lucide-react';

type ApiErrorShape = { code?: string; message?: string };

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data?: T; error?: ApiErrorShape }> {
  try {
    const res = await fetch(url, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json' } });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, ...json };
  } catch {
    return { ok: false, status: 0, error: { code: 'NETWORK_ERROR', message: 'Impossible de joindre le serveur.' } };
  }
}

type Procedure = { id: string; title: string; body: string; version: number; updatedAt: string };
type Contact = { id: string; name: string; role: string; phone: string; priority: number };
type Emergency = { active: boolean; acknowledged: boolean; activation: { id: string; activatedAt: string; status: string; procedureSnapshot: Procedure[] } | null };

export function GuardEmergencyView() {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [emergency, setEmergency] = useState<Emergency>({ active: false, acknowledged: false, activation: null });
  const [canActivate, setCanActivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmActivate, setConfirmActivate] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setError(null);
    const [res, me] = await Promise.all([
      api<{ procedures: Procedure[]; contacts: Contact[]; emergency: Emergency }>('/api/guard/emergency/procedures'),
      api<{ role: string; permissions: string[] }>('/api/me/permissions'),
    ]);
    if (res.ok && res.data) {
      setProcedures(res.data.procedures);
      setContacts(res.data.contacts);
      setEmergency(res.data.emergency);
    } else if (res.error) {
      setError(res.error.message ?? 'Chargement impossible.');
    }
    if (me.ok && me.data) {
      setCanActivate(me.data.permissions.includes('guard.emergency.activate'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activate = async () => {
    setBusy(true);
    setError(null);
    const res = await api('/api/guard/emergency/activate', {
      method: 'POST',
      body: JSON.stringify({ reason: reason.trim() || null }),
    });
    setBusy(false);
    setConfirmActivate(false);
    setReason('');
    if (res.ok) await load();
    else setError(res.error?.message ?? 'Activation impossible.');
  };

  const end = async () => {
    if (!emergency.activation) return;
    setBusy(true);
    setError(null);
    const res = await api(`/api/guard/emergency/${emergency.activation.id}/end`, {
      method: 'POST',
      body: JSON.stringify({ reason: null }),
    });
    setBusy(false);
    if (res.ok) await load();
    else setError(res.error?.message ?? 'Fin de l\'urgence impossible.');
  };

  const acknowledge = async () => {
    if (!emergency.activation) return;
    setBusy(true);
    setError(null);
    const res = await api(`/api/guard/emergency/${emergency.activation.id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    setBusy(false);
    if (res.ok) await load();
    else setError(res.error?.message ?? 'Accusé de réception impossible.');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">Urgence</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Procédures, contacts et gestion du mode urgence.
          </p>
        </div>
        <Badge className={emergency.active ? 'animate-pulse bg-rose-600 text-white' : 'bg-[#DCEBF4] text-[#1B6C93]'}>
          <Siren className="mr-1 h-3.5 w-3.5" /> {emergency.active ? 'URGENCE ACTIVE' : 'Aucune urgence active'}
        </Badge>
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-rose-600"><AlertCircle className="h-4 w-4" />{error}</p>}

      {emergency.active && (
        <Card className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5 shadow-2xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-extrabold text-rose-700">
                <AlertTriangle className="h-5 w-5" /> Urgence active
              </p>
              <p className="mt-0.5 text-xs text-rose-600">
                Activée le {emergency.activation ? new Date(emergency.activation.activatedAt).toLocaleString('fr-FR') : '—'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!emergency.acknowledged && (
                <Button onClick={() => void acknowledge()} disabled={busy}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Accuser réception
                </Button>
              )}
              {emergency.acknowledged && (
                <Badge className="bg-[#D1F5E8] text-[#0b5c3a]"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Accusé reçu</Badge>
              )}
              {canActivate && (
                <Button variant="danger" onClick={() => void end()} disabled={busy}>
                  <Square className="mr-2 h-4 w-4" /> Terminer l&apos;urgence
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {!emergency.active && canActivate && (
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-extrabold text-[#16212B]">Activer le mode urgence</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Prend un instantané des procédures actives pour chaque gardien.
              </p>
            </div>
            <Button variant="danger" onClick={() => setConfirmActivate(true)}>
              <AlertTriangle className="mr-2 h-4 w-4" /> Activer
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <h2 className="font-extrabold text-[#16212B]">Procédures actives</h2>
          {procedures.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">Aucune procédure active.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {procedures.map(p => (
                <details key={p.id} className="group rounded-xl border border-slate-200/80 bg-slate-50 p-3">
                  <summary className="cursor-pointer list-none font-semibold text-[#16212B]">
                    {p.title}
                    <span className="ml-2 text-xs font-normal text-slate-400">v{p.version}</span>
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{p.body}</p>
                </details>
              ))}
            </div>
          )}
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <h2 className="flex items-center gap-2 font-extrabold text-[#16212B]"><Phone className="h-4 w-4 text-[#1B6C93]" /> Contacts d&apos;urgence</h2>
          {contacts.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">Aucun contact.</p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {contacts.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#16212B]">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.role}</p>
                  </div>
                  <a href={`tel:${c.phone}`} className="shrink-0 rounded-lg bg-[#E4EDFD] px-3 py-1.5 font-mono text-xs font-bold text-[#2487B8] transition hover:bg-[#D4E4FD]">
                    {c.phone}
                  </a>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {emergency.active && emergency.activation?.procedureSnapshot && emergency.activation.procedureSnapshot.length > 0 && (
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <h2 className="font-extrabold text-[#16212B]">Procédures de l&apos;urgence en cours</h2>
          <div className="mt-3 space-y-3">
            {emergency.activation.procedureSnapshot.map((p, idx) => (
              <div key={`${p.id}-${idx}`} className="rounded-xl border border-slate-200/80 bg-slate-50 p-3">
                <p className="font-semibold text-[#16212B]">{p.title} <span className="text-xs font-normal text-slate-400">v{p.version}</span></p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{p.body}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Dialog open={confirmActivate} onOpenChange={setConfirmActivate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Activer le mode urgence</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Confirmer l&apos;activation ? Tous les gardiens verront une alerte et pourront accuser réception.
            </p>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2487B8]/40"
              placeholder="Motif (optionnel)…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmActivate(false)} disabled={busy}>Annuler</Button>
            <Button variant="danger" onClick={() => void activate()} disabled={busy}>
              {busy ? 'Activation…' : 'Activer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
