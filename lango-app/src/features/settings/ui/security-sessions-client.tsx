// security-sessions-client.tsx
// CLIENT ISLAND — owns policy form state, active session revocation, and security alert actions
'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Shield, ShieldAlert, Monitor, Smartphone, Laptop, Trash2, CheckCircle2,
  AlertTriangle, Lock, Download, Save, RefreshCw, Key, ShieldCheck, Globe,
  ArrowRight, Check, X, HardDrive
} from 'lucide-react';
import { PASSWORD_COMPLEXITY_OPTIONS, SESSION_TIMEOUT_OPTIONS } from '@/features/settings/data/security-config';

export type SessionItem = {
  id: string;
  userName: string;
  userRole: string;
  device: string;
  type: 'desktop' | 'mobile';
  ip: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
};

export type AuditItem = {
  id: string;
  action: string;
  entityType: string;
  actorId: string | null;
  createdAt: string | null;
};

export type TrustedDeviceItem = {
  id: string;
  name: string;
  owner: string;
  os: string;
  location: string;
  verifiedAt: string;
  isCurrent: boolean;
};

export type SecurityAlertItem = {
  id: string;
  severity: 'critical' | 'warning';
  title: string;
  description: string;
  timestamp: string;
  actionLabel: string;
  actionHref: string;
};

export type Role2faItem = {
  roleKey: string;
  roleLabel: string;
  totalCount: number;
  tfaCount: number;
  percentage: number;
  badgeColor: string;
};

type Props = {
  initialSessions: SessionItem[];
  initialAudits: AuditItem[];
  initialSettings: {
    twoFaRequired: boolean;
    requireAdmin2fa: boolean;
    passwordPolicy: string;
    sessionTimeout: string;
    ipRestriction: boolean;
    allowedIps: string;
    loginAlerts: boolean;
  };
  initialTrustedDevices: TrustedDeviceItem[];
  initialAlerts: SecurityAlertItem[];
  initial2faAdoption: Role2faItem[];
  initialDismissedAlertIds: string[];
  globalTfaPercentage: number;
};

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent
        transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4B6BFB]/30
        ${checked ? 'bg-[#4B6BFB]' : 'bg-[#D1D5DB]'}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm
          transform transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
      />
      <span className="sr-only">{label}</span>
    </button>
  );
}

export function SecuritySessionsClient({
  initialSessions,
  initialAudits,
  initialSettings,
  initialTrustedDevices,
  initialAlerts,
  initial2faAdoption,
  initialDismissedAlertIds,
  globalTfaPercentage,
}: Props) {
  const [policyForm, setPolicyForm] = useState(initialSettings);
  const [requireAdmin2fa, setRequireAdmin2fa] = useState(initialSettings.requireAdmin2fa);
  const [sessions, setSessions] = useState<SessionItem[]>(initialSessions);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDeviceItem[]>(initialTrustedDevices);
  const [alerts, setAlerts] = useState<SecurityAlertItem[]>(initialAlerts);
  const [dismissedIds, setDismissedIds] = useState<string[]>(initialDismissedAlertIds);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isPending, startTransition] = useTransition();

  // Real per-tenant 2FA enforcement toggle, persisted immediately to the
  // registry key that the dashboard layout reads (plan #3). The legacy
  // `twoFaRequired` toggle above is cosmetic and stored in the `security`
  // JSON blob; this one actually gates admin access.
  async function handleToggleRequireAdmin2fa(next: boolean) {
    setRequireAdmin2fa(next);
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/settings/values/security.requireTwoFactorForAdmins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: next, reason: '2FA enforcement toggle' }),
      });
      if (!res.ok) throw new Error('Failed to save 2FA enforcement policy');
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setRequireAdmin2fa(!next);
      setSaveStatus('error');
    }
  }

  async function handleRevokeSession(id: string) {
    try {
      const res = await fetch(`/api/security/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok) return;
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Failed to revoke session:', err);
    }
  }

  async function handleRevokeAllOtherSessions() {
    const others = sessions.filter(s => !s.isCurrent);
    await Promise.all(
      others.map(s => fetch(`/api/security/sessions/${s.id}`, { method: 'DELETE' })),
    );
    setSessions(prev => prev.filter(s => s.isCurrent));
  }

  async function handleRemoveTrustedDevice(id: string) {
    // Trusted-device rows carry the real session id after the `dev-` prefix; a
    // revocation must actually delete that session server-side, not just hide it.
    try {
      const res = await fetch(`/api/security/sessions/${id.replace(/^dev-/, '')}`, { method: 'DELETE' });
      if (!res.ok) return;
    } catch {
      return;
    }
    setTrustedDevices(prev => prev.filter(d => d.id !== id));
  }

  async function handleDismissAlert(id: string) {
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    setAlerts(prev => prev.filter(a => a.id !== id));
    try {
      await fetch('/api/settings/values/security.dismissedAlerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: next }),
      });
    } catch (err) {
      console.error('Failed to persist dismissed alert:', err);
    }
  }

  async function handleApplyPolicies() {
    startTransition(async () => {
      setSaveStatus('idle');
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            security: {
              twoFaRequired: policyForm.twoFaRequired,
              passwordPolicy: policyForm.passwordPolicy,
              sessionTimeout: policyForm.sessionTimeout,
              ipRestriction: policyForm.ipRestriction,
              allowedIps: policyForm.allowedIps,
              loginAlerts: policyForm.loginAlerts,
            },
          }),
        });
        if (!res.ok) throw new Error('Failed to save security settings');
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (err) {
        console.error(err);
        setSaveStatus('error');
      }
    });
  }

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-6 pb-20">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Sécurité, Sessions &amp; Authentification 2FA</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Politiques de mot de passe, suivi de l'adoption 2FA et contrôle des appareils connectés.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/api/audit-logs/export"
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#374151]
              bg-white border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-colors"
          >
            <Download className="w-4 h-4 text-[#6B7280]" />
            Exporter le journal
          </Link>
          <button
            id="apply-policies-btn"
            onClick={handleApplyPolicies}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white
              bg-[#4B6BFB] rounded-xl hover:bg-[#3B5BDB] disabled:opacity-60 transition-all shadow-sm shadow-[#4B6BFB]/20"
          >
            <Save className="w-4 h-4" />
            {isPending ? 'Application...' : 'Appliquer les politiques'}
          </button>
        </div>
      </div>

      {/* ── Feedback Banner ── */}
      {saveStatus === 'success' && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Politiques de sécurité enregistrées et appliquées avec succès.
        </div>
      )}

      {/* ── 4 Stat Cards Band ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Taux 2FA Global</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-[#111827]">{globalTfaPercentage}%</p>
            </div>
            <div className="w-32 bg-[#F3F4F6] rounded-full h-1.5 overflow-hidden mt-1">
              <div className="bg-[#4B6BFB] h-full rounded-full" style={{ width: `${globalTfaPercentage}%` }} />
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F0F4FF] text-[#4B6BFB] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Sessions actives</p>
            <p className="text-2xl font-bold text-[#111827]">{sessions.length}</p>
            <p className="text-[11px] font-semibold text-[#4B6BFB]">Sur tous les appareils</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#F0F4FF] text-[#4B6BFB] flex items-center justify-center">
            <Monitor className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Appareils actifs</p>
            <p className="text-2xl font-bold text-[#111827]">{trustedDevices.length}</p>
            <p className="text-[11px] font-semibold text-emerald-600">Sessions actives par appareil</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] flex items-center justify-between shadow-2xs">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">Alertes de sécurité</p>
            <p className="text-2xl font-bold text-[#111827]">{alerts.length}</p>
            <p className="text-[11px] font-semibold text-amber-600">En cours d'analyse</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Shield Recommendation Banner ── */}
      <div className="flex items-center justify-between p-4 bg-[#F0F4FF] border border-[#C7D2FE] rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#4B6BFB] text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#111827]">
              Recommandation de sécurité : Activer l'obligation 2FA pour tous les comptes d'administration et de gestion financière
            </p>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Conformément aux normes de protection des données, tous les accès à privilèges doivent utiliser un TOTP ou un Passkey.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPolicyForm(prev => ({ ...prev, twoFaRequired: true }))}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white
            bg-[#4B6BFB] rounded-lg hover:bg-[#3B5BDB] transition-colors whitespace-nowrap"
        >
          Activer maintenant
        </button>
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left Column (2 Cols): Policies & 2FA Adoption & Trusted Hardware ── */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Section 1: Politiques de Sécurité */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-2xs">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-[#F3F4F6]">
              <div className="w-8 h-8 rounded-lg bg-[#F0F4FF] flex items-center justify-center">
                <Lock className="w-4 h-4 text-[#4B6BFB]" />
              </div>
              <h2 className="text-sm font-semibold text-[#111827]">Politiques de Sécurité Générales</h2>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#374151]">Exigence de complexité du mot de passe</label>
                  <select
                    value={policyForm.passwordPolicy}
                    onChange={e => setPolicyForm(prev => ({ ...prev, passwordPolicy: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E5E7EB] rounded-xl text-[#111827] focus:outline-none"
                  >
                    {PASSWORD_COMPLEXITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-[#374151]">Délai d'expiration de session</label>
                  <select
                    value={policyForm.sessionTimeout}
                    onChange={e => setPolicyForm(prev => ({ ...prev, sessionTimeout: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E5E7EB] rounded-xl text-[#111827] focus:outline-none"
                  >
                    {SESSION_TIMEOUT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-[#F3F4F6]">
                <div className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-[#F9FAFB]">
                  <div>
                    <p className="text-xs font-semibold text-[#111827]">Exiger la 2FA pour tous les rôles administratifs</p>
                    <p className="text-[11px] text-[#6B7280]">Oblige les administrateurs et comptables à enregistrer une clé 2FA</p>
                  </div>
                  <Toggle
                    checked={policyForm.twoFaRequired}
                    onChange={v => setPolicyForm(prev => ({ ...prev, twoFaRequired: v }))}
                    label="2FA obligatoire"
                  />
                </div>

                <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-[#F0F4FF]/60 hover:bg-[#F0F4FF]">
                  <div>
                    <p className="text-xs font-semibold text-[#111827]">Obliger la 2FA pour les comptes d'administration (school_admin)</p>
                    <p className="text-[11px] text-[#6B7280]">
                      Appliqué immédiatement : les administrateurs sans 2FA devront l'activer avant d'accéder au tableau de bord. Les super-admins sont toujours soumis à l'obligation.
                    </p>
                  </div>
                  <Toggle
                    checked={requireAdmin2fa}
                    onChange={handleToggleRequireAdmin2fa}
                    label="Obligation 2FA administrateurs"
                  />
                </div>

                <div className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-[#F9FAFB]">
                  <div>
                    <p className="text-xs font-semibold text-[#111827]">Alertes automatiques sur anomalies de connexion</p>
                    <p className="text-[11px] text-[#6B7280]">Notifie les administrateurs en cas de tentative d'accès suspecte</p>
                  </div>
                  <Toggle
                    checked={policyForm.loginAlerts}
                    onChange={v => setPolicyForm(prev => ({ ...prev, loginAlerts: v }))}
                    label="Alertes anomalies"
                  />
                </div>

                <div className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-[#F9FAFB]">
                  <div>
                    <p className="text-xs font-semibold text-[#111827]">Restriction par adresse IP de l'établissement</p>
                    <p className="text-[11px] text-[#6B7280]">Limite l'accès à l'administration aux seules adresses autorisées</p>
                  </div>
                  <Toggle
                    checked={policyForm.ipRestriction}
                    onChange={v => setPolicyForm(prev => ({ ...prev, ipRestriction: v }))}
                    label="Restriction IP"
                  />
                </div>

                {policyForm.ipRestriction && (
                  <div className="flex flex-col gap-1.5 pl-3">
                    <label className="text-xs font-medium text-[#374151]">Liste blanche IP (séparées par une virgule)</label>
                    <input
                      type="text"
                      value={policyForm.allowedIps}
                      onChange={e => setPolicyForm(prev => ({ ...prev, allowedIps: e.target.value }))}
                      placeholder="196.202.12.0/24, 41.248.77.12"
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-[#E5E7EB] rounded-xl text-[#111827] outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Inscription à la 2FA par Rôle */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#111827]">Taux d'Adoption 2FA par Rôle</h3>
                <p className="text-xs text-[#6B7280] mt-0.5">Pourcentage des comptes ayant activé la double authentification</p>
              </div>
              <span className="text-xs font-semibold text-[#4B6BFB] bg-[#F0F4FF] px-2.5 py-1 rounded-full">
                {globalTfaPercentage}% Global
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {initial2faAdoption.map(item => (
                <div key={item.roleKey} className="p-4 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#111827]">{item.roleLabel}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor}`}>
                      {item.tfaCount} / {item.totalCount} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#E5E7EB] rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#4B6BFB] h-full rounded-full transition-all duration-500"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Appareils Fiables */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#111827]">Appareils actifs récents</h3>
                <p className="text-xs text-[#6B7280] mt-0.5">Périphériques avec des sessions actives récentes</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {trustedDevices.map(dev => (
                <div key={dev.id} className="p-4 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Actif
                      </span>
                      {dev.isCurrent && <span className="text-[10px] text-[#4B6BFB] font-bold">Cet appareil</span>}
                    </div>
                    <h4 className="text-xs font-bold text-[#111827]">{dev.name}</h4>
                    <p className="text-[11px] text-[#6B7280] mt-0.5">{dev.owner} · {dev.os}</p>
                    <p className="text-[10px] text-[#9CA3AF] mt-1 font-mono">Première activité : {dev.verifiedAt}</p>
                  </div>
                  {!dev.isCurrent && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTrustedDevice(dev.id)}
                      className="text-left text-xs text-rose-600 hover:underline font-medium pt-2 border-t border-[#E5E7EB]"
                    >
                      Révoquer la session
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Right Column (1 Col): Alerts, Sessions Table, Audit Trail ── */}
        <div className="flex flex-col gap-6">

          {/* Alertes de Sécurité Card */}
          <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-[#111827]">Alertes de Sécurité Actives</h3>
              </div>
              <span className="text-xs text-[#9CA3AF]">{alerts.length} alerte(s)</span>
            </div>

            <div className="space-y-3">
              {alerts.map(alt => (
                <div
                  key={alt.id}
                  className={`p-3.5 rounded-xl border space-y-2 ${
                    alt.severity === 'critical'
                      ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                      : 'bg-amber-50/70 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{alt.title}</span>
                    </div>
                    <button onClick={() => handleDismissAlert(alt.id)} className="text-[#9CA3AF] hover:text-[#111827]">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-[#374151]">{alt.description}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-[#9CA3AF]">{alt.timestamp}</span>
                    <Link href={alt.actionHref} className="text-xs font-semibold text-[#4B6BFB] hover:underline">
                      {alt.actionLabel} &rarr;
                    </Link>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <p className="text-xs text-emerald-600 font-medium py-2 text-center">
                  Aucune alerte de sécurité active.
                </p>
              )}
            </div>
          </div>

          {/* Sessions Actives Card */}
          <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-[#4B6BFB]" />
                <h3 className="text-sm font-semibold text-[#111827]">Sessions Actives</h3>
              </div>
              <button
                type="button"
                onClick={handleRevokeAllOtherSessions}
                className="text-xs text-rose-600 hover:underline font-semibold"
              >
                Déconnecter tout
              </button>
            </div>

            <div className="space-y-3">
              {sessions.map(s => (
                <div key={s.id} className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    {s.type === 'mobile' ? <Smartphone className="w-4 h-4 text-[#6B7280]" /> : <Laptop className="w-4 h-4 text-[#6B7280]" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#111827]">{s.device}</span>
                        {s.isCurrent && (
                          <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded">Actuelle</span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#6B7280]">{s.userName} ({s.userRole})</p>
                      <p className="text-[10px] text-[#9CA3AF] font-mono">{s.ip} · {s.location} · {s.lastActive}</p>
                    </div>
                  </div>

                  {!s.isCurrent && (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(s.id)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Terminer cette session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Journal d'Audit Récent Card */}
          <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] space-y-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#4B6BFB]" />
                <h3 className="text-sm font-semibold text-[#111827]">Journal d'audit de sécurité</h3>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/fr/dashboard/settings/security/login-events" className="text-xs text-[#4B6BFB] font-medium hover:underline">
                  Journal de connexion
                </Link>
                <Link href="/fr/dashboard/settings/audit-logs" className="text-xs text-[#4B6BFB] font-medium hover:underline">
                  Voir tout
                </Link>
              </div>
            </div>

            <div className="space-y-3">
              {initialAudits.slice(0, 5).map(a => (
                <div key={a.id} className="flex items-start gap-2.5 text-xs">
                  <div className="w-2 h-2 rounded-full bg-[#4B6BFB] mt-1.5 shrink-0" />
                  <div>
                    <p className="text-[#111827] font-medium">
                      Action <span className="font-mono bg-[#F9FAFB] px-1 rounded text-[#4B6BFB]">{a.action}</span> sur {a.entityType}
                    </p>
                    <p className="text-[10px] text-[#9CA3AF]">{a.createdAt ? new Date(a.createdAt).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'Récemment'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
