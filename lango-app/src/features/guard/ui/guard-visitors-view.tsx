'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle, CheckCircle2, DoorOpen, Loader2, LogIn, LogOut, Plus, QrCode, Search, UserPlus,
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

type Visit = {
  id: string;
  visitorFirstName: string;
  visitorLastName: string;
  visitorPhone: string | null;
  visitorEmail: string | null;
  purpose: string;
  hostName: string | null;
  passNumber: string | null;
  hasPass: boolean;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  createdAt: string;
};

type Invitation = {
  id: string;
  visitorFirstName: string;
  visitorLastName: string;
  visitorPhone: string | null;
  purpose: string;
  hostId: string;
  hostName: string | null;
  expectedDate: string;
  expectedStart: string;
  expectedEnd: string;
  status: string;
  approvedAt: string | null;
  createdAt: string;
};

function toDateInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function GuardVisitorsView() {
  const t = useTranslations('Guard');
  const tCommon = useTranslations('Common');

  const [tab, setTab] = useState<'visits' | 'invitations'>('visits');
  const [error, setError] = useState<string | null>(null);

  const [gate, setGate] = useState<{ id: string; gateName: string } | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);

  const [visits, setVisits] = useState<Visit[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ visitorFirstName: '', visitorLastName: '', visitorPhone: '', purpose: '', approved: true });

  const [passDialog, setPassDialog] = useState<{ visitId: string; rawToken: string } | null>(null);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-[#D1F5E8] text-[#0b5c3a]">{t('statusApproved')}</Badge>;
      case 'checked_in': return <Badge className="bg-[#DCEBF4] text-[#1B6C93]">{t('statusCheckedIn')}</Badge>;
      case 'checked_out': return <Badge className="bg-slate-100 text-slate-600">{t('statusCheckedOut')}</Badge>;
      case 'pending': return <Badge className="bg-amber-50 text-amber-700">{t('statusPending')}</Badge>;
      case 'invited': return <Badge className="bg-amber-50 text-amber-700">{t('statusInvited')}</Badge>;
      case 'rejected': return <Badge className="bg-rose-50 text-rose-700">{t('statusRejected')}</Badge>;
      case 'cancelled': return <Badge className="bg-slate-100 text-slate-500">{t('statusCancelled')}</Badge>;
      default: return <Badge className="bg-slate-100 text-slate-600">{status}</Badge>;
    }
  };

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

  const loadVisits = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (statusFilter) params.set('status', statusFilter);
    const res = await api<Visit[]>(`/api/guard/visits?${params.toString()}`);
    if (res.ok && Array.isArray(res.data)) setVisits(res.data);
  }, [q, statusFilter]);

  const loadInvitations = useCallback(async () => {
    const res = await api<Invitation[]>('/api/guard/visitor-invitations');
    if (res.ok && Array.isArray(res.data)) setInvitations(res.data);
  }, []);

  useEffect(() => {
    loadGate();
  }, [loadGate]);

  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  const createVisit = async () => {
    if (!createForm.visitorFirstName.trim() || !createForm.purpose.trim()) return;
    setCreating(true);
    setError(null);
    const res = await api('/api/guard/visits', {
      method: 'POST',
      body: JSON.stringify({
        visitorFirstName: createForm.visitorFirstName.trim(),
        visitorLastName: createForm.visitorLastName.trim(),
        visitorPhone: createForm.visitorPhone.trim() || null,
        purpose: createForm.purpose.trim(),
        approved: createForm.approved,
      }),
    });
    setCreating(false);
    if (res.ok) {
      setCreateForm({ visitorFirstName: '', visitorLastName: '', visitorPhone: '', purpose: '', approved: true });
      await loadVisits();
    } else {
      setError(res.error?.message ?? tCommon('error'));
    }
  };

  const checkIn = async (v: Visit) => {
    setError(null);
    if (!gate) return;
    const res = await api(`/api/guard/visits/${v.id}/check-in`, {
      method: 'POST',
      body: JSON.stringify({ gateId: gate.id, idempotencyKey: crypto.randomUUID() }),
    });
    if (res.ok) await loadVisits();
    else setError(res.error?.message ?? tCommon('error'));
  };

  const checkOut = async (v: Visit) => {
    setError(null);
    if (!gate) return;
    const res = await api(`/api/guard/visits/${v.id}/check-out`, {
      method: 'POST',
      body: JSON.stringify({ gateId: gate.id, idempotencyKey: crypto.randomUUID() }),
    });
    if (res.ok) await loadVisits();
    else setError(res.error?.message ?? tCommon('error'));
  };

  const issuePass = async (v: Visit) => {
    setError(null);
    const res = await api<{ rawToken: string }>(`/api/guard/visits/${v.id}/pass`, { method: 'POST' });
    if (res.ok && res.data?.rawToken) {
      setPassDialog({ visitId: v.id, rawToken: res.data.rawToken });
      await loadVisits();
    } else {
      setError(res.error?.message ?? tCommon('error'));
    }
  };

  const decideInvitation = async (inv: Invitation, decision: 'approve' | 'reject') => {
    setError(null);
    const res = await api(`/api/guard/visitor-invitations/${inv.id}/${decision}`, { method: 'POST' });
    if (res.ok) await loadInvitations();
    else setError(res.error?.message ?? tCommon('error'));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('visitorsTitle')}</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            {t('visitorsSubtitle')}
            {gate ? ` · ${t('gateLabel')} : ${gate.gateName}` : gateError ? ` · ${gateError}` : ` · ${t('loadingGate')}`}
          </p>
        </div>
        <Badge className="bg-[#DCEBF4] text-[#1B6C93]"><DoorOpen className="mr-1 h-3.5 w-3.5" /> {t('visitorsBadge')}</Badge>
      </div>

      {error && <p className="flex items-center gap-1 text-sm text-rose-600"><AlertCircle className="h-4 w-4" />{error}</p>}
      {!gate && !gateError && <p className="text-xs text-slate-500">{t('loadingGate')}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => setTab('visits')}
          className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === 'visits' ? 'bg-[#16212B] text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
        >{t('tabVisits')}</button>
        <button
          onClick={() => setTab('invitations')}
          className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === 'invitations' ? 'bg-[#16212B] text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
        >{t('tabInvitations', { count: invitations.length })}</button>
      </div>

      {tab === 'visits' && (
        <>
          <Card className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder={t('searchVisitorPlaceholder')}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter || undefined} onValueChange={v => setStatusFilter(v)}>
                <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder={t('allStatuses')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">{t('statusApproved')}</SelectItem>
                  <SelectItem value="checked_in">{t('statusCheckedIn')}</SelectItem>
                  <SelectItem value="checked_out">{t('statusCheckedOut')}</SelectItem>
                  <SelectItem value="pending">{t('statusPending')}</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => { setCreateForm({ visitorFirstName: '', visitorLastName: '', visitorPhone: '', purpose: '', approved: true }); }}>
                <UserPlus className="mr-2 h-4 w-4" /> {t('btnWalkInVisitor')}
              </Button>
            </div>
          </Card>

          <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
            {visits.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">{t('noVisits')}</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {visits.map(v => (
                  <div key={v.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#16212B]">
                        {v.visitorFirstName} {v.visitorLastName}
                        {v.passNumber && <span className="ml-2 font-mono text-xs text-slate-400">{t('passLabel', { number: v.passNumber })}</span>}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {v.purpose}{v.hostName ? ` · ${t('hostedBy', { name: v.hostName })}` : ''}{v.visitorPhone ? ` · ${v.visitorPhone}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {statusBadge(v.status)}
                      {v.status === 'approved' && !v.hasPass && (
                        <Button size="sm" onClick={() => void issuePass(v)}><QrCode className="mr-1.5 h-3.5 w-3.5" /> {t('btnIssuePass')}</Button>
                      )}
                      {(v.status === 'approved') && (
                        <Button size="sm" variant="outline" disabled={!gate} onClick={() => void checkIn(v)}>
                          <LogIn className="mr-1.5 h-3.5 w-3.5" /> {t('btnCheckIn')}
                        </Button>
                      )}
                      {v.status === 'checked_in' && (
                        <Button size="sm" variant="outline" disabled={!gate} onClick={() => void checkOut(v)}>
                          <LogOut className="mr-1.5 h-3.5 w-3.5" /> {t('btnCheckOut')}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {tab === 'invitations' && (
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
          {invitations.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">{t('noInvitations')}</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {invitations.map(inv => (
                <div key={inv.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#16212B]">
                      {inv.visitorFirstName} {inv.visitorLastName}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {toDateInput(inv.expectedDate)} · {inv.expectedStart}–{inv.expectedEnd}
                      </span>
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {inv.purpose}{inv.hostName ? ` · ${t('hostLabel', { name: inv.hostName })}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {statusBadge(inv.status)}
                    {inv.status === 'invited' && (
                      <>
                        <Button size="sm" onClick={() => void decideInvitation(inv, 'approve')}>
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> {t('btnApprove')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void decideInvitation(inv, 'reject')}>{t('btnReject')}</Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('dialogWalkInTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-sm font-medium text-slate-700">{t('firstName')}</Label>
                <Input value={createForm.visitorFirstName} onChange={e => setCreateForm({ ...createForm, visitorFirstName: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-sm font-medium text-slate-700">{t('lastName')}</Label>
                <Input value={createForm.visitorLastName} onChange={e => setCreateForm({ ...createForm, visitorLastName: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('phone')}</Label>
              <Input value={createForm.visitorPhone} onChange={e => setCreateForm({ ...createForm, visitorPhone: e.target.value })} placeholder={t('locationPlaceholder')} />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-slate-700">{t('purpose')}</Label>
              <Input value={createForm.purpose} onChange={e => setCreateForm({ ...createForm, purpose: e.target.value })} placeholder={t('purposePlaceholder')} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={createForm.approved}
                onChange={e => setCreateForm({ ...createForm, approved: e.target.checked })}
                className="h-4 w-4 accent-[#1B6C93]"
              />
              {t('approveImmediately')}
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>{tCommon('cancel')}</Button>
            <Button
              onClick={() => void createVisit()}
              disabled={!createForm.visitorFirstName.trim() || !createForm.purpose.trim()}
            >
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} {t('btnRegister')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passDialog !== null} onOpenChange={o => { if (!o) setPassDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('dialogPassIssuedTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              {t('passIssuedDesc')}
            </p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="break-all select-all font-mono text-xs text-[#16212B]">{passDialog?.rawToken}</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setPassDialog(null)}>{tCommon('close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
