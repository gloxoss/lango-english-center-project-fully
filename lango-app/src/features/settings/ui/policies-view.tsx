'use client';

import { AlertTriangle, Bell, CheckCircle2, GraduationCap, Info, RefreshCw, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

// Only keys something in the app actually reads. academic.autoPromotion,
// portal.guardianEnabled and portal.studentEnabled used to be switches here too,
// but no code consumes them, so flipping them changed nothing.
const KEYS = [
  'academic.passThreshold',
  'academic.gradingScale',
  'attendance.smsAlerts',
] as const;

type Key = (typeof KEYS)[number];
type Values = Record<Key, unknown>;

export function PoliciesView({ locale: _locale }: { locale: string }) {
  const t = useTranslations('PoliciesSettings');
  const [values, setValues] = useState<Values | null>(null);
  const [snapshot, setSnapshot] = useState<Values | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(() => {
    setLoadError(false);
    fetch('/api/settings/values')
      .then(res => (res.ok ? res.json() : null))
      .then((json) => {
        if (!json?.success) {
          setLoadError(true);
          return;
        }
        const map = Object.fromEntries(
          KEYS.map(k => [k, json.data.values.find((v: { key: string }) => v.key === k)?.value]),
        ) as Values;
        setValues(map);
        setSnapshot(map);
      })
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key: Key, value: unknown) => {
    setValues(prev => (prev ? { ...prev, [key]: value } : prev));
  };

  const scale = Number(values?.['academic.gradingScale'] ?? 20);
  const threshold = Number(values?.['academic.passThreshold']);
  const thresholdInvalid = !Number.isFinite(threshold) || threshold < 0 || threshold > scale;

  const handleSave = async () => {
    if (!values || !snapshot || thresholdInvalid) {
      return;
    }
    const changed = KEYS.filter(k => values[k] !== snapshot[k]);
    if (changed.length === 0) {
      setStatus({ kind: 'success', text: t('nothingToSave') });
      return;
    }
    setIsSaving(true);
    setStatus(null);
    // Used to ignore every response and always show "saved".
    const results = await Promise.all(
      changed.map(async (key) => {
        try {
          const res = await fetch(`/api/settings/values/${key}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: values[key] }),
          });
          return { key, ok: res.ok };
        } catch {
          return { key, ok: false };
        }
      }),
    );
    const saved = results.filter(r => r.ok).map(r => r.key);
    setSnapshot(prev => (prev ? { ...prev, ...Object.fromEntries(saved.map(k => [k, values[k]])) } : prev));
    const failed = results.length - saved.length;
    if (failed > 0) {
      setStatus({ kind: 'error', text: t('saveFailed', { count: failed }) });
    } else {
      setStatus({ kind: 'success', text: t('saved') });
      setTimeout(setStatus, 3000, null);
    }
    setIsSaving(false);
  };

  if (loadError) {
    return (
      <Card className="
        space-y-3 rounded-2xl border border-slate-200/80 bg-white p-8
        text-center
      "
      >
        <AlertTriangle className="mx-auto size-8 text-rose-400" />
        <p className="text-sm font-bold text-[#16212B]">{t('loadError')}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          className="h-8 rounded-xl text-xs"
        >
          <RefreshCw className="me-1.5 size-3.5" />
          {t('retry')}
        </Button>
      </Card>
    );
  }

  if (!values) {
    return <div className="text-xs text-slate-500">{t('loading')}</div>;
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="
        flex flex-col justify-between gap-4
        sm:flex-row sm:items-center
      "
      >
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#16212B]">{t('title')}</h1>
          <p className="mt-1 text-xs text-slate-500">{t('subtitle')}</p>
        </div>
        <Button
          onClick={() => void handleSave()}
          disabled={isSaving || thresholdInvalid}
          className="
            h-10 gap-2 self-start rounded-full bg-[#0066FF] px-5 text-xs
            font-bold text-white
            hover:bg-[#0052CC]
            sm:self-auto
          "
        >
          <Save className="size-4" />
          {isSaving ? t('saving') : t('save')}
        </Button>
      </div>

      {status && (
        <div
          role={status.kind === 'error' ? 'alert' : 'status'}
          className={`
            flex items-center gap-3 rounded-2xl border p-4 text-xs font-bold
            ${status.kind === 'success'
          ? `border-[#17A673]/30 bg-[#D1F5E8] text-[#17A673]`
          : `border-rose-200 bg-rose-50 text-rose-700`}
          `}
        >
          {status.kind === 'success'
            ? (
                <CheckCircle2 className="size-5 shrink-0" />
              )
            : (
                <AlertTriangle className="size-5 shrink-0" />
              )}
          <span>{status.text}</span>
        </div>
      )}

      <div className="
        grid grid-cols-1 gap-6
        md:grid-cols-2
      "
      >
        <Card className="
          space-y-5 rounded-2xl border border-slate-200/80 bg-white p-6
          shadow-2xs
        "
        >
          <div className="flex items-center gap-3">
            <div className="
              flex size-10 items-center justify-center rounded-xl bg-[#DCEBF4]
              text-[#1B6C93]
            "
            >
              <GraduationCap className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#16212B]">{t('gradingTitle')}</h3>
              <p className="text-[11px] text-slate-500">{t('gradingHint')}</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <label htmlFor="pol-scale" className="font-bold text-slate-700">{t('scaleLabel')}</label>
              <Select value={String(values['academic.gradingScale'] ?? '20')} onValueChange={v => setField('academic.gradingScale', v)}>
                <SelectTrigger
                  id="pol-scale"
                  className="
                    h-10 rounded-xl border border-slate-200 bg-slate-50 text-xs
                  "
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">{t('scale20')}</SelectItem>
                  <SelectItem value="100">{t('scale100')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="pol-threshold"
                className="font-bold text-slate-700"
              >
                {t('thresholdLabel', { scale })}
              </label>
              <Input
                id="pol-threshold"
                type="number"
                min={0}
                max={scale}
                step={0.25}
                value={String(values['academic.passThreshold'] ?? '')}
                onChange={e => setField('academic.passThreshold', e.target.value === '' ? Number.NaN : Number(e.target.value))}
                aria-invalid={thresholdInvalid}
                className="
                  h-10 rounded-xl border border-slate-200 bg-slate-50 text-xs
                  font-bold
                "
              />
              {thresholdInvalid && <p className="text-[11px] text-rose-600">{t('thresholdInvalid', { scale })}</p>}
              <p className="text-[10px] text-slate-500">{t('thresholdHint')}</p>
            </div>
          </div>
        </Card>

        <Card className="
          space-y-5 rounded-2xl border border-slate-200/80 bg-white p-6
          shadow-2xs
        "
        >
          <div className="flex items-center gap-3">
            <div className="
              flex size-10 items-center justify-center rounded-xl bg-[#DCEBF4]
              text-[#1B6C93]
            "
            >
              <Bell className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#16212B]">{t('alertsTitle')}</h3>
              <p className="text-[11px] text-slate-500">{t('alertsHint')}</p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="
              flex items-center justify-between gap-4 rounded-xl border
              border-slate-100 bg-slate-50 p-3
            "
            >
              <div className="space-y-0.5">
                <p className="font-bold text-slate-700">{t('smsLabel')}</p>
                <p className="text-[10px] text-slate-500">{t('smsHint')}</p>
              </div>
              <Switch
                aria-label={t('smsLabel')}
                checked={Boolean(values['attendance.smsAlerts'])}
                onCheckedChange={v => setField('attendance.smsAlerts', v)}
              />
            </div>

            <p className="
              flex items-start gap-2 rounded-xl border border-slate-100
              bg-slate-50 p-3 text-[11px] text-slate-500
            "
            >
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {t('notEnforcedNote')}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
