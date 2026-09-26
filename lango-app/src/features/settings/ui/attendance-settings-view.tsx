'use client';

// attendance-settings-view.tsx
// CLIENT ISLAND — the Attendance settings page (SCF-04-01).
//
// Every control here edits a key that ALREADY exists in the settings registry
// and is already read by attendance code. There is no new API and no second
// store: the page is a form over GET/PATCH /api/settings/values/[key].
//
// Which keys have a real consumer (checked, not assumed):
//   attendance.lateGraceMinutes / attendance.periodStartTime
//     -> api/attendance/qr/verify-and-stage (entry lateness on badge scan)
//   attendance.consecutiveAbsenceThreshold / attendance.repeatedLateThreshold
//     -> libs/api/attendance-flags (when a flag is raised)
//   attendance.smsAlerts -> api/attendance (guardian SMS on unjustified absence)
//   attendance.presenceModes -> STORED ONLY: no attendance logic reads it yet.
//     It is the list of statuses a school allows; the register renders all of
//     them today. Kept here because it belongs to this page, and labelled as a
//     display preference rather than implying it filters anything.

import { AlertCircle, Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

/** The 7 presence-mode toggles, in display order. */
const PRESENCE_MODES = [
  'presence',
  'absenceJustifiee',
  'absenceNonJustifiee',
  'retard',
  'sortieAnticipee',
  'morning',
  'afternoon',
] as const;

const NUMPUT_KEYS = [
  'attendance.lateGraceMinutes',
  'attendance.consecutiveAbsenceThreshold',
  'attendance.repeatedLateThreshold',
] as const;

const KEYS = [
  ...NUMPUT_KEYS,
  'attendance.periodStartTime',
  'attendance.smsAlerts',
  'attendance.presenceModes',
] as const;

type SettingKey = typeof KEYS[number];

type Loaded = Record<string, { value: unknown; version: number }>;

/** Range the page enforces, tighter than the registry's for two of the keys. */
const NUM_RANGE: Record<string, { min: number; max: number }> = {
  'attendance.lateGraceMinutes': { min: 0, max: 60 },
  'attendance.consecutiveAbsenceThreshold': { min: 2, max: 30 },
  'attendance.repeatedLateThreshold': { min: 2, max: 30 },
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Registry key -> the form field holding it. */
const FIELD_BY_KEY: Record<typeof NUMPUT_KEYS[number], keyof FormState> = {
  'attendance.lateGraceMinutes': 'lateGraceMinutes',
  'attendance.consecutiveAbsenceThreshold': 'consecutiveAbsenceThreshold',
  'attendance.repeatedLateThreshold': 'repeatedLateThreshold',
};

type FormState = {
  lateGraceMinutes: number;
  consecutiveAbsenceThreshold: number;
  repeatedLateThreshold: number;
  periodStartTime: string;
  smsAlerts: boolean;
  presenceModes: Record<string, boolean>;
};

function toForm(loaded: Loaded): FormState {
  const num = (key: string, fallback: number) => {
    const raw = loaded[key]?.value;
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback;
  };
  const modesRaw = loaded['attendance.presenceModes']?.value;
  const modes = modesRaw && typeof modesRaw === 'object' && !Array.isArray(modesRaw)
    ? Object.fromEntries(PRESENCE_MODES.map(k => [k, (modesRaw as Record<string, unknown>)[k] !== false]))
    : Object.fromEntries(PRESENCE_MODES.map(k => [k, true]));
  return {
    lateGraceMinutes: num('attendance.lateGraceMinutes', 15),
    consecutiveAbsenceThreshold: num('attendance.consecutiveAbsenceThreshold', 3),
    repeatedLateThreshold: num('attendance.repeatedLateThreshold', 5),
    periodStartTime: typeof loaded['attendance.periodStartTime']?.value === 'string'
      ? loaded['attendance.periodStartTime']!.value as string
      : '08:00',
    smsAlerts: loaded['attendance.smsAlerts']?.value !== false,
    presenceModes: modes,
  };
}

export function AttendanceSettingsView() {
  const t = useTranslations('AttendanceSettings');
  const tc = useTranslations('Common');

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const results = await Promise.all(KEYS.map(async key => {
        const res = await fetch(`/api/settings/values/${encodeURIComponent(key)}`);
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
        return [key, { value: json.data.value, version: json.data.version as number }] as const;
      }));
      const next = Object.fromEntries(results) as Loaded;
      setLoaded(next);
      setForm(toForm(next));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('loadError'));
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  if (loadError) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
          <p className="text-sm text-red-800">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!form || !loaded) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-xs">{tc('loading')}</span>
      </div>
    );
  }

  const setNum = (key: keyof FormState, raw: string) => {
    const parsed = raw === '' ? Number.NaN : Number(raw);
    setForm(prev => (prev ? { ...prev, [key]: parsed } : prev));
  };

  const timeValid = TIME_RE.test(form.periodStartTime);
  const numErrors = NUMPUT_KEYS.filter((key) => {
    const value = form[FIELD_BY_KEY[key]] as number;
    const { min, max } = NUM_RANGE[key]!;
    return !(Number.isInteger(value) && value >= min && value <= max);
  });
  const formValid = numErrors.length === 0 && timeValid;

  // Only keys whose value actually moved are sent; a PATCH per changed key so
  // the version check and the audit entry stay per-key.
  const dirty = buildPatch(form, loaded);
  const hasChanges = dirty.length > 0;

  const handleSave = async () => {
    if (!formValid || !hasChanges) return;
    setSaving(true);
    try {
      for (const { key, value, expectedVersion } of dirty) {
        const res = await fetch(`/api/settings/values/${encodeURIComponent(key)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value, expectedVersion }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.success === false) {
          throw new Error(json?.error?.message || json?.message || t('saveError'));
        }
      }
      toast.success(t('saved'));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const errorFor = (key: typeof NUMPUT_KEYS[number]) => {
    if (!numErrors.includes(key)) return null;
    const { min, max } = NUM_RANGE[key]!;
    return t('rangeError', { min, max });
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-24">
      <div className="border-b border-slate-200 pb-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">{t('title')}</h1>
        <p className="mt-1 text-xs font-medium text-slate-500">{t('subtitle')}</p>
      </div>

      {/* ── Entry rules ── */}
      <Section title={t('sectionEntry')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={t('lateGraceMinutesLabel')}
            hint={t('lateGraceMinutesHint')}
            error={errorFor('attendance.lateGraceMinutes')}
          >
            <NumberInput
              value={form.lateGraceMinutes}
              min={0}
              max={60}
              onChange={v => setNum('lateGraceMinutes', v)}
            />
          </Field>
          <Field
            label={t('periodStartTimeLabel')}
            hint={t('periodStartTimeHint')}
            error={timeValid ? null : t('timeFormatError')}
          >
            <input
              type="time"
              value={form.periodStartTime}
              onChange={e => setForm(prev => (prev ? { ...prev, periodStartTime: e.target.value } : prev))}
              className={inputClass(!timeValid)}
            />
          </Field>
        </div>
      </Section>

      {/* ── Flags ── */}
      <Section title={t('sectionThresholds')}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={t('consecutiveAbsenceThresholdLabel')}
            hint={t('consecutiveAbsenceThresholdHint')}
            error={errorFor('attendance.consecutiveAbsenceThreshold')}
          >
            <NumberInput
              value={form.consecutiveAbsenceThreshold}
              min={2}
              max={30}
              onChange={v => setNum('consecutiveAbsenceThreshold', v)}
            />
          </Field>
          <Field
            label={t('repeatedLateThresholdLabel')}
            hint={t('repeatedLateThresholdHint')}
            error={errorFor('attendance.repeatedLateThreshold')}
          >
            <NumberInput
              value={form.repeatedLateThreshold}
              min={2}
              max={30}
              onChange={v => setNum('repeatedLateThreshold', v)}
            />
          </Field>
        </div>
      </Section>

      {/* ── Alerts ── */}
      <Section title={t('sectionAlerts')}>
        <ToggleRow
          label={t('smsAlertsLabel')}
          hint={t('smsAlertsHint')}
          checked={form.smsAlerts}
          onChange={v => setForm(prev => (prev ? { ...prev, smsAlerts: v } : prev))}
        />
      </Section>

      {/* ── Presence modes ── */}
      <Section title={t('sectionModes')}>
        <p className="mb-3 text-xs text-[#6B7280]">{t('presenceModesHint')}</p>
        <div className="flex flex-col gap-1">
          {PRESENCE_MODES.map(mode => (
            <ToggleRow
              key={mode}
              label={t(`presenceModes.${mode}` as 'presenceModes.presence')}
              checked={form.presenceModes[mode] !== false}
              onChange={v => setForm(prev => (prev
                ? { ...prev, presenceModes: { ...prev.presenceModes, [mode]: v } }
                : prev))}
            />
          ))}
        </div>
      </Section>

      <div className="flex items-center justify-end gap-3">
        {hasChanges && !formValid && (
          <span className="text-[11px] font-medium text-red-600">{t('fixErrors')}</span>
        )}
        <button
          type="button"
          onClick={() => { void handleSave(); }}
          disabled={saving || !hasChanges || !formValid}
          className="
            flex h-9 items-center gap-2 rounded-xl bg-[#2487B8] px-4 text-xs
            font-bold text-white
            hover:bg-[#1B6C93]
            disabled:cursor-not-allowed disabled:opacity-50
          "
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          {saving ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Keys whose value moved, with the version each was loaded at. */
function buildPatch(form: FormState, loaded: Loaded) {
  const before = toForm(loaded);
  const out: Array<{ key: SettingKey; value: unknown; expectedVersion: number }> = [];
  const push = (key: SettingKey, value: unknown) => {
    const version = loaded[key]?.version;
    out.push({ key, value, expectedVersion: typeof version === 'number' ? version : 0 });
  };
  if (form.lateGraceMinutes !== before.lateGraceMinutes) push('attendance.lateGraceMinutes', form.lateGraceMinutes);
  if (form.consecutiveAbsenceThreshold !== before.consecutiveAbsenceThreshold) push('attendance.consecutiveAbsenceThreshold', form.consecutiveAbsenceThreshold);
  if (form.repeatedLateThreshold !== before.repeatedLateThreshold) push('attendance.repeatedLateThreshold', form.repeatedLateThreshold);
  if (form.periodStartTime !== before.periodStartTime) push('attendance.periodStartTime', form.periodStartTime);
  if (form.smsAlerts !== before.smsAlerts) push('attendance.smsAlerts', form.smsAlerts);
  if (PRESENCE_MODES.some(m => form.presenceModes[m] !== before.presenceModes[m])) {
    push('attendance.presenceModes', form.presenceModes);
  }
  return out;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
      <div className="border-b border-[#F3F4F6] px-6 py-4">
        <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function Field({ label, hint, error, children }: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[#374151]">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-[#6B7280]">{hint}</span>}
      {error && (
        <span className="flex items-center gap-1 text-[11px] font-medium text-red-600">
          <AlertCircle className="size-3" />
          {error}
        </span>
      )}
    </div>
  );
}

function inputClass(invalid: boolean) {
  return [
    'h-9 w-full rounded-xl border px-3 text-sm text-[#111827] outline-none',
    invalid ? 'border-red-400' : 'border-[#D1D5DB]',
    'focus:border-[#2487B8]',
  ].join(' ');
}

function NumberInput({ value, min, max, onChange }: {
  value: number;
  min: number;
  max: number;
  onChange: (raw: string) => void;
}) {
  const invalid = !(Number.isInteger(value) && value >= min && value <= max);
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={1}
      value={Number.isFinite(value) ? value : ''}
      onChange={e => onChange(e.target.value)}
      className={inputClass(invalid)}
    />
  );
}

function ToggleRow({ label, hint, checked, onChange }: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl px-3 py-2 hover:bg-[#F9FAFB]">
      <div className="min-w-0">
        <p className="text-sm text-[#374151]">{label}</p>
        {hint && <p className="mt-0.5 text-[11px] text-[#6B7280]">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={[
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-[#2487B8]' : 'bg-[#D1D5DB]',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 size-5 rounded-full bg-white transition-all',
            checked ? 'left-[22px] rtl:left-auto rtl:right-[22px]' : 'left-0.5 rtl:left-auto rtl:right-0.5',
          ].join(' ')}
        />
      </button>
    </div>
  );
}

