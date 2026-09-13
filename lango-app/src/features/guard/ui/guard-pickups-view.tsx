'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertCircle, CheckCircle2, DoorOpen, Loader2, LogOut, Search, ShieldCheck, UserRound,
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

type StudentSearchItem = { id: string; matricule: string | null; name: string };

type ActiveAuthorization = { id: string; authorizedFrom: string; authorizedUntil: string; reason: string | null };

type PickupLink = {
  pickupPersonId: string;
  firstName: string | null;
  lastName: string | null;
  relationshipType: string;
  isPrimaryContact: boolean | null;
  isEmergencyContact: boolean | null;
  canPickup: boolean | null;
  activeAuthorizations: ActiveAuthorization[];
};

type StudentPickups = {
  student: { id: string; matricule: string | null; name: string };
  pickups: PickupLink[];
};

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function GuardPickupsView() {
  const t = useTranslations('Guard');
  const tCommon = useTranslations('Common');

  const [gate, setGate] = useState<{ id: string; gateName: string } | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<StudentSearchItem[]>([]);
  const [searched, setSearched] = useState(false);

  const [selected, setSelected] = useState<StudentPickups | null>(null);
  const [loadingPickups, setLoadingPickups] = useState(false);

  const [confirmAuth, setConfirmAuth] = useState<{ studentName: string; pickupName: string; authorizationId: string } | null>(null);
  const [releasing, setReleasing] = useState(false);

  const loadGate = useCallback(async () => {
    const res = await api<{ gate: { id: string; gateName: string } }>('/api/guard/me/gate');
    if (res.ok && res.data?.gate) {
      setGate({ id: res.data.gate.id, gateName: res.data.gate.gateName });
      setGateError(null);
    } else {
      setGate(null);
      setGateError(res.error?.message ?? t('noActiveGate'));
    }
  }, [t]);

  useEffect(() => { loadGate(); }, [loadGate]);

  const search = async () => {
    const term = q.trim();
    if (term.length < 3) return;
    setSearching(true);
    setError(null);
    setSelected(null);
    const res = await api<StudentSearchItem[]>(`/api/guard/students/search?q=${encodeURIComponent(term)}`);
    setSearching(false);
    setSearched(true);
    if (res.ok && Array.isArray(res.data)) {
      setResults(res.data);
      if (res.data.length === 0) setSuccessMsg(null);
    } else {
      setResults([]);
      setError(res.error?.message ?? t('errSearchFailed'));
    }
  };

  const selectStudent = async (studentId: string) => {
    setLoadingPickups(true);
    setError(null);
    setSuccessMsg(null);
    const res = await api<StudentPickups>(`/api/guard/students/${studentId}/pickups`);
    setLoadingPickups(false);
    if (res.ok && res.data) {
      setSelected(res.data);
      setResults([]);
    } else {
      setError(res.error?.message ?? tCommon('loading'));
    }
  };

  const release = async () => {
    if (!confirmAuth || !gate) return;
    setReleasing(true);
    setError(null);
    setSuccessMsg(null);
    const res = await api('/api/guard/pickups/release', {
      method: 'POST',
      body: JSON.stringify({
        studentId: selected?.student.id,
        authorizationId: confirmAuth.authorizationId,
        method: 'manual',
        gateId: gate.id,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    setReleasing(false);
    setConfirmAuth(null);
    if (res.ok) {
      setSuccessMsg(t('releasedSuccess', { student: confirmAuth.studentName, pickup: confirmAuth.pickupName }));
      if (selected) await selectStudent(selected.student.id);
    } else {
      setError(res.error?.message ?? t('errReleaseFailed'));
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('pickupsTitle')}</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            {t('pickupsSubtitle')}
            {gate ? ` · ${t('gateLabel')} : ${gate.gateName}` : gateError ? ` · ${gateError}` : ` · ${t('loadingGate')}`}
          </p>
        </div>
        <Badge className="bg-[#DCEBF4] text-[#1B6C93]"><DoorOpen className="mr-1 h-3.5 w-3.5" /> {t('pickupsBadge')}</Badge>
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-rose-600"><AlertCircle className="h-4 w-4" />{error}</p>}
      {successMsg && <p className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />{successMsg}</p>}
      {!gate && !gateError && <p className="text-xs text-slate-500">{t('loadingGate')}</p>}

      {!selected && (
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <label className="mb-1 block text-sm font-medium text-slate-700">{t('searchStudent')}</label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void search(); }}
                placeholder={t('searchPlaceholder')}
                className="pl-9"
              />
            </div>
            <Button onClick={() => void search()} disabled={q.trim().length < 3 || searching}>
              {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />} {t('btnSearch')}
            </Button>
          </div>

          {searching && <p className="mt-4 text-sm text-slate-500">{t('searching')}</p>}
          {!searching && searched && results.length === 0 && (
            <p className="mt-4 text-sm text-slate-500">{t('noStudentFound')}</p>
          )}
          {!searching && results.length > 0 && (
            <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200/80">
              {results.map(s => (
                <button
                  key={s.id}
                  onClick={() => void selectStudent(s.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start transition hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2 font-semibold text-[#16212B]">
                    <UserRound className="h-4 w-4 text-[#1B6C93]" /> {s.name}
                  </span>
                  {s.matricule && <span className="font-mono text-xs text-slate-400">{s.matricule}</span>}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {loadingPickups && <p className="text-sm text-slate-500">{t('loadingAuthorizedPersons')}</p>}

      {selected && !loadingPickups && (
        <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-extrabold text-[#16212B]">{selected.student.name}</p>
              {selected.student.matricule && <p className="font-mono text-xs text-slate-400">{selected.student.matricule}</p>}
            </div>
            <Button variant="outline" size="sm" onClick={() => { setSelected(null); setResults([]); setSearched(false); }}>
              {t('newSearch')}
            </Button>
          </div>

          {selected.pickups.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              {t('noLinkedContacts')}
            </p>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {selected.pickups.map(p => (
                <div key={p.pickupPersonId} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#16212B]">
                      {p.firstName} {p.lastName}
                      {p.isPrimaryContact && <span className="ml-2 rounded bg-[#D1F5E8] px-1.5 py-0.5 text-[10px] font-bold text-[#0b5c3a]">{t('primaryContact')}</span>}
                      {p.isEmergencyContact && <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">{t('emergency')}</span>}
                    </p>
                    <p className="text-xs text-slate-500">{p.relationshipType}</p>
                    {p.activeAuthorizations.length === 0 && (
                      <p className="mt-1 text-xs text-slate-400">{t('noActiveReleaseAuth')}</p>
                    )}
                    {p.activeAuthorizations.length > 0 && (
                      <ul className="mt-2 space-y-1.5">
                        {p.activeAuthorizations.map(a => (
                          <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2">
                            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                            <span className="text-xs text-slate-600">
                              {fmtDateTime(a.authorizedFrom)} → {fmtDateTime(a.authorizedUntil)}
                            </span>
                            {a.reason && <span className="text-xs text-slate-400">· {a.reason}</span>}
                            <Button
                              size="sm"
                              variant="outline"
                              className="ml-auto"
                              disabled={!gate}
                              onClick={() => setConfirmAuth({
                                studentName: selected.student.name,
                                pickupName: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(),
                                authorizationId: a.id,
                              })}
                            >
                              <LogOut className="mr-1.5 h-3.5 w-3.5" /> {t('btnRelease')}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Dialog open={confirmAuth !== null} onOpenChange={o => { if (!o) setConfirmAuth(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('confirmReleaseTitle')}</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">
            {t('confirmReleaseDesc', {
              student: confirmAuth?.studentName ?? '',
              pickup: confirmAuth?.pickupName ?? '',
              gate: gate?.gateName ?? ''
            })}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAuth(null)} disabled={releasing}>{tCommon('cancel')}</Button>
            <Button onClick={() => void release()} disabled={releasing}>
              {releasing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />} {t('btnConfirmExit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
