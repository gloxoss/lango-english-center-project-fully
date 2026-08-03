'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, ChevronDown, ChevronRight, Eye, EyeOff, Save, RotateCcw } from 'lucide-react';
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

type ApiResponse = {
  success: boolean;
  data: {
    values: EffectiveValue[];
    grouped: GroupedValues;
    namespaces: string[];
  };
};

const NS_LABELS: Record<string, string> = {
  organization: 'Organisation',
  academic: 'Année scolaire',
  attendance: 'Présence',
  localization: 'Localisation',
  security: 'Sécurité',
};

const SOURCE_BADGES: Record<string, { label: string; cls: string }> = {
  default: { label: 'Par défaut', cls: 'bg-slate-100 text-slate-500' },
  tenant: { label: 'Établissement', cls: 'bg-blue-50 text-blue-600' },
  branch: { label: 'Filiale', cls: 'bg-emerald-50 text-emerald-600' },
};

function valueToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
}

function ValueEditor({
  item,
  defLabel,
  onChange,
}: {
  item: EffectiveValue;
  defLabel: string;
  onChange: (key: string, val: string) => void;
}) {
  const [show, setShow] = useState(false);
  const isSecret = item.sensitivity === 'secret';
  const raw = valueToString(item.value);
  const isComplex = typeof item.value === 'object' && item.value !== null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-slate-700 truncate">{defLabel}</label>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SOURCE_BADGES[item.source]?.cls ?? ''}`}>
            {SOURCE_BADGES[item.source]?.label}
          </span>
          {item.version > 0 && (
            <span className="text-[10px] text-slate-400 font-mono">v{item.version}</span>
          )}
          {isSecret && (
            <button type="button" onClick={() => setShow(s => !s)} className="text-slate-400 hover:text-slate-600">
              {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
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
          onChange={e => onChange(item.key, e.target.value)}
          className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl"
          placeholder={item.inherited ? '(valeur héritée)' : ''}
        />
      )}

      <p className="text-[10px] text-slate-400 font-mono">{item.key}</p>
    </div>
  );
}

export default function SettingsValuesPage() {
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
        }
      })
      .catch(() => showToast('err', 'Erreur chargement des paramètres.'))
      .finally(() => setLoading(false));
  }, [showToast]);

  const toggle = (ns: string) => setExpanded(e => ({ ...e, [ns]: !e[ns] }));

  const handleChange = (key: string, val: string) => {
    setDrafts(d => ({ ...d, [key]: val }));
  };

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      // Only send keys that changed vs loaded value
      const changed = data.values
        .filter(v => drafts[v.key] !== valueToString(v.value))
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
        showToast('ok', 'Aucune modification à enregistrer.');
        return;
      }

      const res = await fetch('/api/settings/values', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: changed }),
      });
      const json = await res.json();
      if (json.success) {
        showToast('ok', `${changed.length} paramètre(s) mis à jour.`);
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
        showToast('err', json.error?.message ?? 'Erreur lors de la sauvegarde.');
      }
    } catch {
      showToast('err', 'Erreur réseau.');
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
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Registre des paramètres</h1>
          <p className="text-xs text-slate-500 mt-1">Tous les paramètres de configuration de l&apos;établissement avec historique complet.</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || dirtyCount === 0}
          className="gap-2 h-9 rounded-full px-5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Enregistrement...' : dirtyCount > 0 ? `Sauvegarder (${dirtyCount})` : 'Aucune modification'}
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
        const definitions = items.map(v => ({
          item: v,
          label: v.key.split('.').slice(1).join('.'),
        }));
        const nsExpanded = expanded[ns] ?? false;

        return (
          <Card key={ns} className="overflow-hidden border border-slate-200 rounded-2xl shadow-xs">
            <button
              type="button"
              onClick={() => toggle(ns)}
              className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-800">{NS_LABELS[ns] ?? ns}</span>
                <Badge variant="neutral" className="text-[10px] px-2">{items.length} clés</Badge>
              </div>
              {nsExpanded
                ? <ChevronDown className="w-4 h-4 text-slate-400" />
                : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>

            {nsExpanded && (
              <div className="border-t border-slate-100 px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
                {definitions.map(({ item, label }) => (
                  <ValueEditor
                    key={item.key}
                    item={item}
                    defLabel={label}
                    onChange={handleChange}
                  />
                ))}
              </div>
            )}
          </Card>
        );
      })}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
        {Object.entries(SOURCE_BADGES).map(([k, v]) => (
          <span key={k} className={`px-2 py-0.5 rounded-full font-medium ${v.cls}`}>{v.label}</span>
        ))}
        <span className="flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Héritée = valeur de niveau supérieur, modifiable</span>
      </div>
    </div>
  );
}
