'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Award, Ban, Calendar, CheckCircle2, Clock, Download, DollarSign, FileText,
  FolderDown, Loader2, LogIn, PiggyBank, ShieldAlert, User, UserCheck,
} from 'lucide-react';

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

type ApiResult<T> = { success: boolean; data?: T; error?: { code?: string; message?: string } };

type HomeData = {
  leaveBalances: {
    categoryId: string; categoryName: string; daysPerYear: number | null;
    accruedDays: number; usedDays: number; remainingDays: number;
  }[];
  totalRemaining: number;
  latestPayslip: {
    id: string; issuedAt: string | null; year: number | null; month: number | null;
    grossSalary: string; netSalary: string;
  } | null;
  punch: { id: string; punchType: string; scannedAt: string } | null;
  todaySchedule: {
    dayOfWeek: string; startTime: string; endTime: string; roomLabel: string | null;
    className: string; sectionName: string; subjectName: string;
  }[];
};

type ProfileData = {
  user: {
    name: string; email: string; firstName: string | null; lastName: string | null;
    phone: string | null; dateOfBirth: string | null; gender: string | null; address: string | null;
  } | null;
  employee: {
    id: string; cnssNumber: string | null; amoNumber: string | null; bankRib: string | null;
    contractType: string; dependantsCount: number; name: string; email: string; role: string;
  };
};

type LeaveRow = {
  id: string; categoryName: string; startDate: string; endDate: string; daysRequested: string;
  status: string; reason: string | null; createdAt: string;
};

type TimeData = {
  punches: { id: string; punchType: string; scannedAt: string; notes: string | null }[];
  sessions: { in: string; out: string; durationMinutes: number }[];
  openSession: { in: string } | null;
  todayTotalMinutes: number;
};

type PayrollData = {
  payslips: {
    id: string; year: number | null; month: number | null; issuedAt: string | null;
    grossSalary: string; netSalary: string; employeeName: string;
  }[];
  annualSummaries: { year: number; count: number; totalNet: number }[];
};

type AdvanceData = {
  advances: {
    id: string; requestedAmount: number; approvedAmount: number | null; repaidAmount: number;
    remainingBalance: number; monthlyInstallment: number | null; reason: string | null;
    status: string; requestedAt: string; approvedAt: string | null; rejectionReason: string | null;
  }[];
  transactions: {
    id: string; advanceId: string; type: string; amount: number; transactionDate: string; notes: string | null;
  }[];
};

type AwardRow = {
  id: string; title: string; category: string; monetaryReward: number; giftDescription: string | null;
  awardDate: string; summary: string | null; presentedBy: string | null; status: string;
};

type DocumentRow = {
  id: string; documentType: string; originalName: string; mimeType: string; fileSize: number;
  issuedAt: string | null; expiryDate: string | null; visibility: string; createdAt: string;
};

type ProfileRequestRow = {
  id: string; requestType: string; proposedChanges: Record<string, string>; reason: string | null;
  status: string; reauthenticatedAt: string; reviewedAt: string | null; rejectionReason: string | null; createdAt: string;
};

type SectionKey = 'home' | 'profile' | 'leave' | 'advances' | 'time' | 'payroll' | 'awards' | 'documents' | 'requests';

async function fetchJson<T>(url: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { credentials: 'include' });
    const json = await res.json().catch(() => ({}));
    return { ...json, status: res.status } as ApiResult<T> & { status: number };
  } catch {
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Impossible de joindre le serveur.' } };
  }
}

function money(n: string | number): string {
  return `${Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DH`;
}

function monthLabel(year: number | null, month: number | null): string {
  return `${MONTHS_FR[(month ?? 1) - 1] ?? ''} ${year ?? ''}`.trim();
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR');
}

function statusBadge(status: string): React.ReactNode {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'En attente', cls: 'bg-amber-100 text-amber-700' },
    approved: { label: 'Approuvée', cls: 'bg-[#DDF5EC] text-[#17A673]' },
    granted: { label: 'Accordé', cls: 'bg-[#DDF5EC] text-[#17A673]' },
    rejected: { label: 'Refusée', cls: 'bg-rose-100 text-rose-600' },
    cancelled: { label: 'Annulée', cls: 'bg-slate-100 text-slate-500' },
    fully_repaid: { label: 'Remboursé', cls: 'bg-emerald-100 text-emerald-700' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <Badge className={`border-none text-[9px] font-bold ${s.cls}`}>{s.label}</Badge>;
}

const NAV: { key: SectionKey; label: string }[] = [
  { key: 'home', label: 'Accueil' },
  { key: 'profile', label: 'Mon profil' },
  { key: 'leave', label: 'Congés' },
  { key: 'advances', label: 'Avances sur salaire' },
  { key: 'time', label: 'Pointage' },
  { key: 'payroll', label: 'Fiches de paie' },
  { key: 'awards', label: 'Distinctions' },
  { key: 'documents', label: 'Documents' },
  { key: 'requests', label: 'Mes demandes' },
];

export function EmployeePortalView() {
  const [status, setStatus] = useState<'loading' | 'notEmployee' | 'error' | 'ready'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [section, setSection] = useState<SectionKey>('home');
  const [home, setHome] = useState<HomeData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [leave, setLeave] = useState<LeaveRow[]>([]);
  const [time, setTime] = useState<TimeData | null>(null);
  const [payroll, setPayroll] = useState<PayrollData | null>(null);
  const [advances, setAdvances] = useState<AdvanceData | null>(null);
  const [awards, setAwards] = useState<AwardRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [requests, setRequests] = useState<ProfileRequestRow[]>([]);

  const loadAll = useCallback(async () => {
    setStatus('loading');
    const [h, p, l, t, pay, adv, aw, doc, req] = await Promise.all([
      fetchJson<HomeData>('/api/employee/me/home'),
      fetchJson<ProfileData>('/api/employee/me/profile'),
      fetchJson<LeaveRow[]>('/api/employee/me/leave'),
      fetchJson<TimeData>('/api/employee/me/time'),
      fetchJson<PayrollData>('/api/employee/me/payroll'),
      fetchJson<AdvanceData>('/api/employee/me/advances'),
      fetchJson<AwardRow[]>('/api/employee/me/awards'),
      fetchJson<DocumentRow[]>('/api/employee/me/documents'),
      fetchJson<ProfileRequestRow[]>('/api/employee/me/requests'),
    ]);

    const anyErr = [h, p, l, t, pay].find(r => !r.success);
    if (anyErr?.error?.code === 'NOT_AN_EMPLOYEE' || (anyErr as ApiResult<unknown> & { status?: number })?.status === 403) {
      setStatus('notEmployee');
      return;
    }
    if (anyErr) {
      setStatus('error');
      setErrorMsg(anyErr.error?.message ?? 'Une erreur est survenue.');
      return;
    }
    setHome(h.data ?? null);
    setProfile(p.data ?? null);
    setLeave(l.data ?? []);
    setTime(t.data ?? null);
    setPayroll(pay.data ?? null);
    setAdvances(adv.data ?? null);
    setAwards(aw.data ?? []);
    setDocuments(doc.data ?? []);
    setRequests(req.data ?? []);
    setStatus('ready');
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const refreshLeave = useCallback(async () => {
    const r = await fetchJson<LeaveRow[]>('/api/employee/me/leave');
    if (r.success) setLeave(r.data ?? []);
  }, []);

  const refreshAdvances = useCallback(async () => {
    const r = await fetchJson<AdvanceData>('/api/employee/me/advances');
    if (r.success) setAdvances(r.data ?? null);
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement de votre espace employé…
      </div>
    );
  }

  if (status === 'notEmployee') {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-extrabold text-[#16212B]">Accès réservé aux employés</h1>
          <p className="text-xs text-slate-500">
            Aucun profil employé n'est associé à ce compte. Contactez votre administration pour activer l'accès à cet espace.
          </p>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="text-lg font-extrabold text-[#16212B]">Impossible de charger l'espace employé</h1>
          <p className="text-xs text-slate-500">{errorMsg}</p>
          <Button onClick={loadAll} className="mx-auto">Réessayer</Button>
        </Card>
      </div>
    );
  }

  const pendingCount = leave.filter(r => r.status === 'pending').length + (requests.filter(r => r.status === 'pending').length);
  const isClockedIn = time?.openSession != null;

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Portail employé</h1>
          <p className="text-xs text-slate-500 mt-1">Gérez votre profil, vos congés, vos avances, votre pointage et vos fiches de paie.</p>
        </div>
        <Button onClick={loadAll} variant="outline" size="sm" className="h-8 text-xs font-bold border-slate-200 text-[#2487B8]">
          Actualiser
        </Button>
      </div>

      {/* KPI banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center">
          <span className="text-[9px] font-bold text-slate-400 uppercase block">Solde de congés</span>
          <span className="text-lg font-extrabold text-[#16212B]">{home?.totalRemaining ?? 0} jours</span>
          <span className="text-[9px] font-semibold text-slate-500 block">Disponibles ({home?.leaveBalances.length ?? 0} catégorie(s))</span>
        </Card>
        <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center">
          <span className="text-[9px] font-bold text-slate-400 uppercase block">Dernière fiche de paie</span>
          <span className="text-sm font-extrabold text-[#16212B]">{home?.latestPayslip ? money(home.latestPayslip.netSalary) : '—'}</span>
          <span className="text-[9px] font-semibold text-slate-500 block">{home?.latestPayslip ? monthLabel(home.latestPayslip.year, home.latestPayslip.month) : 'Aucune fiche émise'}</span>
        </Card>
        <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center">
          <span className="text-[9px] font-bold text-slate-400 uppercase block">État de pointage</span>
          <span className={`text-lg font-extrabold ${isClockedIn ? 'text-[#17A673]' : 'text-slate-400'}`}>{isClockedIn ? 'En service' : 'Hors service'}</span>
          <span className="text-[9px] font-semibold text-slate-500 block">{isClockedIn ? formatDate(time?.openSession?.in ?? null) : 'Dernier pointage —'}</span>
        </Card>
        <Card className="p-3 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center">
          <span className="text-[9px] font-bold text-slate-400 uppercase block">Demandes en attente</span>
          <span className="text-lg font-extrabold text-amber-700">{pendingCount}</span>
          <span className="text-[9px] font-semibold text-slate-500 block">Congés & modifications</span>
        </Card>
      </div>

      {/* Section nav */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {NAV.map(n => (
          <button
            key={n.key}
            onClick={() => setSection(n.key)}
            className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-colors cursor-pointer ${section === n.key ? 'bg-[#2487B8] text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            {n.label}
          </button>
        ))}
      </div>

      {section === 'home' && <HomeSection home={home} leave={leave} />}
      {section === 'profile' && <ProfileSection profile={profile} onSaved={loadAll} />}
      {section === 'leave' && <LeaveSection balances={home?.leaveBalances ?? []} rows={leave} onChanged={refreshLeave} />}
      {section === 'advances' && <AdvancesSection data={advances} onChanged={refreshAdvances} />}
      {section === 'time' && <TimeSection time={time} />}
      {section === 'payroll' && <PayrollSection payroll={payroll} />}
      {section === 'awards' && <AwardsSection awards={awards} />}
      {section === 'documents' && <DocumentsSection docs={documents} />}
      {section === 'requests' && <RequestsSection requests={requests} />}
    </div>
  );
}

function HomeSection({ home, leave }: { home: HomeData | null; leave: LeaveRow[] }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <div className="xl:col-span-5 space-y-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-[#16212B]">Solde de congés</h2>
            <Calendar className="w-4 h-4 text-[#2487B8]" />
          </div>
          {home && home.leaveBalances.length > 0 ? (
            <div className="space-y-2">
              {home.leaveBalances.map(b => (
                <div key={b.categoryId} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[#16212B] text-[11px]">{b.categoryName}</p>
                    <p className="text-[10px] text-slate-400">Acquis {b.accruedDays} · Pris {b.usedDays}</p>
                  </div>
                  <span className="font-mono font-extrabold text-[#2487B8] text-[11px]">{b.remainingDays} j</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 py-2">Aucun solde de congé configuré pour cette année.</p>
          )}
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-[#16212B]">Dernières demandes</h2>
            <FileText className="w-4 h-4 text-[#2487B8]" />
          </div>
          {leave.length > 0 ? (
            <div className="space-y-2">
              {leave.slice(0, 4).map(r => (
                <div key={r.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[#16212B] text-[11px]">{r.categoryName}</p>
                    <p className="text-[10px] text-slate-400">{formatDate(r.startDate)} → {formatDate(r.endDate)} ({r.daysRequested} j)</p>
                  </div>
                  {statusBadge(r.status)}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 py-2">Aucune demande de congé.</p>
          )}
        </Card>
      </div>

      <div className="xl:col-span-7 space-y-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-[#16212B]">Cours du jour</h2>
            <Clock className="w-4 h-4 text-[#2487B8]" />
          </div>
          {home && home.todaySchedule.length > 0 ? (
            <div className="space-y-2">
              {home.todaySchedule.map((s, i) => (
                <div key={i} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-[#2487B8] text-[10px] bg-[#DCEBF4] px-1.5 py-0.5 rounded">{s.startTime}–{s.endTime}</span>
                    <div>
                      <p className="font-bold text-[#16212B] text-[11px]">{s.subjectName}</p>
                      <p className="text-[10px] text-slate-500">{s.className} — {s.sectionName}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400">{s.roomLabel ?? '—'}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 py-2">Aucun cours prévu aujourd'hui.</p>
          )}
        </Card>

        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-[#16212B]">Dernière fiche de paie</h2>
            <DollarSign className="w-4 h-4 text-[#2487B8]" />
          </div>
          {home?.latestPayslip ? (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <p className="font-bold text-[#16212B] text-[11px]">{monthLabel(home.latestPayslip.year, home.latestPayslip.month)}</p>
                <p className="text-[10px] text-slate-400">Émise le {formatDate(home.latestPayslip.issuedAt)}</p>
              </div>
              <span className="font-mono font-extrabold text-[#16212B] text-[11px]">{money(home.latestPayslip.netSalary)}</span>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 py-2">Aucune fiche de paie publiée.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function ProfileSection({ profile, onSaved }: { profile: ProfileData | null; onSaved: () => void }) {
  const [firstName, setFirstName] = useState(profile?.user?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.user?.lastName ?? '');
  const [phone, setPhone] = useState(profile?.user?.phone ?? '');
  const [address, setAddress] = useState(profile?.user?.address ?? '');
  const [dependantsCount, setDependantsCount] = useState(profile?.employee?.dependantsCount ?? 0);

  const [rib, setRib] = useState(profile?.employee?.bankRib ?? '');
  const [cnss, setCnss] = useState(profile?.employee?.cnssNumber ?? '');
  const [amo, setAmo] = useState(profile?.employee?.amoNumber ?? '');
  const [ribPassword, setRibPassword] = useState('');
  const [ribOpen, setRibOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  if (!profile) return null;

  const saveProfile = async () => {
    setSaving(true);
    setMsg(null);
    const res = await fetch('/api/employee/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, phone, address, dependantsCount }),
    });
    const json = await res.json().catch(() => ({ success: false }));
    setSaving(false);
    if (json.success) {
      setMsg({ ok: true, text: 'Profil mis à jour.' });
      onSaved();
    } else {
      setMsg({ ok: false, text: json.error?.message ?? 'Échec de la mise à jour.' });
    }
  };

  const saveSensitive = async () => {
    setSaving(true);
    setMsg(null);
    const res = await fetch('/api/employee/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankRib: rib, cnssNumber: cnss, amoNumber: amo, currentPassword: ribPassword }),
    });
    const json = await res.json().catch(() => ({ success: false }));
    setSaving(false);
    if (json.success) {
      setMsg({ ok: true, text: json.data?.pendingApproval ? 'Demande de modification envoyée aux RH pour validation.' : 'Coordonnées bancaires mises à jour.' });
      setRibOpen(false);
      setRibPassword('');
      onSaved();
    } else {
      setMsg({ ok: false, text: json.error?.message ?? 'Échec de la demande.' });
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <Card className="xl:col-span-7 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-[#16212B]">Mes informations</h2>
          <User className="w-4 h-4 text-[#2487B8]" />
        </div>
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div><span className="text-[10px] font-bold text-slate-400 uppercase block">Nom complet</span><span className="font-bold text-[#16212B]">{profile.user?.name ?? '—'}</span></div>
          <div><span className="text-[10px] font-bold text-slate-400 uppercase block">Email</span><span className="font-bold text-[#16212B]">{profile.employee.email}</span></div>
          <div><span className="text-[10px] font-bold text-slate-400 uppercase block">Rôle</span><span className="font-bold text-[#16212B]">{profile.employee.role}</span></div>
          <div><span className="text-[10px] font-bold text-slate-400 uppercase block">Type de contrat</span><span className="font-bold text-[#16212B] uppercase">{profile.employee.contractType}</span></div>
        </div>

        <div className="pt-2 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Prénom" value={firstName} onChange={setFirstName} />
            <Field label="Nom" value={lastName} onChange={setLastName} />
          </div>
          <Field label="Téléphone" value={phone} onChange={setPhone} />
          <Field label="Adresse" value={address} onChange={setAddress} />
          <label className="block text-[10px] font-bold text-slate-400 uppercase">Nombre de personnes à charge</label>
          <input
            type="number" min={0} max={20}
            value={dependantsCount}
            onChange={e => setDependantsCount(Math.max(0, Math.min(20, Number(e.target.value))))}
            className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#16212B] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/30"
          />
          {msg && <p className={`text-[11px] font-bold ${msg.ok ? 'text-[#17A673]' : 'text-rose-600'}`}>{msg.text}</p>}
          <Button onClick={saveProfile} disabled={saving} className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs px-4 cursor-pointer">
            {saving ? 'Enregistrement…' : 'Enregistrer mes informations'}
          </Button>
        </div>
      </Card>

      <Card className="xl:col-span-5 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-[#16212B]">Données bancaires et sociales</h2>
          <ShieldAlert className="w-4 h-4 text-amber-500" />
        </div>
        <p className="text-[10px] text-slate-400">La modification du RIB, CNSS ou AMO exige une re-authentification par mot de passe et une approbation RH.</p>
        {!ribOpen ? (
          <div className="space-y-2">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2 text-xs">
              <div><span className="text-[10px] font-bold text-slate-400 uppercase block">RIB</span><span className="font-mono font-extrabold text-[#16212B]">{profile.employee.bankRib ?? 'Non renseigné'}</span></div>
              <div><span className="text-[10px] font-bold text-slate-400 uppercase block">N° CNSS</span><span className="font-extrabold text-[#16212B]">{profile.employee.cnssNumber ?? 'Non renseigné'}</span></div>
              <div><span className="text-[10px] font-bold text-slate-400 uppercase block">N° AMO</span><span className="font-extrabold text-[#16212B]">{profile.employee.amoNumber ?? 'Non renseigné'}</span></div>
            </div>
            <Button onClick={() => setRibOpen(true)} variant="outline" className="w-full h-8 text-xs font-bold rounded-xl border-slate-200 text-[#2487B8]">
              Proposer une modification
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Field label="Nouveau RIB" value={rib} onChange={setRib} />
            <Field label="N° CNSS" value={cnss} onChange={setCnss} />
            <Field label="N° AMO" value={amo} onChange={setAmo} />
            <Field label="Mot de passe (confirmation)" value={ribPassword} onChange={setRibPassword} type="password" />
            <div className="flex gap-2">
              <Button onClick={saveSensitive} disabled={saving || !ribPassword} className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs px-4 cursor-pointer">
                Soumettre aux RH
              </Button>
              <Button onClick={() => { setRibOpen(false); setRibPassword(''); }} variant="outline" className="h-8 text-xs font-bold rounded-xl border-slate-200 text-slate-500">
                Annuler
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block text-[10px] font-bold text-slate-400 uppercase">{label}
      <input
        type={type} value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-1 w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-[#16212B] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/30"
      />
    </label>
  );
}

function LeaveSection({ balances, rows, onChanged }: { balances: HomeData['leaveBalances']; rows: LeaveRow[]; onChanged: () => void }) {
  const [categoryId, setCategoryId] = useState(balances[0]?.categoryId ?? '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/employee/me/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId, startDate, endDate, reason }),
    });
    const json = await res.json().catch(() => ({ success: false }));
    setBusy(false);
    if (json.success) {
      setMsg({ ok: true, text: 'Demande de congé envoyée.' });
      setStartDate(''); setEndDate(''); setReason('');
      onChanged();
    } else {
      setMsg({ ok: false, text: json.error?.message ?? 'Échec de la demande.' });
    }
  };

  const cancel = async (id: string) => {
    await fetch(`/api/employee/me/leave/${id}/cancel`, { method: 'POST' });
    onChanged();
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <Card className="xl:col-span-4 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <h2 className="text-xs font-extrabold text-[#16212B]">Nouvelle demande</h2>
        {balances.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-2">Aucune catégorie de congé disponible.</p>
        ) : (
          <div className="space-y-3">
            <label className="block text-[10px] font-bold text-slate-400 uppercase">Catégorie
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="mt-1 w-full h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-[#16212B]">
                {balances.map(b => (
                  <option key={b.categoryId} value={b.categoryId}>{b.categoryName} — {b.remainingDays} j restants</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Début" value={startDate} onChange={setStartDate} />
              <Field label="Fin" value={endDate} onChange={setEndDate} />
            </div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase">Motif
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#16212B] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/30" />
            </label>
            {msg && <p className={`text-[11px] font-bold ${msg.ok ? 'text-[#17A673]' : 'text-rose-600'}`}>{msg.text}</p>}
            <Button onClick={submit} disabled={busy || !categoryId || !startDate || !endDate} className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs px-4 cursor-pointer">
              {busy ? 'Envoi…' : 'Envoyer la demande'}
            </Button>
          </div>
        )}
      </Card>

      <Card className="xl:col-span-8 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <h2 className="text-xs font-extrabold text-[#16212B]">Mes demandes ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-2">Aucune demande de congé.</p>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[#16212B] text-xs">{r.categoryName}</p>
                    {statusBadge(r.status)}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">{formatDate(r.startDate)} → {formatDate(r.endDate)} ({r.daysRequested} jour(s)){r.reason ? ` — ${r.reason}` : ''}</p>
                </div>
                {r.status === 'pending' && (
                  <Button onClick={() => cancel(r.id)} variant="outline" size="sm" className="h-7 px-2 text-[10px] font-bold rounded-lg border-slate-200 text-slate-500">
                    <Ban className="w-3 h-3" /> Annuler
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function AdvancesSection({ data, onChanged }: { data: AdvanceData | null; onChanged: () => void }) {
  const [requestedAmount, setRequestedAmount] = useState('');
  const [monthlyInstallment, setMonthlyInstallment] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submitAdvance = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/employee/me/advances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestedAmount: Number(requestedAmount),
        monthlyInstallment: monthlyInstallment ? Number(monthlyInstallment) : undefined,
        reason: reason || undefined,
      }),
    });
    const json = await res.json().catch(() => ({ success: false }));
    setBusy(false);
    if (json.success) {
      setMsg({ ok: true, text: 'Demande d\'avance enregistrée.' });
      setRequestedAmount(''); setMonthlyInstallment(''); setReason('');
      onChanged();
    } else {
      setMsg({ ok: false, text: json.error?.message ?? 'Échec de la demande d\'avance.' });
    }
  };

  const advances = data?.advances ?? [];
  const transactions = data?.transactions ?? [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <Card className="xl:col-span-4 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-[#16212B]">Demander une avance</h2>
          <PiggyBank className="w-4 h-4 text-[#2487B8]" />
        </div>
        <div className="space-y-3">
          <Field label="Montant souhaité (DH)" value={requestedAmount} onChange={setRequestedAmount} type="number" />
          <Field label="Mensualité souhaitée (DH)" value={monthlyInstallment} onChange={setMonthlyInstallment} type="number" />
          <label className="block text-[10px] font-bold text-slate-400 uppercase">Motif de l'avance
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#16212B] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/30" />
          </label>
          {msg && <p className={`text-[11px] font-bold ${msg.ok ? 'text-[#17A673]' : 'text-rose-600'}`}>{msg.text}</p>}
          <Button onClick={submitAdvance} disabled={busy || !requestedAmount} className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs px-4 cursor-pointer">
            {busy ? 'Envoi…' : 'Soumettre l\'avance'}
          </Button>
        </div>
      </Card>

      <div className="xl:col-span-8 space-y-4">
        <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <h2 className="text-xs font-extrabold text-[#16212B]">Mes demandes d'avances ({advances.length})</h2>
          {advances.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-2">Aucune avance enregistrée.</p>
          ) : (
            <div className="space-y-2">
              {advances.map(a => (
                <div key={a.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-[#16212B] text-xs">{money(a.requestedAmount)}</p>
                      {statusBadge(a.status)}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Demande du {formatDate(a.requestedAt)}{a.reason ? ` — ${a.reason}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-extrabold text-[#16212B] text-[11px] block">Reste: {money(a.remainingBalance)}</span>
                    <span className="text-[9px] text-slate-400">Remboursé {money(a.repaidAmount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {transactions.length > 0 && (
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <h2 className="text-xs font-extrabold text-[#16212B]">Historique des remboursements</h2>
            <div className="space-y-2">
              {transactions.map(t => (
                <div key={t.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#16212B] uppercase">{t.type}</span>
                    <span className="text-[10px] text-slate-400 block">{formatDate(t.transactionDate)}</span>
                  </div>
                  <span className="font-mono font-extrabold text-[#17A673]">{money(t.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function TimeSection({ time }: { time: TimeData | null }) {
  if (!time) return null;
  const h = Math.floor(time.todayTotalMinutes / 60);
  const m = time.todayTotalMinutes % 60;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <Card className="xl:col-span-5 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <h2 className="text-xs font-extrabold text-[#16212B]">Aujourd'hui</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
            <span className="text-[9px] font-bold text-slate-400 uppercase block">Total travaillé</span>
            <span className="text-lg font-extrabold text-[#16212B]">{h}h{m.toString().padStart(2, '0')}</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
            <span className="text-[9px] font-bold text-slate-400 uppercase block">Statut</span>
            <span className={`text-lg font-extrabold ${time.openSession ? 'text-[#17A673]' : 'text-slate-400'}`}>
              {time.openSession ? 'En service' : 'Hors service'}
            </span>
          </div>
        </div>
        {time.openSession && (
          <div className="p-2.5 bg-[#DDF5EC] rounded-xl border border-emerald-100 flex items-center gap-2">
            <LogIn className="w-3.5 h-3.5 text-[#17A673]" />
            <p className="text-[11px] font-bold text-[#17A673]">Pointage d'entrée ouvert à {time.openSession.in.slice(11, 16)}</p>
          </div>
        )}
        <h2 className="text-xs font-extrabold text-[#16212B] pt-2">Sessions de travail ({time.sessions.length})</h2>
        {time.sessions.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-2">Aucune session complète.</p>
        ) : (
          <div className="space-y-2">
            {time.sessions.slice(0, 8).map((s, i) => (
              <div key={i} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#16212B]">{s.in.slice(0, 10)} · {s.in.slice(11, 16)} → {s.out.slice(11, 16)}</span>
                <span className="font-mono text-[11px] font-extrabold text-[#2487B8]">{Math.floor(s.durationMinutes / 60)}h{(s.durationMinutes % 60).toString().padStart(2, '0')}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="xl:col-span-7 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <h2 className="text-xs font-extrabold text-[#16212B]">Historique des pointages ({time.punches.length})</h2>
        {time.punches.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-2">Aucun pointage enregistré.</p>
        ) : (
          <div className="space-y-1.5">
            {time.punches.slice(0, 20).map(p => (
              <div key={p.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold ${p.punchType === 'in' ? 'text-[#17A673]' : 'text-rose-500'}`}>
                  {p.punchType === 'in' ? <LogIn className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                  {p.punchType === 'in' ? 'Entrée' : 'Sortie'}
                </span>
                <span className="text-[11px] font-bold text-[#16212B]">{formatDate(p.scannedAt)} à {p.scannedAt.slice(11, 16)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function PayrollSection({ payroll }: { payroll: PayrollData | null }) {
  if (!payroll) return null;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <Card className="xl:col-span-8 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-[#16212B]">Mes fiches de paie ({payroll.payslips.length})</h2>
          <FileText className="w-4 h-4 text-[#2487B8]" />
        </div>
        {payroll.payslips.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-2">Aucune fiche de paie publiée.</p>
        ) : (
          <div className="space-y-2">
            {payroll.payslips.map(ps => (
              <div key={ps.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#16212B] text-xs">{monthLabel(ps.year, ps.month)}</p>
                  <p className="text-[10px] text-slate-400">Émise le {formatDate(ps.issuedAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="font-mono font-extrabold text-[#16212B] text-[11px] block">{money(ps.netSalary)}</span>
                    <span className="text-[9px] text-slate-400 font-medium">Brut {money(ps.grossSalary)}</span>
                  </div>
                  <a href={`/api/employee/me/payroll/${ps.id}/download`} className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#2487B8] cursor-pointer" title="Télécharger">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="xl:col-span-4 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <h2 className="text-xs font-extrabold text-[#16212B]">Synthèse annuelle</h2>
        {payroll.annualSummaries.length === 0 ? (
          <p className="text-[11px] text-slate-400 py-2">Aucune donnée.</p>
        ) : (
          <div className="space-y-2">
            {payroll.annualSummaries.map(s => (
              <div key={s.year} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <div>
                  <p className="font-bold text-[#16212B] text-[11px]">Année {s.year}</p>
                  <p className="text-[10px] text-slate-400">{s.count} fiche(s)</p>
                </div>
                <span className="font-mono font-extrabold text-[#16212B] text-[11px]">{money(s.totalNet)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function AwardsSection({ awards }: { awards: AwardRow[] }) {
  return (
    <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-extrabold text-[#16212B]">Mes distinctions et récompenses ({awards.length})</h2>
        <Award className="w-4 h-4 text-amber-500" />
      </div>
      {awards.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-2">Aucune distinction attribuée pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {awards.map(a => (
            <div key={a.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-[#16212B] text-xs">{a.title}</p>
                  <Badge className="bg-amber-100 text-amber-700 text-[9px] font-bold border-none">{a.category}</Badge>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Décerné le {formatDate(a.awardDate)}{a.presentedBy ? ` par ${a.presentedBy}` : ''}</p>
                {a.summary && <p className="text-[10px] text-slate-600 mt-1">{a.summary}</p>}
              </div>
              {a.monetaryReward > 0 && (
                <span className="font-mono font-extrabold text-[#17A673] text-xs">{money(a.monetaryReward)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function DocumentsSection({ docs }: { docs: DocumentRow[] }) {
  return (
    <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-extrabold text-[#16212B]">Mes documents RH ({docs.length})</h2>
        <FolderDown className="w-4 h-4 text-[#2487B8]" />
      </div>
      {docs.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-2">Aucun document administratif disponible.</p>
      ) : (
        <div className="space-y-2">
          {docs.map(d => (
            <div key={d.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <p className="font-bold text-[#16212B] text-xs">{d.originalName}</p>
                <p className="text-[10px] text-slate-400">{d.documentType.toUpperCase()} · Déposé le {formatDate(d.createdAt)}</p>
              </div>
              <a href={`/api/employee/me/documents/${d.id}/download`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold text-[#2487B8] hover:bg-slate-100">
                <Download className="h-3.5 w-3.5" /> Télécharger
              </a>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function RequestsSection({ requests }: { requests: ProfileRequestRow[] }) {
  return (
    <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-extrabold text-[#16212B]">Historique des demandes de modification ({requests.length})</h2>
        <UserCheck className="w-4 h-4 text-[#2487B8]" />
      </div>
      {requests.length === 0 ? (
        <p className="text-[11px] text-slate-400 py-2">Aucune demande de modification enregistrée.</p>
      ) : (
        <div className="space-y-2">
          {requests.map(r => (
            <div key={r.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-[#16212B] text-xs">Demande #{r.id.slice(0, 8)}</p>
                  {statusBadge(r.status)}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Soumise le {formatDate(r.createdAt)} · Type: {r.requestType}</p>
                {r.rejectionReason && <p className="text-[10px] text-rose-600 font-bold mt-1">Refus: {r.rejectionReason}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
