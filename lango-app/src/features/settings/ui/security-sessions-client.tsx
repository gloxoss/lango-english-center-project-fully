// security-sessions-client.tsx
// CLIENT ISLAND: owns the admin 2FA enforcement toggle, session revocation and
// security alert actions.
'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  HardDrive,
  Info,
  Laptop,
  Lock,
  Monitor,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import React, { useState } from 'react';

export type SessionItem = {
  id: string;
  userName: string;
  userRole: string;
  browser: string | null;
  os: string | null;
  type: 'desktop' | 'mobile';
  ip: string;
  lastActiveAt: string | null;
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
  browser: string | null;
  os: string | null;
  owner: string;
  firstSeenAt: string | null;
  isCurrent: boolean;
};

export type SecurityAlertItem = {
  id: string;
  kind: 'locked' | 'failedLogins' | 'resets';
  severity: 'critical' | 'warning';
  count: number;
  actionHref: string;
};

export type Role2faItem = {
  roleKey: string;
  totalCount: number;
  tfaCount: number;
  percentage: number;
  badgeColor: string;
};

type Props = {
  initialSessions: SessionItem[];
  initialAudits: AuditItem[];
  initialRequireAdmin2fa: boolean;
  initialTrustedDevices: TrustedDeviceItem[];
  initialAlerts: SecurityAlertItem[];
  initial2faAdoption: Role2faItem[];
  initialDismissedAlertIds: string[];
  globalTfaPercentage: number;
  loadFailed: boolean;
};

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full
        border-2 border-transparent transition-colors
        focus:ring-2 focus:ring-[#4B6BFB]/30 focus:outline-none
        disabled:opacity-60
        ${checked ? 'bg-[#4B6BFB]' : 'bg-[#D1D5DB]'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block size-4 transform rounded-full
          bg-white shadow-sm transition-transform
          ${checked
      ? 'translate-x-4'
      : `translate-x-0`}
        `}
      />
      <span className="sr-only">{label}</span>
    </button>
  );
}

export function SecuritySessionsClient({
  initialSessions,
  initialAudits,
  initialRequireAdmin2fa,
  initialTrustedDevices,
  initialAlerts,
  initial2faAdoption,
  initialDismissedAlertIds,
  globalTfaPercentage,
  loadFailed,
}: Props) {
  const t = useTranslations('SecuritySessions');
  const tRoles = useTranslations('Roles');
  const locale = useLocale();
  const intlLocale = locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-FR';
  const [requireAdmin2fa, setRequireAdmin2fa] = useState(initialRequireAdmin2fa);
  const [saving2fa, setSaving2fa] = useState(false);
  const [sessions, setSessions] = useState<SessionItem[]>(initialSessions);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDeviceItem[]>(initialTrustedDevices);
  const [alerts, setAlerts] = useState<SecurityAlertItem[]>(initialAlerts);
  const [dismissedIds, setDismissedIds] = useState<string[]>(initialDismissedAlertIds);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const roleLabel = (role: string) => (tRoles.has(role) ? tRoles(role) : role);
  const deviceLabel = (browser: string | null, os: string | null) =>
    browser || os ? t('deviceOn', { browser: browser ?? t('browser'), os: os ?? '—' }) : t('unknownDevice');
  const relative = (iso: string | null) => {
    if (!iso) {
      return '';
    }
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) {
      return '';
    }
    const minutes = Math.round((then - Date.now()) / 60000);
    const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: 'auto' });
    if (Math.abs(minutes) < 60) {
      return rtf.format(minutes, 'minute');
    }
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) {
      return rtf.format(hours, 'hour');
    }
    return rtf.format(Math.round(hours / 24), 'day');
  };
  const flash = (kind: 'success' | 'error', text: string) => {
    setStatus({ kind, text });
    if (kind === 'success') {
      setTimeout(setStatus, 3000, null);
    }
  };

  // Persisted to the registry key that the dashboard layout reads; this really
  // gates admin access.
  async function handleToggleRequireAdmin2fa(next: boolean) {
    setRequireAdmin2fa(next);
    setSaving2fa(true);
    setStatus(null);
    try {
      const res = await fetch('/api/settings/values/security.requireTwoFactorForAdmins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: next, reason: '2FA enforcement toggle' }),
      });
      if (!res.ok) {
        throw new Error('save failed');
      }
      flash('success', next ? t('admin2faOn') : t('admin2faOff'));
    } catch {
      setRequireAdmin2fa(!next);
      flash('error', t('saveError'));
    } finally {
      setSaving2fa(false);
    }
  }

  async function revoke(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/security/sessions/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function handleRevokeSession(id: string) {
    if (await revoke(id)) {
      setSessions(prev => prev.filter(s => s.id !== id));
      setTrustedDevices(prev => prev.filter(d => d.id !== `dev-${id}`));
    } else {
      flash('error', t('revokeError'));
    }
  }

  // Used to hide every other session even when some DELETEs failed.
  async function handleRevokeAllOtherSessions() {
    const others = sessions.filter(s => !s.isCurrent);
    if (others.length === 0) {
      return;
    }
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('confirmRevokeAll', { count: others.length }))) {
      return;
    }
    const results = await Promise.all(others.map(async s => ({ id: s.id, ok: await revoke(s.id) })));
    const revoked = new Set(results.filter(r => r.ok).map(r => r.id));
    setSessions(prev => prev.filter(s => !revoked.has(s.id)));
    setTrustedDevices(prev => prev.filter(d => !revoked.has(d.id.replace(/^dev-/, ''))));
    const failed = results.length - revoked.size;
    if (failed > 0) {
      flash('error', t('revokeSomeFailed', { count: failed }));
    } else {
      flash('success', t('revokedAll', { count: revoked.size }));
    }
  }

  async function handleDismissAlert(id: string) {
    const next = [...dismissedIds, id];
    const previous = alerts;
    setDismissedIds(next);
    setAlerts(prev => prev.filter(a => a.id !== id));
    try {
      const res = await fetch('/api/settings/values/security.dismissedAlerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: next }),
      });
      if (!res.ok) {
        throw new Error('dismiss failed');
      }
    } catch {
      setDismissedIds(dismissedIds);
      setAlerts(previous);
      flash('error', t('dismissError'));
    }
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-6 pb-20">

      {/* Header */}
      <div className="
        flex flex-col justify-between gap-4
        sm:flex-row sm:items-center
      "
      >
        <div>
          <h1 className="text-xl font-bold text-[#111827]">{t('title')}</h1>
          <p className="mt-0.5 text-sm text-[#6B7280]">{t('subtitle')}</p>
        </div>

        <Link
          href="/api/audit-logs/export"
          className="
            flex items-center gap-2 self-start rounded-xl border
            border-[#E5E7EB] bg-white px-3.5 py-2 text-xs font-semibold
            text-[#374151] transition-colors
            hover:bg-[#F9FAFB]
            sm:self-auto
          "
        >
          <Download className="size-4 text-[#6B7280]" />
          {t('exportLog')}
        </Link>
      </div>

      {loadFailed && (
        <div
          role="alert"
          className="
            flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50
            px-4 py-3 text-sm text-rose-700
          "
        >
          <AlertTriangle className="size-4 shrink-0" />
          {t('loadError')}
        </div>
      )}

      {status && (
        <div
          role={status.kind === 'error' ? 'alert' : 'status'}
          className={`
            flex items-center gap-2 rounded-xl border px-4 py-3 text-sm
            ${status.kind === 'success'
          ? `border-emerald-200 bg-emerald-50 text-emerald-700`
          : `border-rose-200 bg-rose-50 text-rose-700`}
          `}
        >
          {status.kind === 'success'
            ? (
                <CheckCircle2 className="size-4 shrink-0" />
              )
            : (
                <AlertTriangle className="size-4 shrink-0" />
              )}
          {status.text}
        </div>
      )}

      {/* Stat cards */}
      <div className="
        grid grid-cols-1 gap-4
        sm:grid-cols-2
        lg:grid-cols-4
      "
      >
        <div className="
          flex items-center justify-between rounded-2xl border border-[#E5E7EB]
          bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">{t('stat2fa')}</p>
            <p className="text-2xl font-bold text-[#111827]">
              {globalTfaPercentage}
              %
            </p>
            <div className="
              mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-[#F3F4F6]
            "
            >
              <div className="h-full rounded-full bg-[#4B6BFB]" style={{ width: `${globalTfaPercentage}%` }} />
            </div>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-[#F0F4FF]
            text-[#4B6BFB]
          "
          >
            <ShieldCheck className="size-5" />
          </div>
        </div>

        <div className="
          flex items-center justify-between rounded-2xl border border-[#E5E7EB]
          bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">{t('statSessions')}</p>
            <p className="text-2xl font-bold text-[#111827]">{sessions.length}</p>
            <p className="text-[11px] font-semibold text-[#4B6BFB]">{t('statSessionsHint')}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-[#F0F4FF]
            text-[#4B6BFB]
          "
          >
            <Monitor className="size-5" />
          </div>
        </div>

        <div className="
          flex items-center justify-between rounded-2xl border border-[#E5E7EB]
          bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">{t('statDevices')}</p>
            <p className="text-2xl font-bold text-[#111827]">{trustedDevices.length}</p>
            <p className="text-[11px] font-semibold text-emerald-600">{t('statDevicesHint')}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-emerald-50
            text-emerald-600
          "
          >
            <HardDrive className="size-5" />
          </div>
        </div>

        <div className="
          flex items-center justify-between rounded-2xl border border-[#E5E7EB]
          bg-white p-5 shadow-2xs
        "
        >
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#6B7280]">{t('statAlerts')}</p>
            <p className="text-2xl font-bold text-[#111827]">{alerts.length}</p>
          </div>
          <div className="
            flex size-10 items-center justify-center rounded-xl bg-amber-50
            text-amber-600
          "
          >
            <ShieldAlert className="size-5" />
          </div>
        </div>
      </div>

      {/* Recommendation: only while admin 2FA is not enforced */}
      {!requireAdmin2fa && (
        <div className="
          flex flex-col justify-between gap-3 rounded-2xl border
          border-[#C7D2FE] bg-[#F0F4FF] p-4
          sm:flex-row sm:items-center
        "
        >
          <div className="flex items-center gap-3">
            <div className="
              flex size-9 shrink-0 items-center justify-center rounded-xl
              bg-[#4B6BFB] text-white
            "
            >
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#111827]">{t('recommendTitle')}</p>
              <p className="mt-0.5 text-xs text-[#6B7280]">{t('recommendBody')}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={saving2fa}
            onClick={() => void handleToggleRequireAdmin2fa(true)}
            className="
              flex items-center gap-1.5 self-start rounded-lg bg-[#4B6BFB] px-3
              py-1.5 text-xs font-semibold whitespace-nowrap text-white
              transition-colors
              hover:bg-[#3B5BDB]
              disabled:opacity-60
              sm:self-auto
            "
          >
            {t('enableNow')}
          </button>
        </div>
      )}

      <div className="
        grid grid-cols-1 gap-6
        lg:grid-cols-3
      "
      >

        <div className="
          flex flex-col gap-6
          lg:col-span-2
        "
        >

          {/* Policies: only what the app really enforces */}
          <div className="
            overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white
            shadow-2xs
          "
          >
            <div className="
              flex items-center gap-3 border-b border-[#F3F4F6] px-6 py-4
            "
            >
              <div className="
                flex size-8 items-center justify-center rounded-lg bg-[#F0F4FF]
              "
              >
                <Lock className="size-4 text-[#4B6BFB]" />
              </div>
              <h2 className="text-sm font-semibold text-[#111827]">{t('policiesTitle')}</h2>
            </div>
            <div className="space-y-4 p-6">
              <div className="
                flex items-center justify-between gap-4 rounded-xl
                bg-[#F0F4FF]/60 px-3 py-2
              "
              >
                <div>
                  <p className="text-xs font-semibold text-[#111827]">{t('admin2faLabel')}</p>
                  <p className="text-[11px] text-[#6B7280]">{t('admin2faHint')}</p>
                </div>
                <Toggle
                  checked={requireAdmin2fa}
                  onChange={v => void handleToggleRequireAdmin2fa(v)}
                  label={t('admin2faLabel')}
                  disabled={saving2fa}
                />
              </div>
              {/* The old form (password complexity, session timeout, IP allow-list,
                  login alerts) posted to /api/settings, which rejected it every time,
                  and nothing in the app enforces those rules. Say so instead. */}
              <p className="
                flex items-start gap-2 rounded-xl border border-[#E5E7EB]
                bg-[#F9FAFB] p-3 text-[11px] text-[#6B7280]
              "
              >
                <Info className="mt-0.5 size-3.5 shrink-0" />
                {t('notEnforcedNote')}
              </p>
            </div>
          </div>

          {/* 2FA adoption by role */}
          <div className="
            space-y-4 rounded-2xl border border-[#E5E7EB] bg-white p-6
            shadow-2xs
          "
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#111827]">{t('adoptionTitle')}</h3>
                <p className="mt-0.5 text-xs text-[#6B7280]">{t('adoptionHint')}</p>
              </div>
              <span className="
                rounded-full bg-[#F0F4FF] px-2.5 py-1 text-xs font-semibold
                text-[#4B6BFB]
              "
              >
                {t('globalPct', { pct: globalTfaPercentage })}
              </span>
            </div>

            <div className="
              grid grid-cols-1 gap-4 pt-2
              sm:grid-cols-2
            "
            >
              {initial2faAdoption.map(item => (
                <div
                  key={item.roleKey}
                  className="
                    space-y-2 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB]
                    p-4
                  "
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#111827]">{roleLabel(item.roleKey)}</span>
                    <span className={`
                      rounded-full px-2 py-0.5 text-[10px] font-bold
                      ${item.badgeColor}
                    `}
                    >
                      {item.tfaCount}
                      {' '}
                      /
                      {item.totalCount}
                      {' '}
                      (
                      {item.percentage}
                      %)
                    </span>
                  </div>
                  <div className="
                    h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB]
                  "
                  >
                    <div
                      className="
                        h-full rounded-full bg-[#4B6BFB] transition-all
                        duration-500
                      "
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active devices */}
          <div className="
            space-y-4 rounded-2xl border border-[#E5E7EB] bg-white p-6
            shadow-2xs
          "
          >
            <div>
              <h3 className="text-sm font-semibold text-[#111827]">{t('devicesTitle')}</h3>
              <p className="mt-0.5 text-xs text-[#6B7280]">{t('devicesHint')}</p>
            </div>

            {trustedDevices.length === 0
              ? (
                  <p className="py-2 text-xs text-[#9CA3AF]">{t('noDevices')}</p>
                )
              : (
                  <div className="
                    grid grid-cols-1 gap-4
                    sm:grid-cols-3
                  "
                  >
                    {trustedDevices.map(dev => (
                      <div
                        key={dev.id}
                        className="
                          flex flex-col justify-between space-y-3 rounded-xl
                          border border-[#E5E7EB] bg-[#F9FAFB] p-4
                        "
                      >
                        <div>
                          <div className="
                            mb-2 flex items-center justify-between
                          "
                          >
                            <span className="
                              inline-flex items-center gap-1 rounded-md border
                              border-emerald-200 bg-emerald-50 px-2 py-0.5
                              text-[10px] font-bold text-emerald-700
                            "
                            >
                              <CheckCircle2 className="size-3" />
                              {' '}
                              {t('active')}
                            </span>
                            {dev.isCurrent && (
                              <span className="
                                text-[10px] font-bold text-[#4B6BFB]
                              "
                              >
                                {t('thisDevice')}
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-[#111827]">{deviceLabel(dev.browser, dev.os)}</h4>
                          <p className="mt-0.5 text-[11px] text-[#6B7280]">{dev.owner}</p>
                          <p className="mt-1 text-[10px] text-[#9CA3AF]">
                            {t('firstSeen', { date: dev.firstSeenAt ? new Date(dev.firstSeenAt).toLocaleDateString(intlLocale) : '—' })}
                          </p>
                        </div>
                        {!dev.isCurrent && (
                          <button
                            type="button"
                            onClick={() => void handleRevokeSession(dev.id.replace(/^dev-/, ''))}
                            className="
                              border-t border-[#E5E7EB] pt-2 text-start text-xs
                              font-medium text-rose-600
                              hover:underline
                            "
                          >
                            {t('revokeSession')}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
          </div>

        </div>

        <div className="flex flex-col gap-6">

          {/* Alerts */}
          <div className="
            space-y-4 rounded-2xl border border-[#E5E7EB] bg-white p-5
            shadow-2xs
          "
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-[#111827]">{t('alertsTitle')}</h3>
              </div>
              <span className="text-xs text-[#9CA3AF]">{t('alertsCount', { count: alerts.length })}</span>
            </div>

            <div className="space-y-3">
              {alerts.map(alt => (
                <div
                  key={alt.id}
                  className={`
                    space-y-2 rounded-xl border p-3.5
                    ${
                alt.severity === 'critical'
                  ? 'border-rose-200 bg-rose-50/70 text-rose-900'
                  : 'border-amber-200 bg-amber-50/70 text-amber-900'
                }
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <AlertTriangle className="size-4 shrink-0" />
                      <span>{t(`alerts.${alt.kind}.title`)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDismissAlert(alt.id)}
                      className="
                        text-[#9CA3AF]
                        hover:text-[#111827]
                      "
                      aria-label={t('dismissAlert')}
                      title={t('dismissAlert')}
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-[#374151]">{t(`alerts.${alt.kind}.body`, { count: alt.count })}</p>
                  <div className="flex justify-end pt-1">
                    <Link
                      href={`/${locale}${alt.actionHref}`}
                      className="
                        text-xs font-semibold text-[#4B6BFB]
                        hover:underline
                      "
                    >
                      {t(`alerts.${alt.kind}.action`)}
                    </Link>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && (
                <p className="
                  py-2 text-center text-xs font-medium text-emerald-600
                "
                >
                  {t('noAlerts')}
                </p>
              )}
            </div>
          </div>

          {/* Sessions */}
          <div className="
            space-y-4 rounded-2xl border border-[#E5E7EB] bg-white p-5
            shadow-2xs
          "
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="size-4 text-[#4B6BFB]" />
                <h3 className="text-sm font-semibold text-[#111827]">{t('sessionsTitle')}</h3>
              </div>
              {sessions.some(s => !s.isCurrent) && (
                <button
                  type="button"
                  onClick={() => void handleRevokeAllOtherSessions()}
                  className="
                    text-xs font-semibold text-rose-600
                    hover:underline
                  "
                >
                  {t('revokeOthers')}
                </button>
              )}
            </div>

            <div className="space-y-3">
              {sessions.length === 0 && (
                <p className="py-2 text-center text-xs text-[#9CA3AF]">
                  {t('noSessions')}
                </p>
              )}
              {sessions.map(s => (
                <div
                  key={s.id}
                  className="
                    flex items-center justify-between rounded-xl border
                    border-[#E5E7EB] bg-[#F9FAFB] p-3 text-xs
                  "
                >
                  <div className="flex items-center gap-3">
                    {s.type === 'mobile'
                      ? (
                          <Smartphone className="size-4 text-[#6B7280]" />
                        )
                      : (
                          <Laptop className="size-4 text-[#6B7280]" />
                        )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#111827]">{deviceLabel(s.browser, s.os)}</span>
                        {s.isCurrent && (
                          <span className="
                            rounded-sm bg-emerald-100 px-1.5 text-[9px]
                            font-bold text-emerald-800
                          "
                          >
                            {t('current')}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#6B7280]">
                        {s.userName}
                        {' '}
                        (
                        {roleLabel(s.userRole)}
                        )
                      </p>
                      <p className="text-[10px] text-[#9CA3AF]">
                        <span className="font-mono" dir="ltr">{s.ip}</span>
                        {s.lastActiveAt ? ` · ${relative(s.lastActiveAt)}` : ''}
                      </p>
                    </div>
                  </div>

                  {!s.isCurrent && (
                    <button
                      type="button"
                      onClick={() => void handleRevokeSession(s.id)}
                      className="
                        rounded-lg p-1.5 text-rose-600 transition-colors
                        hover:bg-rose-50
                      "
                      title={t('endSession')}
                      aria-label={t('endSession')}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recent audit */}
          <div className="
            space-y-4 rounded-2xl border border-[#E5E7EB] bg-white p-5
            shadow-2xs
          "
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-[#4B6BFB]" />
                <h3 className="text-sm font-semibold text-[#111827]">{t('auditTitle')}</h3>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/${locale}/dashboard/settings/security/login-events`}
                  className="
                    text-xs font-medium text-[#4B6BFB]
                    hover:underline
                  "
                >
                  {t('loginLog')}
                </Link>
                <Link
                  href={`/${locale}/dashboard/settings/audit-logs`}
                  className="
                    text-xs font-medium text-[#4B6BFB]
                    hover:underline
                  "
                >
                  {t('seeAll')}
                </Link>
              </div>
            </div>

            <div className="space-y-3">
              {initialAudits.length === 0 && (
                <p className="py-2 text-center text-xs text-[#9CA3AF]">
                  {t('noAudit')}
                </p>
              )}
              {initialAudits.slice(0, 5).map(a => (
                <div key={a.id} className="flex items-start gap-2.5 text-xs">
                  <div className="
                    mt-1.5 size-2 shrink-0 rounded-full bg-[#4B6BFB]
                  "
                  />
                  <div>
                    <p className="font-medium text-[#111827]">
                      <span className="
                        rounded-sm bg-[#F9FAFB] px-1 font-mono text-[#4B6BFB]
                      "
                      >
                        {a.action}
                      </span>
                      {' · '}
                      <span className="font-mono">{a.entityType}</span>
                    </p>
                    {a.createdAt && (
                      <p className="text-[10px] text-[#9CA3AF]">
                        {new Date(a.createdAt).toLocaleString(intlLocale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
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
