'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('Guard');
  const tCommon = useTranslations('Common');
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
    <div className="mx-auto max-w-6xl space-y-6 text-start">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('emergencyTitle')}</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            {t('emergencySubtitle')}
          </p>
        </div>
        <Badge className={emergency.active ? 'animate-pulse bg-rose-600 text-white' : 'bg-[#DCEBF4] text-[#1B6C93]'}>
          <Siren className="me-1 h-3.5 w-3.5" /> {emergency.active ? t('activeEmergencyBadge') : t('noActiveEmergency')}
        </Badge>
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-rose-600"><AlertCircle className="h-4 w-4" />{error}</p>}

      {emergency.active && (
        <Card className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5 shadow-2xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-extrabold text-rose-700">
                <AlertTriangle className="h-5 w-5" /> {t('activeEmergencyBadge')}
              </p>
              <p className="mt-0.5 text-xs text-rose-600">
                {t('activatedAt', { time: emergency.activation ? new Date(emergency.activation.activatedAt).toLocaleString('fr-FR') : '—' })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!emergency.acknowledged && (
                <Button onClick={() => void acknowledge()} disabled={busy}>
                  <CheckCircle2 className="me-2 h-4 w-4" /> {t('btnAcknowledge')}
                </Button>
              )}
              {emergency.acknowledged && (
                <Badge className="bg-[#D1F5E8] text-[#0b5c3a]"><CheckCircle2 className="me-1 h-3.5 w-3.5" /> {t('acknowledgedBadge')}</Badge>
              )}
              {canActivate && (
                <Button variant="danger" onClick={() => void end()} disabled={busy}>
                  <Square className="me-2 h-4 w-4" /> {t('btnEndEmergency')}
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
              <p className="font-extrabold text-[#16212B]">{t('btnActivateEmergency')}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {t('activateEmergencyDesc')}
              </p>
            </div>
            <Button variant="danger" onClick={() => setConfirmActivate(true)}>
              <AlertTriangle className="me-2 h-4 w-4" /> {t('btnActivate')}
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <h2 className="font-extrabold text-[#16212B]">{t('activeProcedures')}</h2>
          {procedures.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">{t('noProcedures')}</p>
          ) : (
            <div className="mt-3 space-y-3">
              {procedures.map(p => (
                <details key={p.id} className="group rounded-xl border border-slate-200/80 bg-slate-50 p-3">
                  <summary className="cursor-pointer list-none font-semibold text-[#16212B]">
                    {p.title}
                    <span className="ms-2 text-xs font-normal text-slate-400">v{p.version}</span>
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{p.body}</p>
                </details>
              ))}
            </div>
          )}
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <h2 className="flex items-center gap-2 font-extrabold text-[#16212B]"><Phone className="h-4 w-4 text-[#1B6C93]" /> {t('emergencyContacts')}</h2>
          {contacts.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">{t('noContacts')}</p>
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
          <h2 className="font-extrabold text-[#16212B]">{t('currentEmergencyProcedures')}</h2>
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
          <DialogHeader><DialogTitle>{t('confirmActivateTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-start">
            <p className="text-sm text-slate-600">
              {t('confirmActivateDesc')}
            </p>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2487B8]/40"
              placeholder={t('reasonOptional')}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmActivate(false)} disabled={busy}>{tCommon('cancel')}</Button>
            <Button variant="danger" onClick={() => void activate()} disabled={busy}>
              {busy ? t('activating') : t('btnActivate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
