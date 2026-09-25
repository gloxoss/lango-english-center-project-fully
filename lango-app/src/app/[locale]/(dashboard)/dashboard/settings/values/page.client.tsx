'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, ChevronDown, ChevronRight, Eye, EyeOff, Save, RotateCcw, RefreshCw, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

type EffectiveValue = {
  key: string;
  value: unknown;
  source: 'default' | 'tenant' | 'branch';
  version: number;
  inherited: boolean;
  sensitivity?: 'public' | 'internal' | 'secret';
};

type GroupedValues = Record<string, EffectiveValue[]>;

type CatalogMeta = {
  label: string;
  description: string | null;
  namespace: string;
  scope: string;
  sensitivity: string;
  legacyField: string | null;
};

type ApiResponse = {
  success: boolean;
  data: {
    values: EffectiveValue[];
    grouped: GroupedValues;
    namespaces: string[];
    definitions?: Record<string, CatalogMeta>;
  };
};

// Labels live in SettingsRegistry.namespaces.* and SettingsRegistry.sources.*.
const SOURCE_CLS: Record<string, string> = {
  default: 'bg-slate-100 text-slate-500',
  tenant: 'bg-blue-50 text-blue-600',
  branch: 'bg-emerald-50 text-emerald-600',
};

function valueToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
}

function ValueEditor({
  item,
  defLabel,
  description,
  onChange,
  onPeek,
  onRotate,
}: {
  item: EffectiveValue;
  defLabel: string;
  description?: string | null;
  onChange: (key: string, val: string) => void;
  onPeek?: (key: string) => Promise<string | null>;
  onRotate?: (key: string) => void;
}) {
  const t = useTranslations('SettingsRegistry');
  const [show, setShow] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [peeking, setPeeking] = useState(false);
  const isSecret = item.sensitivity === 'secret';
  const raw = revealed ?? valueToString(item.value);
  const isComplex = typeof item.value === 'object' && item.value !== null;

  // Reveal is an explicit audited action (POST /values/[key]/peek): the stored
  // value is decrypted server-side and shown only after the user asks.
  const handleReveal = async () => {
    if (revealed !== null) {
      setShow(s => !s);
      return;
    }
    if (!onPeek) return;
    setPeeking(true);
    try {
      const val = await onPeek(item.key);
      if (val !== null) {
        setRevealed(val);
        setShow(true);
      }
    } finally {
      setPeeking(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-slate-700 truncate">{defLabel}</label>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SOURCE_CLS[item.source] ?? ''}`}>
            {t(`sources.${item.source}`)}
          </span>
          {item.version > 0 && (
            <span className="text-[10px] text-slate-400 font-mono">v{item.version}</span>
          )}
          {isSecret && (
            <>
              {onRotate && (
                <button
                  type="button"
                  onClick={() => onRotate(item.key)}
                  title={t('rotate')}
                  aria-label={t('rotate')}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={handleReveal}
                title={t('reveal')}
                aria-label={t('reveal')}
                disabled={peeking}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-40"
              >
                {peeking
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </>
          )}
        </div>
      </div>

      {isComplex ? (
        <textarea
          rows={3}
          value={raw}
          onChange={e => onChange(item.key, e.target.value)}
          className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      ) : (
        <Input
          type={isSecret && !show ? 'password' : 'text'}
          value={raw}
          onChange={e => {
            if (isSecret) setRevealed(e.target.value);
            onChange(item.key, e.target.value);
          }}
          className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl"
          placeholder={item.inherited ? t('inheritedValue') : ''}
          aria-label={defLabel}
        />
      )}

      {description && <p className="text-[10px] text-slate-500 leading-snug">{description}</p>}
      <p className="text-[10px] text-slate-400 font-mono">{item.key}</p>
    </div>
  );
}

export default function SettingsValuesPage() {
  const t = useTranslations('SettingsRegistry');
  const [data, setData] = useState<ApiResponse['data'] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [snapshot, setSnapshot] = useState<Record<string, string>>({}); // F03: baseline for dirty check
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: 'ok' | 'err', msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, msg });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  useEffect(() => {
    fetch('/api/settings/values')
      .then(r => r.json())
      .then((json: ApiResponse) => {
        if (json.success) {
          setData(json.data);
          // Init expanded for first namespace
          if (json.data.namespaces[0]) {
            setExpanded({ [json.data.namespaces[0]]: true });
          }
          // Seed drafts and snapshot from current values
          const init: Record<string, string> = {};
          for (const v of json.data.values) init[v.key] = valueToString(v.value);
          setDrafts(init);
          setSnapshot(init);
        } else {
          showToast('err', t('loadError'));
        }
      })
      .catch(() => showToast('err', t('loadError')))
      .finally(() => setLoading(false));
  }, [showToast]);

  const toggle = (ns: string) => setExpanded(e => ({ ...e, [ns]: !e[ns] }));

  const handleChange = (key: string, val: string) => {
    setDrafts(d => ({ ...d, [key]: val }));
  };

  // Reveal a secret (audited server-side) and keep it as the editing baseline.
  const handlePeek = async (key: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/settings/values/${encodeURIComponent(key)}/peek`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        // Sync both draft and dirty-check baseline so peeking alone never
        // counts as a pending change — only an actual edit does.
        setDrafts(d => ({ ...d, [key]: json.data.value }));
        setSnapshot(s => ({ ...s, [key]: json.data.value }));
        return json.data.value as string;
      }
      showToast('err', json.error?.message ?? t('revealError'));
      return null;
    } catch {
      showToast('err', t('revealNetworkError'));
      return null;
    }
  };

  const handleRotate = async (key: string) => {
    try {
      const res = await fetch(`/api/settings/values/${encodeURIComponent(key)}/rotate`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        showToast('ok', json.message ?? t('rotated'));
      } else {
        showToast('err', json.error?.message ?? t('rotateError'));
      }
    } catch {
      showToast('err', t('rotateNetworkError'));
    }
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      // Only send keys that changed vs the snapshot (same baseline as the dirty
      // counter): comparing with the loaded value re-saved every secret that had
      // merely been revealed.
      const changed = data.values
        .filter(v => drafts[v.key] !== snapshot[v.key])
        .map(v => {
          let value: unknown = drafts[v.key];
          // Try to parse complex JSON back
          if (typeof v.value === 'object' && v.value !== null) {
            try { value = JSON.parse(drafts[v.key] ?? ''); } catch { /* keep string */ }
          } else if (typeof v.value === 'boolean') {
            value = drafts[v.key] === 'true';
          }
          return { key: v.key, value };
        });

      if (changed.length === 0) {
        showToast('ok', t('nothingToSave'));
        return;
      }

      const res = await fetch('/api/settings/values', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: changed }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('ok', t('saved', { count: changed.length }));
        // Refetch
        const fresh = await fetch('/api/settings/values').then(r => r.json()) as ApiResponse;
        if (fresh.success) {
          setData(fresh.data);
          const newDrafts: Record<string, string> = {};
          for (const v of fresh.data.values) newDrafts[v.key] = valueToString(v.value);
          setDrafts(newDrafts);
          setSnapshot(newDrafts); // reset baseline after successful save
        }
      } else {
        showToast('err', json.error?.message ?? t('saveError'));
      }
    } catch {
      showToast('err', t('networkError'));
    } finally {
      setSaving(false);
    }
  };

  // F03: compare against snapshot (fixed baseline), not re-stringified live values.
  const dirtyCount = Object.keys(snapshot).filter(k => drafts[k] !== snapshot[k]).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('title')}</h1>
          <p className="text-xs text-slate-500 mt-1">{t('subtitle')}</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || dirtyCount === 0}
          className="gap-2 h-9 rounded-full px-5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
        >
          <Save className="w-4 h-4" />
          {saving ? t('saving') : dirtyCount > 0 ? t('saveCount', { count: dirtyCount }) : t('noChanges')}
        </Button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-semibold ${
          toast.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {toast.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Namespace Accordions */}
      {data && data.namespaces.map(ns => {
        const items = data.grouped[ns] ?? [];
        const definitions = items.map(v => {
          const meta = data.definitions?.[v.key];
          return {
            item: v,
            label: meta?.label ?? v.key.split('.').slice(1).join('.'),
            description: meta?.description,
          };
        });
        const nsExpanded = expanded[ns] ?? false;

        return (
          <Card key={ns} className="overflow-hidden border border-slate-200 rounded-2xl shadow-xs">
            <button
              type="button"
              onClick={() => toggle(ns)}
              className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-800">{t.has(`namespaces.${ns}`) ? t(`namespaces.${ns}` as 'namespaces.finance') : ns}</span>
                <Badge variant="neutral" className="text-[10px] px-2">{t('keysCount', { count: items.length })}</Badge>
              </div>
              {nsExpanded
                ? <ChevronDown className="w-4 h-4 text-slate-400" />
                : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>

            {nsExpanded && (
              <div className="border-t border-slate-100 px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
                {definitions.map(({ item, label, description }) => (
                  <ValueEditor
                    key={item.key}
                    item={item}
                    defLabel={label}
                    description={description}
                    onChange={handleChange}
                    onPeek={handlePeek}
                    onRotate={handleRotate}
                  />
                ))}
              </div>
            )}
          </Card>
        );
      })}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
        {Object.entries(SOURCE_CLS).map(([k, cls]) => (
          <span key={k} className={`px-2 py-0.5 rounded-full font-medium ${cls}`}>{t(`sources.${k}`)}</span>
        ))}
        <span className="flex items-center gap-1"><RotateCcw className="w-3 h-3" /> {t('inheritedLegend')}</span>
      </div>
    </div>
  );
}
